-- Assistente IA WhatsApp: il cliente viene riconosciuto dal numero da cui scrive, senza chiedere nome e cognome.
-- Ricerca più affidabile del numero WhatsApp nell'anagrafica Optyker:
--   * optyker_phone_key: numero da confrontare, senza 00 iniziale né prefisso 39 dei numeri internazionali.
--     Così si trovano anche i cellulari di 9 cifre (333 123456 ↔ WhatsApp 39333123456), prima esclusi.
--   * optyker_phone_keys_match / optyker_phone_match: stesso numero (chiave uguale, oppure ultime 10 cifre
--     uguali per i numeri lunghi).
--   * optyker_wa_ai_clients: cerca nel telefono e nel secondo telefono (home_phone) dell'anagrafica.
--   * optyker_wa_ai_appointments: appuntamenti di tutti i clienti collegati al numero.
--   * optyker_find_client_by_phone (chat WhatsApp nella scheda cliente): stessa regola, telefono principale prima.
-- Le funzioni sul numero sono semplici espressioni (incorporate nelle query) e ogni numero è calcolato una
-- sola volta per riga: una ricerca sull'intera anagrafica resta nell'ordine dei millisecondi.

create or replace function public.optyker_phone_key(p text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^00', ''), '^39(\d{9,})$', '\1')
$$;

create or replace function public.optyker_phone_keys_match(ka text, kb text)
returns boolean
language sql
immutable
parallel safe
as $$
  select length(ka) >= 9 and length(kb) >= 9
     and (ka = kb or (length(ka) >= 10 and length(kb) >= 10 and right(ka, 10) = right(kb, 10)))
$$;

create or replace function public.optyker_phone_match(a text, b text)
returns boolean
language sql
immutable
parallel safe
as $$
  select public.optyker_phone_keys_match(public.optyker_phone_key(a), public.optyker_phone_key(b))
$$;

create or replace function public.optyker_wa_ai_clients(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with v as materialized (select public.optyker_phone_key(p_phone) k),
  c as materialized (
    select c.id, c.name, c.surname, c.updated_at,
      public.optyker_phone_key(c.phone) kp, public.optyker_phone_key(c.home_phone) kh
    from public.optyker_clients c
  ),
  m as (
    select c.id, c.name, c.surname, c.updated_at,
      case when public.optyker_phone_keys_match(c.kp, v.k) then 0 else 1 end pri
    from c cross join v
    where public.optyker_phone_keys_match(c.kp, v.k) or public.optyker_phone_keys_match(c.kh, v.k)
    order by pri, c.updated_at desc nulls last
    limit 8
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'cliente_id', m.id,
           'nome', nullif(btrim(m.name), ''),
           'cognome', nullif(btrim(m.surname), '')
         ) order by m.pri, m.updated_at desc nulls last), '[]'::jsonb)
  from m;
$$;

drop function if exists public.optyker_wa_ai_appointments(text, uuid);

create or replace function public.optyker_wa_ai_appointments(p_phone text, p_clients uuid[] default '{}')
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with v as materialized (select public.optyker_phone_key(p_phone) k),
  a as materialized (
    select a.id, a.service_id, a.client_id, a.first_name, a.last_name, a.starts_at, a.ends_at,
      public.optyker_phone_key(a.phone) kp
    from public.optyker_appointments a
    where a.status <> 'cancelled' and a.starts_at > now()
  )
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
    from a
    join public.optyker_appointment_services s on s.id = a.service_id
    cross join v
    where a.client_id = any(coalesce(p_clients, '{}'::uuid[])) or public.optyker_phone_keys_match(a.kp, v.k)
    order by a.starts_at
    limit 8
  ) x;
$$;

revoke all on function public.optyker_wa_ai_appointments(text, uuid[]) from public, anon, authenticated;
grant execute on function public.optyker_wa_ai_appointments(text, uuid[]) to service_role;

create or replace function public.optyker_find_client_by_phone(p_phone text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v text := public.optyker_phone_key(p_phone); r uuid;
begin
  if length(v) < 9 then return null; end if;
  select x.id into r
  from (
    select c.id, c.updated_at, public.optyker_phone_key(c.phone) kp, public.optyker_phone_key(c.home_phone) kh
    from public.optyker_clients c
    offset 0
  ) x
  where public.optyker_phone_keys_match(x.kp, v) or public.optyker_phone_keys_match(x.kh, v)
  order by case when public.optyker_phone_keys_match(x.kp, v) then 0 else 1 end, x.updated_at desc nulls last
  limit 1;
  return r;
end;
$$;
