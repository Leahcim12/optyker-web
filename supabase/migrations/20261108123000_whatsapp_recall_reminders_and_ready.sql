-- Applicata in produzione l'8 novembre 2026 (migrazioni whatsapp_recall_weekly_reminders e whatsapp_order_ready_notice).
--
-- 1) Solleciti dei richiami (vista, udito, controllo LAC, riordino LAC): se il cliente non risponde,
--    lo stesso modello viene rimandato ogni 7 giorni, al massimo optyker_wa_automations.recall_reminders volte (3),
--    dalle 10 alle 18. Si fermano se il cliente scrive qualsiasi cosa dopo il richiamo, se ha un appuntamento
--    futuro o se ha una scheda nuova del tipo richiamato. Chiavi: <chiave del richiamo>:s1, :s2, :s3.
-- 2) Avviso "il tuo occhiale è pronto / le tue lenti a contatto sono pronte" (modello ordine_pronto):
--    solo quando un operatore mette a mano la busta su pronto_consegna in laboratorio (manual_status = true),
--    non quando ci arriva da sola alla data prevista. Dalle 8 alle 21; di notte attende il mattino.
-- optyker_wa_due = optyker_wa_due_main (automazioni del 7 novembre) + solleciti + avviso pronto.

alter table public.optyker_wa_automations add column if not exists recall_reminders integer not null default 0 check (recall_reminders between 0 and 10);
update public.optyker_wa_automations set recall_reminders = 3 where kind in ('vista','udito','lac_controllo','lac_riordino');

create or replace function public.optyker_wa_due_reminders(p_now timestamptz default now())
returns table(job_key text, kind text, client_id uuid, appointment_id uuid, phone text, template text, params jsonb, preview text)
language plpgsql stable security definer set search_path=public as $$
declare
  loc timestamp := p_now at time zone 'Europe/Rome';
  h numeric := extract(hour from loc) + extract(minute from loc)/60.0;
begin
  if h < 10 or h >= 18 then return; end if;
  return query
  with base as (
    select l.job_key, l.kind, l.client_id, l.phone, l.sent_at, l.wamid, w.template, w.recall_reminders
    from optyker_wa_automation_log l
    join optyker_wa_automations w on w.kind = l.kind and w.enabled and w.recall_reminders > 0
    where l.status = 'sent' and l.sent_at is not null and l.job_key !~ ':s[0-9]+$'
      and l.kind in ('vista','udito','lac_controllo','lac_riordino')
      and l.sent_at > p_now - interval '90 days'
  ), cand as (
    select b.*, n from base b, generate_series(1, b.recall_reminders) n
    where b.sent_at + make_interval(days => 7 * n) <= p_now
  ), nexts as (
    select distinct on (c.job_key) c.* from cand c
    where not exists (select 1 from optyker_wa_automation_log x where x.job_key = c.job_key || ':s' || c.n)
    order by c.job_key, c.n
  )
  select x.job_key || ':s' || x.n, x.kind, x.client_id, null::uuid, x.phone, x.template, '[]'::jsonb,
    coalesce((select m.message from optyker_whatsapp_messages m where m.wamid = x.wamid limit 1), '[Sollecito richiamo]')
  from nexts x
  where (x.n = 1 or exists (select 1 from optyker_wa_automation_log p where p.job_key = x.job_key || ':s' || (x.n - 1) and p.status = 'sent'
                             and p.sent_at + interval '6 days' <= p_now))
    and not exists (select 1 from optyker_whatsapp_messages m where m.direction = 'inbound'
                    and right(regexp_replace(coalesce(m.phone,''),'\D','','g'),10) = right(regexp_replace(coalesce(x.phone,''),'\D','','g'),10)
                    and m.created_at > x.sent_at)
    and not exists (select 1 from optyker_appointments a where a.client_id = x.client_id and a.status = 'confirmed' and a.starts_at > p_now)
    and not exists (select 1 from optyker_sheets s where s.client_id = x.client_id and s.archived_at is null and s.created_at > x.sent_at
                    and s.sheet_type = any (case x.kind when 'vista' then array['prescription','visualexam','protocol_ovc','protocol_ovc_bambini','analisi_visiva_integrata']
                                                        when 'udito' then array['hearing'] else array['lac'] end));
end $$;
revoke all on function public.optyker_wa_due_reminders(timestamptz) from public, anon, authenticated;

insert into public.optyker_wa_automations(kind,label,template,daily_limit,enabled)
values ('pronto','Avviso busta pronta per la consegna (solo se impostata a mano in laboratorio)','ordine_pronto',null,true)
on conflict (kind) do nothing;

create or replace function public.optyker_wa_due_ready(p_now timestamptz default now())
returns table(job_key text, kind text, client_id uuid, appointment_id uuid, phone text, template text, params jsonb, preview text)
language plpgsql stable security definer set search_path=public as $$
declare
  loc timestamp := p_now at time zone 'Europe/Rome';
  h numeric := extract(hour from loc) + extract(minute from loc)/60.0;
begin
  if h < 8 or h >= 21 then return; end if;
  return query
  select 'ready:' || w.id || ':' || extract(epoch from w.status_since)::bigint, 'pronto', w.client_id, null::uuid, c.phone, 'ordine_pronto',
    jsonb_build_array(case when w.order_type = 'lac_busta' then 'le tue lenti a contatto sono pronte' else 'il tuo occhiale è pronto' end),
    E'Buongiorno, siamo l''ottica di Lallio.\n*Ottica Visual Care*\n📍 Via Primo Maggio 4, 24040 Lallio (BG)\n\nCome stai? Volevamo avvisarti che '
      || case when w.order_type = 'lac_busta' then 'le tue lenti a contatto sono pronte' else 'il tuo occhiale è pronto' end
      || E'.\nPrenota tramite il link:\nhttps://optyker.it/booking/'
  from optyker_work_orders w
  join optyker_clients c on c.id = w.client_id
  join optyker_wa_automations a on a.kind = 'pronto' and a.enabled
  where w.status = 'pronto_consegna' and coalesce(w.manual_status, false)
    and w.order_type in ('eyewear_busta', 'lac_busta')
    and w.status_since >= a.active_since and w.status_since > p_now - interval '3 days'
    and coalesce(c.phone, '') <> ''
    and not exists (select 1 from optyker_wa_automation_log l where l.job_key = 'ready:' || w.id || ':' || extract(epoch from w.status_since)::bigint);
end $$;
revoke all on function public.optyker_wa_due_ready(timestamptz) from public, anon, authenticated;

-- In produzione optyker_wa_due (7 novembre) è stata rinominata in optyker_wa_due_main prima di questa definizione.
create or replace function public.optyker_wa_due(p_now timestamptz default now())
returns table(job_key text, kind text, client_id uuid, appointment_id uuid, phone text, template text, params jsonb, preview text)
language sql stable security definer set search_path=public as $$
  select * from optyker_wa_due_main(p_now)
  union all select * from optyker_wa_due_reminders(p_now)
  union all select * from optyker_wa_due_ready(p_now)
$$;
revoke all on function public.optyker_wa_due(timestamptz) from public, anon, authenticated;
