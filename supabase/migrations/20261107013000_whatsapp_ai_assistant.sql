-- Assistente IA su WhatsApp (360dialog, stesso numero dell'app WhatsApp Business).
-- Risponde da solo SOLO a: orari / indirizzo / contatti, stato di occhiali e lenti a contatto ordinati,
-- appuntamenti (vedere, prenotare, spostare, disdire) e lenti a contatto della scheda LAC
-- (prodotto e colore della lente destra / sinistra, se riportati). Per tutto il resto non risponde:
-- la chat resta all'operatore, che risponde dall'app WhatsApp Business o da Optyker.
--   * optyker_wa_ai_settings: interruttore generale, numeri di prova, modello, pause, testo del negozio.
--   * optyker_wa_ai_log: una riga per ogni messaggio ricevuto valutato dall'assistente (risposta o silenzio).
--   * funzioni optyker_wa_ai_*: dati in sola lettura per l'assistente, eseguibili solo dal server.
-- L'assistente parte SPENTO (enabled = false). Con test_phones valorizzato risponde solo a quei numeri.

create table if not exists public.optyker_wa_ai_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  test_phones text[] not null default '{}',
  model text not null default 'claude-sonnet-5-5',
  operator_pause_hours integer not null default 12 check (operator_pause_hours between 0 and 168),
  handoff_wait_hours integer not null default 48 check (handoff_wait_hours between 0 and 336),
  signature text not null default '_Assistente automatico · Ottica Visual Care_',
  store_info text not null default '',
  updated_by text,
  updated_at timestamptz not null default now()
);

comment on table public.optyker_wa_ai_settings is
  'Assistente IA WhatsApp: impostazioni (riga unica). enabled=false lo spegne; test_phones limita le risposte ai numeri indicati.';

insert into public.optyker_wa_ai_settings (id, store_info)
values (1, $info$Ottica Visual Care
Indirizzo: Via Primo Maggio 4, 24040 Lallio (BG)
Sito: https://otticavisualcare.it
WhatsApp: +39 331 357 6467 (questo numero)$info$)
on conflict (id) do nothing;

create table if not exists public.optyker_wa_ai_log (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  inbound_wamid text unique,
  client_id uuid,
  decision text not null default 'processing'
    check (decision in ('processing', 'reply', 'handoff', 'no_reply', 'skipped', 'error')),
  reason text,
  reply text,
  reply_wamid text,
  tool_calls jsonb not null default '[]'::jsonb,
  model text,
  usage jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.optyker_wa_ai_log is
  'Assistente IA WhatsApp: decisione per ogni messaggio ricevuto (reply = ha risposto, handoff = lasciato all''operatore, no_reply = nessuna risposta necessaria, skipped = operatore già attivo).';

create index if not exists optyker_wa_ai_log_phone_created_idx
  on public.optyker_wa_ai_log (phone, created_at desc);

alter table public.optyker_wa_ai_settings enable row level security;
alter table public.optyker_wa_ai_log enable row level security;
revoke all on table public.optyker_wa_ai_settings from anon, authenticated;
revoke all on table public.optyker_wa_ai_log from anon, authenticated;
grant select, insert, update on table public.optyker_wa_ai_settings to service_role;
grant select, insert, update on table public.optyker_wa_ai_log to service_role;

-- Clienti collegati al numero WhatsApp (stessa regola di optyker_find_client_by_phone: cifre uguali
-- oppure ultime 10 cifre uguali), più di uno se il numero è condiviso in famiglia.
create or replace function public.optyker_wa_ai_clients(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with v as (select public.optyker_phone_digits(p_phone) d)
  select coalesce(jsonb_agg(jsonb_build_object(
           'cliente_id', c.id,
           'nome', nullif(btrim(c.name), ''),
           'cognome', nullif(btrim(c.surname), '')
         ) order by c.updated_at desc nulls last), '[]'::jsonb)
  from (
    select c.*
    from public.optyker_clients c, v
    where length(v.d) >= 9
      and (public.optyker_phone_digits(c.phone) = v.d
           or right(public.optyker_phone_digits(c.phone), 10) = right(v.d, 10))
    order by c.updated_at desc nulls last
    limit 6
  ) c;
$$;

-- Orari settimanali del negozio e giorni con orario speciale nei prossimi 30 giorni (le note interne
-- dei giorni speciali non vengono passate).
create or replace function public.optyker_wa_ai_store_hours()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with names(n, nome) as (
    values (1, 'lunedì'), (2, 'martedì'), (3, 'mercoledì'), (4, 'giovedì'), (5, 'venerdì'), (6, 'sabato'), (7, 'domenica')
  ),
  week as (
    select n.n, n.nome,
      case when coalesce(h.active, false) and h.start_time is not null and h.end_time is not null and h.end_time > h.start_time then
        concat_ws(' e ',
          to_char(h.start_time, 'HH24:MI') || '-' || to_char(h.end_time, 'HH24:MI'),
          case when h.start_time_2 is not null and h.end_time_2 is not null and h.end_time_2 > h.start_time_2
               then to_char(h.start_time_2, 'HH24:MI') || '-' || to_char(h.end_time_2, 'HH24:MI') end)
      else 'chiuso' end orari
    from names n
    left join public.optyker_store_hours h on h.weekday = n.n
  ),
  special as (
    select o.schedule_date,
      case when coalesce(o.active, false) and o.start_time is not null and o.end_time is not null and o.end_time > o.start_time then
        concat_ws(' e ',
          to_char(o.start_time, 'HH24:MI') || '-' || to_char(o.end_time, 'HH24:MI'),
          case when o.start_time_2 is not null and o.end_time_2 is not null and o.end_time_2 > o.start_time_2
               then to_char(o.start_time_2, 'HH24:MI') || '-' || to_char(o.end_time_2, 'HH24:MI') end)
      else 'chiuso' end orari
    from public.optyker_store_day_schedule o
    where o.schedule_date between (now() at time zone 'Europe/Rome')::date
                              and (now() at time zone 'Europe/Rome')::date + 30
  )
  select jsonb_build_object(
    'settimana', (select jsonb_agg(jsonb_build_object('giorno', nome, 'orari', orari) order by n) from week),
    'giorni_speciali', coalesce((
      select jsonb_agg(jsonb_build_object(
               'data', to_char(schedule_date, 'YYYY-MM-DD'),
               'giorno', public.optyker_wa_it_date(schedule_date),
               'orari', orari) order by schedule_date)
      from special), '[]'::jsonb)
  );
$$;

-- Ordini di occhiali e lenti a contatto (buste di laboratorio) degli ultimi 12 mesi.
-- Lo stato "pronto_consegna" viene messo in automatico alla data prevista se nessuno lo cambia a mano:
-- stato_impostato_a_mano lo distingue.
create or replace function public.optyker_wa_ai_orders(p_client uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb)
  from (
    select w.created_at, jsonb_build_object(
      'riferimento', nullif(btrim(coalesce(w.reference_code, w.payload->>'reference_code')), ''),
      'tipo', case w.order_type when 'eyewear_busta' then 'occhiali' when 'lac_busta' then 'lenti a contatto' else w.order_type end,
      'descrizione', nullif(btrim(case
          when w.order_type = 'eyewear_busta' then concat_ws(' ', w.payload #>> '{snapshot,frame,brand}', w.payload #>> '{snapshot,frame,model}')
          else concat_ws(' · ',
                 nullif(btrim(w.payload #>> '{snapshot,lacState,brand}'), ''),
                 nullif(btrim(w.payload #>> '{snapshot,lacState,odProductName}'), ''),
                 nullif(btrim(w.payload #>> '{snapshot,lacState,osProductName}'), ''))
        end), ''),
      'stato', case
          when w.status in ('da_fare', 'in_preparazione', 'costruzione') then 'in_lavorazione'
          when w.status = 'pronto_consegna' then 'pronto_per_il_ritiro'
          when w.status = 'completato' then 'consegnato'
          when w.status = 'annullato' then 'annullato'
          else 'sconosciuto' end,
      'stato_dal', to_char(w.status_since at time zone 'Europe/Rome', 'YYYY-MM-DD'),
      'giorni_nello_stato', greatest(0, ((now() at time zone 'Europe/Rome')::date - (w.status_since at time zone 'Europe/Rome')::date)),
      'data_prevista_pronto', to_char(w.auto_ready_at at time zone 'Europe/Rome', 'YYYY-MM-DD'),
      'stato_impostato_a_mano', coalesce(w.manual_status, false),
      'ordinato_il', to_char(w.created_at at time zone 'Europe/Rome', 'YYYY-MM-DD')
    ) j
    from public.optyker_work_orders w
    where w.client_id = p_client
      and w.created_at > now() - interval '12 months'
    order by w.created_at desc
    limit 5
  ) x;
$$;

-- Appuntamenti futuri non annullati del cliente o prenotati con questo numero.
create or replace function public.optyker_wa_ai_appointments(p_phone text, p_client uuid default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with v as (select public.optyker_phone_digits(p_phone) d)
  select coalesce(jsonb_agg(x.j order by x.starts_at), '[]'::jsonb)
  from (
    select a.starts_at, jsonb_build_object(
      'appuntamento_id', a.id,
      'servizio', s.name,
      'servizio_id', a.service_id,
      'giorno', public.optyker_wa_it_date((a.starts_at at time zone 'Europe/Rome')::date),
      'data', to_char(a.starts_at at time zone 'Europe/Rome', 'YYYY-MM-DD'),
      'ora', to_char(a.starts_at at time zone 'Europe/Rome', 'HH24:MI'),
      'fine', to_char(a.ends_at at time zone 'Europe/Rome', 'HH24:MI'),
      'intestato_a', nullif(btrim(concat_ws(' ', a.first_name, a.last_name)), ''),
      'cliente_id', a.client_id
    ) j
    from public.optyker_appointments a
    join public.optyker_appointment_services s on s.id = a.service_id
    cross join v
    where a.status <> 'cancelled'
      and a.starts_at > now()
      and ((p_client is not null and a.client_id = p_client)
           or (length(v.d) >= 9 and right(public.optyker_phone_digits(a.phone), 10) = right(v.d, 10)))
    order by a.starts_at
    limit 6
  ) x;
$$;

-- Lenti a contatto della scheda LAC: le 2 schede più recenti che non siano preventivi né segnate come
-- "prova". Prodotto e colore di lente destra (OD) e sinistra (OS) solo se scritti nella scheda.
create or replace function public.optyker_wa_ai_lac(p_client uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(x.j order by x.d desc nulls last, x.updated_at desc), '[]'::jsonb)
  from (
    select y.d, y.updated_at, jsonb_build_object(
      'documento', y.documento,
      'data_scheda', to_char(y.d, 'YYYY-MM-DD'),
      'marca', y.marca,
      'lente_destra', y.od,
      'lente_sinistra', y.os,
      'colore_lente_destra', y.od_color,
      'colore_lente_sinistra', y.os_color
    ) j
    from (
      select s.updated_at,
        coalesce(nullif(btrim(s.document_type), ''), nullif(btrim(s.data->>'documentType'), ''), 'Scheda LAC') documento,
        coalesce(optyker_private.recall_date(s.data #>> '{elements,lacDate,value}'),
                 optyker_private.recall_date(s.data->>'examDate'),
                 (s.created_at at time zone 'Europe/Rome')::date) d,
        nullif(btrim(s.data #>> '{lacState,brand}'), '') marca,
        coalesce(nullif(btrim(s.data #>> '{lacState,odProductName}'), ''), nullif(btrim(s.data #>> '{elements,lacOdProduct,value}'), '')) od,
        coalesce(nullif(btrim(s.data #>> '{lacState,osProductName}'), ''), nullif(btrim(s.data #>> '{elements,lacOsProduct,value}'), '')) os,
        nullif(btrim(s.data #>> '{elements,lacOdColor,value}'), '') od_color,
        nullif(btrim(s.data #>> '{elements,lacOsColor,value}'), '') os_color
      from public.optyker_sheets s
      where s.client_id = p_client
        and s.sheet_type = 'lac'
        and s.archived_at is null
        and lower(coalesce(nullif(btrim(s.document_type), ''), s.data->>'documentType', '')) <> 'preventivo'
        and lower(coalesce(s.data->>'lacProductStage', '')) <> 'trial'
    ) y
    order by y.d desc nulls last, y.updated_at desc
    limit 2
  ) x;
$$;

revoke all on function public.optyker_wa_ai_clients(text) from public, anon, authenticated;
revoke all on function public.optyker_wa_ai_store_hours() from public, anon, authenticated;
revoke all on function public.optyker_wa_ai_orders(uuid) from public, anon, authenticated;
revoke all on function public.optyker_wa_ai_appointments(text, uuid) from public, anon, authenticated;
revoke all on function public.optyker_wa_ai_lac(uuid) from public, anon, authenticated;
grant execute on function public.optyker_wa_ai_clients(text) to service_role;
grant execute on function public.optyker_wa_ai_store_hours() to service_role;
grant execute on function public.optyker_wa_ai_orders(uuid) to service_role;
grant execute on function public.optyker_wa_ai_appointments(text, uuid) to service_role;
grant execute on function public.optyker_wa_ai_lac(uuid) to service_role;
