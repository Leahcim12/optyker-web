-- Report «Visite senza scheda» (26/11/2026)
-- Clienti venuti per un'analisi visiva o per una visita specialistica per lenti a contatto (agenda, ultimi 12 mesi,
-- appuntamenti non annullati e già iniziati) per i quali, dal giorno della visita, non è stata creata nessuna scheda
-- occhiali (Busta) o lenti a contatto (scheda/Busta LAC). I preventivi non contano come scheda: compaiono come nota.
-- Un cliente compare una volta sola, con la visita più recente; i giorni passati danno il colore
-- (verde fino a 7, arancione fino a 14, rosso oltre). Gli appuntamenti senza cliente collegato si abbinano
-- all'anagrafica dal telefono, dall'email o da nome e cognome; se non si trova un cliente sicuro restano col nome
-- dell'appuntamento («non in anagrafica»).
-- «Elimina» toglie il cliente dall'elenco per tutti gli operatori: vale per quella visita, con una visita successiva
-- ricompare. «Ripristina» lo rimette. Lettura e scritture solo tramite public.optyker_visit_followup_api
-- (stesse credenziali delle altre API Optyker). Nessun dato esistente viene modificato.

create table if not exists public.optyker_visit_followup_dismissals (
  id uuid primary key default gen_random_uuid(),
  person_key text not null,
  client_id uuid references public.optyker_clients(id) on delete set null,
  appointment_id uuid,
  visit_at timestamptz not null,
  dismissed_by text not null default '',
  dismissed_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by text
);

comment on table public.optyker_visit_followup_dismissals is
  'Report «Visite senza scheda»: clienti tolti dall''elenco da un operatore (per tutti). Vale per la visita indicata (visit_at): con una visita successiva il cliente ricompare. «Ripristina» imposta restored_at. Scritture solo tramite optyker_visit_followup_api.';

create index if not exists optyker_visit_followup_dismissals_person_idx
  on public.optyker_visit_followup_dismissals (person_key) where restored_at is null;
create index if not exists optyker_visit_followup_dismissals_appointment_idx
  on public.optyker_visit_followup_dismissals (appointment_id) where restored_at is null;

alter table public.optyker_visit_followup_dismissals enable row level security;
revoke all on table public.optyker_visit_followup_dismissals from anon, authenticated;
grant select, insert, update on table public.optyker_visit_followup_dismissals to service_role;

-- Nome confrontabile: minuscole, senza accenti, spazi, apostrofi e punteggiatura.
create or replace function optyker_private.visit_followup_norm(p text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select regexp_replace(
           translate(lower(btrim(coalesce(p, ''))), 'àáâäèéêëìíîïòóôöùúûüçñ', 'aaaaeeeeiiiioooouuuucn'),
           '[^a-z0-9]+', '', 'g')
$$;

-- Ultime 9 cifre del numero (uguali con o senza +39, spazi o trattini); null se le cifre sono meno di 9.
create or replace function optyker_private.visit_followup_phone(p text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 9
              then right(regexp_replace(p, '\D', '', 'g'), 9) end
$$;

create or replace function optyker_private.visit_followup_items()
returns table (
  person_key text,
  client_id uuid,
  match text,
  appointment_id uuid,
  visit_at timestamptz,
  visit_day date,
  days integer,
  service text,
  operator text,
  first_name text,
  last_name text,
  phone text,
  email text,
  earlier jsonb,
  quote jsonb,
  next_appointment jsonb
)
language sql
stable
set search_path = public, optyker_private, pg_temp
as $$
  with svc as (
    select s.id, s.name
      from public.optyker_appointment_services s
     where optyker_private.visit_followup_norm(s.name) like 'analisivisiva%'
        or (optyker_private.visit_followup_norm(s.name) like 'visita%'
            and optyker_private.visit_followup_norm(s.name) like '%specialistic%'
            and optyker_private.visit_followup_norm(s.name) like '%lentiacontatto%')
  ),
  ap as (
    select a.id,
           a.client_id,
           a.starts_at,
           (a.starts_at at time zone 'Europe/Rome')::date as vday,
           btrim(coalesce(a.operator_username, '')) as operator,
           btrim(coalesce(a.first_name, '')) as first_name,
           btrim(coalesce(a.last_name, '')) as last_name,
           btrim(coalesce(a.phone, '')) as phone,
           btrim(coalesce(a.email, '')) as email,
           s.name as service,
           optyker_private.visit_followup_phone(a.phone) as ph,
           nullif(lower(btrim(coalesce(a.email, ''))), '') as em,
           optyker_private.visit_followup_norm(a.first_name) as nm,
           optyker_private.visit_followup_norm(a.last_name) as sn
      from public.optyker_appointments a
      join svc s on s.id = a.service_id
     where coalesce(a.status, '') <> 'cancelled'
       and a.starts_at <= now()
       and a.starts_at > now() - interval '365 days'
  ),
  cl as (
    select c.id,
           optyker_private.visit_followup_phone(c.phone) as p1,
           optyker_private.visit_followup_phone(c.home_phone) as p2,
           nullif(lower(btrim(coalesce(c.email, ''))), '') as em,
           optyker_private.visit_followup_norm(c.name) as nm,
           optyker_private.visit_followup_norm(c.surname) as sn
      from public.optyker_clients c
  ),
  -- Clienti possibili per gli appuntamenti senza cliente collegato.
  -- score 2: nome e cognome uguali (anche invertiti); 1: stesse prime 3 lettere di nome e cognome; 0: nome diverso
  -- (stesso telefono di un familiare: non si abbina).
  cand as (
    select ap.id as appt_id,
           cl.id as client_id,
           case when ap.ph is not null and (cl.p1 = ap.ph or cl.p2 = ap.ph) then 'telefono'
                when ap.em is not null and cl.em = ap.em then 'email'
                else 'nome' end as how,
           case when ap.sn = '' or ap.nm = '' then 0
                when (cl.sn = ap.sn and cl.nm = ap.nm) or (cl.sn = ap.nm and cl.nm = ap.sn) then 2
                when (left(cl.sn, 3) = left(ap.sn, 3) and left(cl.nm, 3) = left(ap.nm, 3))
                  or (left(cl.sn, 3) = left(ap.nm, 3) and left(cl.nm, 3) = left(ap.sn, 3)) then 1
                else 0 end as score
      from ap
      join cl on (ap.ph is not null and (cl.p1 = ap.ph or cl.p2 = ap.ph))
              or (ap.em is not null and cl.em = ap.em)
              or (ap.sn <> '' and ap.nm <> ''
                  and ((cl.sn = ap.sn and cl.nm = ap.nm) or (cl.sn = ap.nm and cl.nm = ap.sn)))
     where ap.client_id is null
  ),
  -- Un solo cliente sicuro: prima telefono/email con nome uguale, poi con nome simile, infine nome e cognome
  -- uguali a un solo cliente in anagrafica. Altrimenti nessun abbinamento.
  pick as (
    select c.appt_id,
           case
             when count(distinct c.client_id) filter (where c.how <> 'nome' and c.score = 2) = 1
               then (array_agg(c.client_id) filter (where c.how <> 'nome' and c.score = 2))[1]
             when count(distinct c.client_id) filter (where c.how <> 'nome' and c.score = 2) = 0
              and count(distinct c.client_id) filter (where c.how <> 'nome' and c.score = 1) = 1
               then (array_agg(c.client_id) filter (where c.how <> 'nome' and c.score = 1))[1]
             when count(distinct c.client_id) filter (where c.how <> 'nome' and c.score >= 1) = 0
              and count(distinct c.client_id) filter (where c.how = 'nome') = 1
               then (array_agg(c.client_id) filter (where c.how = 'nome'))[1]
           end as client_id
      from cand c
     group by c.appt_id
  ),
  res as (
    select ap.*,
           cli.id as rclient,
           case when cli.id is null then null
                when ap.client_id is not null then 'agenda'
                else (select x.how from cand x
                       where x.appt_id = ap.id and x.client_id = cli.id
                       order by case x.how when 'telefono' then 1 when 'email' then 2 else 3 end
                       limit 1) end as match
      from ap
      left join pick p on p.appt_id = ap.id
      left join public.optyker_clients cli on cli.id = coalesce(ap.client_id, p.client_id)
  ),
  pk as (
    select r.*,
           least(r.sn, r.nm) || ':' || greatest(r.sn, r.nm) as name_key,
           case when r.rclient is not null then 'c:' || r.rclient::text
                when r.ph is not null then 'p:' || r.ph || ':' || least(r.sn, r.nm) || ':' || greatest(r.sn, r.nm)
                when r.em is not null then 'e:' || r.em
                when r.sn || r.nm <> '' then 'n:' || least(r.sn, r.nm) || ':' || greatest(r.sn, r.nm)
                else 'a:' || r.id::text end as person_key
      from res r
  ),
  sh as (
    select s.client_id,
           s.created_at,
           (s.created_at at time zone 'Europe/Rome')::date as sday,
           case when s.sheet_type = 'eyewear_job' then 'eyewear'
                when s.sheet_type = 'lac' and coalesce(s.document_type, '') <> 'Preventivo' then 'lac'
                when s.sheet_type = 'eyewear_quote' then 'eyewear_quote'
                else 'lac_quote' end as kind
      from public.optyker_sheets s
     where s.client_id is not null
       and s.sheet_type in ('eyewear_job', 'lac', 'eyewear_quote', 'lac_quote')
  ),
  person as (
    select k.person_key,
           (array_agg(k.rclient order by k.starts_at desc))[1] as client_id,
           (array_agg(k.match order by k.starts_at desc))[1] as match,
           (array_agg(k.id order by k.starts_at desc))[1] as appointment_id,
           max(k.starts_at) as visit_at,
           (array_agg(k.vday order by k.starts_at desc))[1] as visit_day,
           (array_agg(k.service order by k.starts_at desc))[1] as service,
           (array_agg(k.operator order by k.starts_at desc))[1] as operator,
           (array_agg(k.first_name order by k.starts_at desc))[1] as first_name,
           (array_agg(k.last_name order by k.starts_at desc))[1] as last_name,
           (array_agg(k.phone order by k.starts_at desc))[1] as phone,
           (array_agg(k.email order by k.starts_at desc))[1] as email,
           (array_agg(k.ph order by k.starts_at desc))[1] as ph,
           (array_agg(k.name_key order by k.starts_at desc))[1] as name_key,
           jsonb_agg(jsonb_build_object('id', k.id, 'at', k.starts_at, 'day', k.vday,
                                        'service', k.service, 'operator', k.operator)
                     order by k.starts_at desc) as visits
      from pk k
     group by k.person_key
  )
  select p.person_key,
         p.client_id,
         p.match,
         p.appointment_id,
         p.visit_at,
         p.visit_day,
         ((now() at time zone 'Europe/Rome')::date - p.visit_day)::int as days,
         p.service,
         p.operator,
         p.first_name,
         p.last_name,
         p.phone,
         p.email,
         -- Altre visite dopo l'ultima scheda, oltre alla più recente.
         coalesce((select jsonb_agg(v.x order by v.x->>'at' desc)
                     from jsonb_array_elements(p.visits) as v(x)
                    where (v.x->>'id')::uuid <> p.appointment_id
                      and (v.x->>'day')::date > coalesce(last_sheet.sday, '-infinity'::date)), '[]'::jsonb) as earlier,
         q.quote,
         nx.next_appointment
    from person p
    left join lateral (
      select max(sh.sday) as sday
        from sh
       where sh.client_id = p.client_id and sh.kind in ('eyewear', 'lac')
    ) last_sheet on true
    left join lateral (
      select jsonb_build_object('kind', sh.kind, 'day', sh.sday) as quote
        from sh
       where sh.client_id = p.client_id
         and sh.kind in ('eyewear_quote', 'lac_quote')
         and sh.sday >= p.visit_day
       order by sh.created_at desc
       limit 1
    ) q on true
    left join lateral (
      select jsonb_build_object('at', a.starts_at, 'service', coalesce(s.name, '')) as next_appointment
        from public.optyker_appointments a
        left join public.optyker_appointment_services s on s.id = a.service_id
       where a.starts_at > now()
         and coalesce(a.status, '') <> 'cancelled'
         and ((p.client_id is not null and a.client_id = p.client_id)
              or (p.ph is not null
                  and optyker_private.visit_followup_phone(a.phone) = p.ph
                  and least(optyker_private.visit_followup_norm(a.last_name), optyker_private.visit_followup_norm(a.first_name))
                      || ':' || greatest(optyker_private.visit_followup_norm(a.last_name), optyker_private.visit_followup_norm(a.first_name))
                      = p.name_key))
       order by a.starts_at
       limit 1
    ) nx on true
   where last_sheet.sday is null or last_sheet.sday < p.visit_day
$$;

create or replace function optyker_private.visit_followup_handle(p_user text, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
set search_path = public, optyker_private, pg_temp
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_key text := btrim(coalesce(v_payload->>'person_key', ''));
  v_item record;
  v_row record;
  v_appt uuid;
  v_count int;
  v_data jsonb;
begin
  if p_action in ('summary', 'list') then
    with items as (
      select i.*,
             case when i.days <= 7 then 'green' when i.days <= 14 then 'orange' else 'red' end as color,
             d.id as dismissal_id,
             d.dismissed_by,
             d.dismissed_at
        from optyker_private.visit_followup_items() i
        left join lateral (
          select x.id, x.dismissed_by, x.dismissed_at
            from public.optyker_visit_followup_dismissals x
           where x.restored_at is null
             and (x.person_key = i.person_key or x.appointment_id = i.appointment_id)
             and x.visit_at >= i.visit_at
           order by x.dismissed_at desc
           limit 1
        ) d on true
    )
    select case when p_action = 'summary' then
             jsonb_build_object(
               'pending', count(*) filter (where it.dismissal_id is null),
               'green', count(*) filter (where it.dismissal_id is null and it.color = 'green'),
               'orange', count(*) filter (where it.dismissal_id is null and it.color = 'orange'),
               'red', count(*) filter (where it.dismissal_id is null and it.color = 'red'),
               'dismissed', count(*) filter (where it.dismissal_id is not null))
           else
             jsonb_build_object(
               'today', (now() at time zone 'Europe/Rome')::date,
               'rows', coalesce(jsonb_agg(jsonb_build_object(
                 'person_key', it.person_key,
                 'client_id', it.client_id,
                 'linked', it.client_id is not null,
                 'match', coalesce(it.match, ''),
                 'name', case when it.client_id is not null then coalesce(cl.name, '') else it.first_name end,
                 'surname', case when it.client_id is not null then coalesce(cl.surname, '') else it.last_name end,
                 'phone', coalesce(nullif(btrim(cl.phone), ''), it.phone),
                 'home_phone', coalesce(btrim(cl.home_phone), ''),
                 'other_phone', case when it.client_id is not null
                                      and optyker_private.visit_followup_phone(it.phone) is not null
                                      and optyker_private.visit_followup_phone(it.phone) is distinct from optyker_private.visit_followup_phone(cl.phone)
                                      and optyker_private.visit_followup_phone(it.phone) is distinct from optyker_private.visit_followup_phone(cl.home_phone)
                                     then it.phone else '' end,
                 'email', coalesce(nullif(btrim(cl.email), ''), it.email),
                 'birth', coalesce(cl.birth, ''),
                 'city', coalesce(cl.city, ''),
                 'client_ref', coalesce(cl.reference_code, ''),
                 'appointment_id', it.appointment_id,
                 'visit_at', it.visit_at,
                 'visit_day', it.visit_day,
                 'days', it.days,
                 'color', it.color,
                 'service', it.service,
                 'operator', it.operator,
                 'earlier', it.earlier,
                 'quote', it.quote,
                 'next', it.next_appointment,
                 'dismissed', it.dismissal_id is not null,
                 'dismissed_by', coalesce(it.dismissed_by, ''),
                 'dismissed_at', it.dismissed_at)
                 order by it.visit_at desc, lower(coalesce(cl.surname, it.last_name, '')), it.person_key), '[]'::jsonb))
           end
      into v_data
      from items it
      left join public.optyker_clients cl on cl.id = it.client_id;
    return jsonb_build_object('ok', true, 'data', v_data);

  elsif p_action = 'dismiss' then
    if v_key = '' then
      return jsonb_build_object('ok', false, 'error', 'Cliente non valido');
    end if;
    select i.* into v_item from optyker_private.visit_followup_items() i where i.person_key = v_key;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Il cliente non è più nell''elenco: premi Aggiorna.');
    end if;
    select x.id, x.dismissed_by, x.dismissed_at into v_row
      from public.optyker_visit_followup_dismissals x
     where x.restored_at is null
       and (x.person_key = v_item.person_key or x.appointment_id = v_item.appointment_id)
       and x.visit_at >= v_item.visit_at
     order by x.dismissed_at desc
     limit 1;
    if not found then
      insert into public.optyker_visit_followup_dismissals (person_key, client_id, appointment_id, visit_at, dismissed_by)
      values (v_item.person_key, v_item.client_id, v_item.appointment_id, v_item.visit_at, coalesce(p_user, ''))
      returning id, dismissed_by, dismissed_at into v_row;
    end if;
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'person_key', v_item.person_key, 'dismissed_by', v_row.dismissed_by, 'dismissed_at', v_row.dismissed_at));

  elsif p_action = 'restore' then
    if v_key = '' then
      return jsonb_build_object('ok', false, 'error', 'Cliente non valido');
    end if;
    select i.appointment_id into v_appt from optyker_private.visit_followup_items() i where i.person_key = v_key;
    update public.optyker_visit_followup_dismissals x
       set restored_at = now(), restored_by = coalesce(p_user, '')
     where x.restored_at is null
       and (x.person_key = v_key or (v_appt is not null and x.appointment_id = v_appt));
    get diagnostics v_count = row_count;
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('person_key', v_key, 'restored', v_count));
  end if;

  return jsonb_build_object('ok', false, 'error', 'Azione non riconosciuta');
end
$$;

create or replace function public.optyker_visit_followup_api(
  p_username text,
  p_password text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, optyker_private, pg_temp
as $$
declare
  v_login jsonb;
begin
  v_login := public.optyker_staff_login_internal(p_username, p_password);
  if coalesce((v_login->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'auth', false, 'error', coalesce(v_login->>'error', 'Operatore non autorizzato'));
  end if;
  begin
    return optyker_private.visit_followup_handle(v_login->>'username', p_action, p_payload);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
end
$$;

revoke all on function optyker_private.visit_followup_norm(text) from public, anon, authenticated;
revoke all on function optyker_private.visit_followup_phone(text) from public, anon, authenticated;
revoke all on function optyker_private.visit_followup_items() from public, anon, authenticated;
revoke all on function optyker_private.visit_followup_handle(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.optyker_visit_followup_api(text, text, text, jsonb) from public;
grant execute on function public.optyker_visit_followup_api(text, text, text, jsonb) to anon, authenticated, service_role;
