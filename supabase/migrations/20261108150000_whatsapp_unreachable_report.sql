-- Elenco dei messaggi automatici WhatsApp che non sono arrivati, inviato ogni giorno via email:
--   * numero di telefono non valido in anagrafica (messaggio non inviato);
--   * non raggiungibile su WhatsApp ("Message undeliverable": di solito il numero non ha WhatsApp);
--   * altri errori di invio o di consegna.
-- Per ogni riga: ora, tipo di messaggio, cliente, telefono e secondo telefono dell'anagrafica, motivo
-- (con un suggerimento se il cellulare ha 9 cifre o se è un numero fisso).
-- I mancati recapiti contano dall'ora in cui WhatsApp li segnala (può arrivare dopo l'invio): chiedendo
-- un giorno dopo l'altro nessuna segnalazione va persa o si ripete.
-- Solo per il server (contiene dati personali).

create or replace function public.optyker_wa_unreachable_report(p_from timestamptz, p_to timestamptz default now())
returns table (ora text, messaggio text, cliente text, telefono text, altro_telefono text, motivo text)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  with ev as (
    select l.client_id, l.appointment_id, l.kind, l.phone tried, coalesce(m.updated_at, l.sent_at, l.created_at) t,
      case when coalesce(m.error_text, '') ilike '%undeliverable%'
             then 'Non raggiungibile su WhatsApp (di solito il numero non ha WhatsApp)'
           else 'Non consegnato: ' || coalesce(nullif(m.error_text, ''), 'errore WhatsApp') end motivo
    from public.optyker_wa_automation_log l
    join public.optyker_whatsapp_messages m on m.wamid = l.wamid
    where l.status = 'sent' and m.status = 'failed'
      and coalesce(m.updated_at, l.sent_at, l.created_at) >= p_from
      and coalesce(m.updated_at, l.sent_at, l.created_at) < p_to
    union all
    select l.client_id, l.appointment_id, l.kind, l.phone, l.created_at,
      case when l.status = 'skipped' then 'Numero di telefono non valido in anagrafica'
           else 'Invio non riuscito: ' || coalesce(nullif(l.error, ''), 'errore') end
    from public.optyker_wa_automation_log l
    where l.status in ('skipped', 'failed') and l.created_at >= p_from and l.created_at < p_to
  )
  select to_char(ev.t at time zone 'Europe/Rome', 'DD/MM HH24:MI'),
    case ev.kind
      when 'vista' then 'Richiamo esame della vista'
      when 'udito' then 'Richiamo controllo udito'
      when 'lac_controllo' then 'Richiamo controllo lenti a contatto'
      when 'lac_riordino' then 'Richiamo riordino lenti a contatto'
      when 'conferma' then 'Conferma appuntamento'
      when 'promemoria' then 'Promemoria appuntamento'
      when 'compleanno' then 'Auguri di compleanno'
      when 'presbiopia' then 'Offerta presbiopia'
      when 'luce_blu' then 'Offerta luce blu'
      when 'pronto' then 'Avviso busta pronta'
      else coalesce(a.label, ev.kind) end,
    coalesce(nullif(btrim(concat_ws(' ', c.name, c.surname)), ''), nullif(btrim(concat_ws(' ', ap.first_name, ap.last_name)), ''), 'cliente non collegato'),
    coalesce(nullif(btrim(c.phone), ''), nullif(btrim(ap.phone), ''), '—'),
    coalesce(nullif(btrim(c.home_phone), ''), '—'),
    ev.motivo || case
      when public.optyker_phone_key(ev.tried) ~ '^3\d{8}$' then ' · il cellulare ha 9 cifre: controlla che non ne manchi una'
      when public.optyker_phone_key(ev.tried) ~ '^0' then ' · è un numero fisso'
      else '' end
  from ev
  left join public.optyker_wa_automations a on a.kind = ev.kind
  left join public.optyker_clients c on c.id = ev.client_id
  left join public.optyker_appointments ap on ap.id = ev.appointment_id
  order by ev.t;
$$;

revoke all on function public.optyker_wa_unreachable_report(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.optyker_wa_unreachable_report(timestamptz, timestamptz) to service_role;
