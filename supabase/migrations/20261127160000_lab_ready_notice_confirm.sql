-- Laboratorio 20261127: l'avviso WhatsApp «busta pronta» parte solo dopo la conferma dell'operatore.
--
-- Prima: l'avviso partiva da solo, entro un minuto, quando un operatore metteva a mano la busta su
-- «Pronto per la consegna» (manual_status = true). Per le buste arrivate a «Pronto per la consegna» da sole
-- (passaggio automatico dopo 10 giorni) non partiva mai, e non c'era modo di mandarlo.
-- Ora ogni avviso è una richiesta confermata in Laboratorio: al passaggio a «Pronto per la consegna»
-- (azione set_ready con notify) oppure con «Avvisa il cliente su WhatsApp» su una busta già pronta (azione send).
-- L'automazione di ogni minuto (optyker-whatsapp-automations -> optyker_wa_due -> optyker_wa_due_ready) invia
-- solo le richieste confermate, con lo stesso modello ordine_pronto e lo stesso testo di prima, dalle 8 alle 21
-- (di notte attende il mattino). Una richiesta vale finché la busta resta «Pronto per la consegna» dal momento
-- della conferma (requested_at >= status_since) e per 3 giorni: qualsiasi cambio di stato la rende nulla.

create table if not exists public.optyker_wa_ready_requests (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.optyker_work_orders(id) on delete cascade,
  requested_at timestamptz not null default now(),
  requested_by text not null default '',
  cancelled_at timestamptz,
  -- Chiave del registro optyker_wa_automation_log: un invio per richiesta confermata.
  job_key text generated always as ('ready:' || work_order_id::text || ':conf:' || id::text) stored
);
create index if not exists optyker_wa_ready_requests_order_idx
  on public.optyker_wa_ready_requests (work_order_id, requested_at desc);
create index if not exists optyker_wa_ready_requests_open_idx
  on public.optyker_wa_ready_requests (requested_at) where cancelled_at is null;
alter table public.optyker_wa_ready_requests enable row level security;
revoke all on table public.optyker_wa_ready_requests from public, anon, authenticated;
grant all on table public.optyker_wa_ready_requests to service_role;

-- Testo del modello ordine_pronto (parametro {{1}}) e anteprima registrata nella chat: invariati.
create or replace function optyker_private.lab_ready_text(p_order_type text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case when p_order_type = 'lac_busta' then 'le tue lenti a contatto sono pronte' else 'il tuo occhiale è pronto' end
$$;

create or replace function optyker_private.lab_ready_preview(p_order_type text)
returns text language sql immutable set search_path = pg_catalog, optyker_private as $$
  select E'Buongiorno, siamo l''ottica di Lallio.\n*Ottica Visual Care*\n📍 Via Primo Maggio 4, 24040 Lallio (BG)\n\nCome stai? Volevamo avvisarti che '
    || optyker_private.lab_ready_text(p_order_type) || E'.\nPrenota tramite il link:\nhttps://optyker.it/booking/'
$$;

-- Stessa normalizzazione dell'invio (normalize in optyker-whatsapp-automations): 9-10 cifre = numero nazionale,
-- si aggiunge 39; 11 cifre o più = già con prefisso. Meno di 11 cifre dopo la normalizzazione = numero non valido.
create or replace function optyker_private.lab_ready_phone(p_phone text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case when d = '' then '' when length(d) >= 11 then d else '39' || d end
  from (select case when left(x, 2) = '00' then substr(x, 3) else x end as d
        from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as x) a) b
$$;

-- Stato dell'avviso di una busta, per la finestra di conferma e per le schede del Laboratorio.
create or replace function optyker_private.lab_ready_info(p_id uuid)
returns jsonb language plpgsql stable set search_path = public, optyker_private, pg_temp as $$
declare
  w record;
  v_req record;
  v_last record;
  v_enabled boolean;
  v_phone_to text;
  v_hour int;
  v_pending boolean;
  v_block text;
begin
  select o.id, o.reference_code, o.order_type, o.status, o.status_since,
         coalesce(nullif(btrim(concat_ws(' ', c.surname, c.name)), ''), '') as client_name,
         coalesce(btrim(c.phone), '') as phone
    into w
    from public.optyker_work_orders o
    left join public.optyker_clients c on c.id = o.client_id
   where o.id = p_id;
  if not found then
    return null;
  end if;

  select coalesce(bool_or(a.enabled), false) into v_enabled
    from public.optyker_wa_automations a where a.kind = 'pronto';
  v_phone_to := optyker_private.lab_ready_phone(w.phone);
  v_hour := extract(hour from (now() at time zone 'Europe/Rome'))::int;

  select r.id, r.requested_at, r.requested_by, r.job_key into v_req
    from public.optyker_wa_ready_requests r
   where r.work_order_id = p_id and r.cancelled_at is null
   order by r.requested_at desc
   limit 1;
  v_pending := v_req.id is not null
    and w.status = 'pronto_consegna'
    and v_req.requested_at >= w.status_since
    and v_req.requested_at > now() - interval '3 days'
    and not exists (select 1 from public.optyker_wa_automation_log l where l.job_key = v_req.job_key);

  -- Ultimo avviso registrato per la busta, anche quelli partiti con la regola precedente (ready:<id>:<epoch>).
  select l.status, coalesce(l.sent_at, l.created_at) as at, nullif(l.error, '') as error,
         m.status as delivery, nullif(m.error_text, '') as delivery_error
    into v_last
    from public.optyker_wa_automation_log l
    left join public.optyker_whatsapp_messages m on l.wamid is not null and m.wamid = l.wamid
   where l.kind = 'pronto' and l.job_key like 'ready:' || p_id::text || ':%'
   order by l.created_at desc
   limit 1;

  v_block := case
    when w.order_type not in ('eyewear_busta', 'lac_busta') then 'L''avviso WhatsApp è previsto solo per le buste Occhiali e LAC.'
    when not v_enabled then 'L''avviso «busta pronta» è disattivato nelle automazioni WhatsApp.'
    when w.phone = '' then 'Il cliente non ha un numero di cellulare in anagrafica.'
    when length(v_phone_to) < 11 then 'Il numero in anagrafica non è valido per WhatsApp: correggilo nella scheda cliente.'
  end;

  return jsonb_build_object(
    'id', w.id,
    'reference_code', w.reference_code,
    'order_type', w.order_type,
    'status', w.status,
    'status_since', w.status_since,
    'client_name', w.client_name,
    'phone', w.phone,
    'phone_to', v_phone_to,
    'enabled', v_enabled,
    'can_send', v_block is null,
    'block_reason', v_block,
    'preview', optyker_private.lab_ready_preview(w.order_type),
    'send_at', case when v_hour >= 8 and v_hour < 21 then 'now' when v_hour < 8 then 'today_8' else 'tomorrow_8' end,
    'pending', case when v_pending then jsonb_build_object('requested_at', v_req.requested_at, 'requested_by', v_req.requested_by) end,
    'last', case when v_last.status is not null then jsonb_build_object(
      'status', v_last.status, 'at', v_last.at, 'error', v_last.error,
      'delivery', v_last.delivery, 'delivery_error', v_last.delivery_error) end
  );
end
$$;

-- Azioni del Laboratorio. p_user è l'operatore già verificato da optyker_lab_ready_notice_api.
--   info {id}              -> stato dell'avviso per la finestra di conferma
--   status {ids:[...]}     -> stato dell'avviso per più buste (schede del Laboratorio)
--   set_ready {id, notify} -> busta su «Pronto per la consegna» e, con notify, avviso confermato (tutto insieme)
--   send {id}              -> avviso confermato per una busta già in «Pronto per la consegna»
--   cancel {id}            -> annulla l'avviso confermato ma non ancora partito
create or replace function optyker_private.lab_ready_handle(p_user text, p_action text, p_payload jsonb)
returns jsonb language plpgsql set search_path = public, optyker_private, pg_temp as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_id uuid;
  v_ids uuid[];
  v_order public.optyker_work_orders%rowtype;
  v_info jsonb;
  v_notify boolean;
  v_repeat boolean := false;
  v_count int;
begin
  if p_action = 'status' then
    select coalesce(array_agg(distinct s.id), '{}'::uuid[]) into v_ids
      from (select e::uuid as id
              from jsonb_array_elements_text(case when jsonb_typeof(v_payload->'ids') = 'array' then v_payload->'ids' else '[]'::jsonb end) e
             limit 300) s;
    return jsonb_build_object('ok', true, 'data', coalesce(
      (select jsonb_agg(x.info) from (select optyker_private.lab_ready_info(u) as info from unnest(v_ids) u) x where x.info is not null),
      '[]'::jsonb));
  end if;

  v_id := nullif(btrim(coalesce(v_payload->>'id', '')), '')::uuid;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'Busta non indicata');
  end if;

  if p_action = 'info' then
    v_info := optyker_private.lab_ready_info(v_id);
    if v_info is null then
      return jsonb_build_object('ok', false, 'error', 'Busta non trovata');
    end if;
    return jsonb_build_object('ok', true, 'data', v_info);
  end if;

  if p_action not in ('set_ready', 'send', 'cancel') then
    return jsonb_build_object('ok', false, 'error', 'Azione non valida');
  end if;

  select * into v_order from public.optyker_work_orders where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Busta non trovata');
  end if;

  if p_action = 'cancel' then
    -- Solo gli avvisi non ancora presi dall'automazione: quelli già in invio non si possono fermare.
    update public.optyker_wa_ready_requests r
       set cancelled_at = now()
     where r.work_order_id = v_id and r.cancelled_at is null
       and not exists (select 1 from public.optyker_wa_automation_log l where l.job_key = r.job_key);
    get diagnostics v_count = row_count;
    return jsonb_build_object('ok', true, 'cancelled', v_count, 'data', optyker_private.lab_ready_info(v_id));
  end if;

  v_notify := p_action = 'send' or lower(coalesce(v_payload->>'notify', 'false')) in ('true', '1');
  if v_notify then
    v_info := optyker_private.lab_ready_info(v_id);
    if not coalesce((v_info->>'can_send')::boolean, false) then
      return jsonb_build_object('ok', false, 'error', coalesce(v_info->>'block_reason', 'Avviso WhatsApp non disponibile'), 'data', v_info);
    end if;
  end if;

  if p_action = 'send' then
    if v_order.status <> 'pronto_consegna' then
      return jsonb_build_object('ok', false, 'error', 'La busta non è più in «Pronto per la consegna»: premi Aggiorna.');
    end if;
    -- Doppio clic o due operatori insieme: nessuna seconda richiesta entro 2 minuti dalla precedente ancora valida.
    v_repeat := exists (
      select 1 from public.optyker_wa_ready_requests r
       where r.work_order_id = v_id and r.cancelled_at is null
         and r.requested_at > now() - interval '2 minutes'
         and r.requested_at >= v_order.status_since);
  else
    -- Stessi campi di optyker_api -> update_work_order_status (cambio di stato fatto da un operatore).
    update public.optyker_work_orders
       set status = 'pronto_consegna', status_since = now(), updated_at = now(), manual_status = true,
           manual_status_by = btrim(coalesce(p_user, '')), manual_status_at = now()
     where id = v_id;
    -- Nuovo passaggio a «Pronto per la consegna»: gli avvisi confermati prima non valgono più.
    update public.optyker_wa_ready_requests r
       set cancelled_at = now()
     where r.work_order_id = v_id and r.cancelled_at is null
       and not exists (select 1 from public.optyker_wa_automation_log l where l.job_key = r.job_key);
  end if;

  if v_notify and not v_repeat then
    -- Una sola richiesta in attesa per busta: le precedenti non ancora partite vengono annullate.
    update public.optyker_wa_ready_requests r
       set cancelled_at = now()
     where r.work_order_id = v_id and r.cancelled_at is null
       and not exists (select 1 from public.optyker_wa_automation_log l where l.job_key = r.job_key);
    insert into public.optyker_wa_ready_requests (work_order_id, requested_by)
    values (v_id, btrim(coalesce(p_user, '')));
  end if;

  return jsonb_build_object(
    'ok', true,
    'repeat', v_repeat,
    'data', optyker_private.lab_ready_info(v_id),
    'order', (select to_jsonb(o) from public.optyker_work_orders o where o.id = v_id));
end
$$;

revoke all on function optyker_private.lab_ready_text(text) from public, anon, authenticated, service_role;
revoke all on function optyker_private.lab_ready_preview(text) from public, anon, authenticated, service_role;
revoke all on function optyker_private.lab_ready_phone(text) from public, anon, authenticated, service_role;
revoke all on function optyker_private.lab_ready_info(uuid) from public, anon, authenticated, service_role;
revoke all on function optyker_private.lab_ready_handle(text, text, jsonb) from public, anon, authenticated, service_role;

-- Accesso dal gestionale (chiave pubblica + credenziali dell'operatore), come optyker_report_api.
create or replace function public.optyker_lab_ready_notice_api(
  p_username text, p_password text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, optyker_private, pg_temp as $$
declare
  v_login jsonb;
begin
  v_login := public.optyker_staff_login_internal(p_username, p_password);
  if coalesce((v_login->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'auth', false, 'error', coalesce(v_login->>'error', 'Operatore non autorizzato'));
  end if;
  begin
    return optyker_private.lab_ready_handle(v_login->>'username', p_action, p_payload);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
end
$$;
revoke all on function public.optyker_lab_ready_notice_api(text, text, text, jsonb) from public;
grant execute on function public.optyker_lab_ready_notice_api(text, text, text, jsonb) to anon, authenticated, service_role;

-- L'automazione invia solo gli avvisi confermati in Laboratorio (prima: ogni busta messa a mano su pronto).
create or replace function public.optyker_wa_due_ready(p_now timestamptz default now())
returns table(job_key text, kind text, client_id uuid, appointment_id uuid, phone text, template text, params jsonb, preview text)
language plpgsql stable security definer set search_path = public as $$
declare
  loc timestamp := p_now at time zone 'Europe/Rome';
  h numeric := extract(hour from loc) + extract(minute from loc)/60.0;
begin
  if h < 8 or h >= 21 then return; end if;
  return query
  select r.job_key, 'pronto'::text, w.client_id, null::uuid, c.phone, 'ordine_pronto'::text,
    jsonb_build_array(optyker_private.lab_ready_text(w.order_type)),
    optyker_private.lab_ready_preview(w.order_type)
  from optyker_wa_ready_requests r
  join optyker_work_orders w on w.id = r.work_order_id
  join optyker_clients c on c.id = w.client_id
  join optyker_wa_automations a on a.kind = 'pronto' and a.enabled
  where r.cancelled_at is null
    and r.requested_at <= p_now
    and r.requested_at > p_now - interval '3 days'
    and r.requested_at >= w.status_since
    and w.status = 'pronto_consegna'
    and w.order_type in ('eyewear_busta', 'lac_busta')
    and coalesce(c.phone, '') <> ''
    and not exists (select 1 from optyker_wa_automation_log l where l.job_key = r.job_key);
end
$$;
revoke all on function public.optyker_wa_due_ready(timestamptz) from public, anon, authenticated;

update public.optyker_wa_automations
   set label = 'Avviso busta pronta per la consegna (solo dopo conferma in Laboratorio)', updated_at = now()
 where kind = 'pronto';
