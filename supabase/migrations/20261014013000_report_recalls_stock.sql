-- Report (voce "Report" nella barra laterale degli account Optyker): richiami del mese e giacenze.
--   * Analisi visive: clienti la cui ultima analisi visiva (prescrizione optometrica, esame visivo o
--     anomalie visive) è di 24 mesi prima del mese scelto.
--   * Scadenze LAC: "Data richiamo scheda per riordino" della scheda LAC più recente che la riporta.
--   * Controlli LAC: "Data controllo" della scheda LAC più recente che la riporta.
--   * Udito: "Data richiamo controllo" della scheda Udito più recente; se vuota, 12 mesi dopo l'esame.
--   * "Chiamato": il cliente esce dall'elenco di quel mese per tutti gli operatori (optyker_recall_calls);
--     "Ripristina" lo rimette nell'elenco (annullamento logico, nessuna riga cancellata).
--   * Giacenze: articoli attivi del magazzino Optyker (esclusi i servizi) con quantità diversa da zero.
--     Il costo riservato è restituito solo a Michael Mologni, come nel Magazzino.
-- Le schede annullate (archived_at) non contano. Accesso solo tramite optyker_report_api: la password
-- è verificata da optyker_staff_login_internal (blocco dopo 5 tentativi errati).

create table if not exists public.optyker_recall_calls (
  id uuid primary key default gen_random_uuid(),
  recall_type text not null check (recall_type in ('lac_reorder', 'vision', 'lac_control', 'hearing')),
  client_id uuid not null,
  due_month date not null check (extract(day from due_month) = 1),
  called_by text not null default '',
  called_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by text
);

comment on table public.optyker_recall_calls is
  'Report: clienti già chiamati per un richiamo del mese. Scritture solo tramite optyker_report_api.';

create unique index if not exists optyker_recall_calls_active_uidx
  on public.optyker_recall_calls (recall_type, client_id, due_month)
  where removed_at is null;

create index if not exists optyker_recall_calls_month_idx
  on public.optyker_recall_calls (due_month, recall_type);

alter table public.optyker_recall_calls enable row level security;
revoke all on table public.optyker_recall_calls from anon, authenticated;
grant select, insert, update on table public.optyker_recall_calls to service_role;

-- Date scritte nelle schede: gg/mm/aaaa (anche con - o .) oppure aaaa-mm-gg. Null se non valida.
create or replace function optyker_private.recall_date(p text)
returns date
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  m text[];
  y int;
  mo int;
  d int;
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  m := regexp_match(btrim(p), '^(\d{4})-(\d{1,2})-(\d{1,2})');
  if m is not null then
    y := m[1]::int; mo := m[2]::int; d := m[3]::int;
  else
    m := regexp_match(btrim(p), '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})');
    if m is null then
      return null;
    end if;
    d := m[1]::int; mo := m[2]::int; y := m[3]::int;
  end if;
  if y < 1900 or y > 2200 or mo < 1 or mo > 12 or d < 1
     or d > extract(day from (make_date(y, mo, 1) + interval '1 month' - interval '1 day'))::int then
    return null;
  end if;
  return make_date(y, mo, d);
end
$$;

-- Prodotto LAC della scheda ("Ortok — 700,00 €/occhio" -> "Ortok"); OD e OS se diversi.
create or replace function optyker_private.recall_lac_product(p_data jsonb)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  with x as (
    select nullif(btrim(split_part(coalesce(p_data->'lacState'->>'odProductName', ''), ' — ', 1)), '') as od,
           nullif(btrim(split_part(coalesce(p_data->'lacState'->>'osProductName', ''), ' — ', 1)), '') as os
  )
  select case
           when x.od is null and x.os is null then ''
           when x.od is not null and x.os is not null and lower(x.od) <> lower(x.os) then 'OD ' || x.od || ' · OS ' || x.os
           else coalesce(x.od, x.os)
         end
    from x
$$;

-- Un richiamo per cliente e per tipo, con la data in cui va fatto.
create or replace function optyker_private.recall_items(p_type text)
returns table (
  client_id uuid,
  due_date date,
  base_date date,
  sheet_id uuid,
  sheet_label text,
  sheet_ref text,
  detail text,
  operator text
)
language sql
stable
set search_path = public, optyker_private, pg_temp
as $$
  with vision_sheets as (
    select s.id, s.client_id, s.created_at, s.data, s.title, s.operator,
           (s.created_at at time zone 'Europe/Rome')::date as created_day,
           optyker_private.recall_date(coalesce(nullif(btrim(s.data->>'examDate'), ''),
                                                s.data->'elements'->'examDate'->>'value')) as exam_day
      from public.optyker_sheets s
     where p_type = 'vision'
       and s.sheet_type in ('prescription', 'visualexam', 'analysis')
       and s.archived_at is null
       and s.client_id is not null
  ), vision_dated as (
    select v.*,
           case when v.exam_day between date '1990-01-01' and v.created_day + 1 then v.exam_day else v.created_day end as visit_day
      from vision_sheets v
  ), vision_last as (
    select distinct on (v.client_id) v.*
      from vision_dated v
     order by v.client_id, v.visit_day desc, v.created_at desc
  ), lac_sheets as (
    select s.id, s.client_id, s.created_at, s.data, s.document_type, s.operator,
           coalesce(optyker_private.recall_date(s.data->'elements'->'lacDate'->>'value'),
                    optyker_private.recall_date(s.data->>'examDate'),
                    (s.created_at at time zone 'Europe/Rome')::date) as sheet_day,
           optyker_private.recall_date(
             s.data->'elements'->(case when p_type = 'lac_reorder' then 'lacReorderRecallDate' else 'lacControlDate' end)->>'value'
           ) as due_day
      from public.optyker_sheets s
     where p_type in ('lac_reorder', 'lac_control')
       and s.sheet_type = 'lac'
       and s.archived_at is null
       and s.client_id is not null
  ), lac_last as (
    select distinct on (l.client_id) l.*
      from lac_sheets l
     where l.due_day is not null
     order by l.client_id, l.sheet_day desc, l.created_at desc
  ), hearing_sheets as (
    select s.id, s.client_id, s.created_at, s.data, s.operator,
           (s.created_at at time zone 'Europe/Rome')::date as created_day,
           coalesce(optyker_private.recall_date(s.data->'elements'->'hearingExamDate'->>'value'),
                    optyker_private.recall_date(s.data->>'examDate')) as exam_day,
           optyker_private.recall_date(s.data->'elements'->'hearingRecallDate'->>'value') as recall_day
      from public.optyker_sheets s
     where p_type = 'hearing'
       and s.sheet_type = 'hearing'
       and s.archived_at is null
       and s.client_id is not null
  ), hearing_dated as (
    select h.*,
           case when h.exam_day between date '1990-01-01' and h.created_day + 1 then h.exam_day else h.created_day end as visit_day
      from hearing_sheets h
  ), hearing_last as (
    select distinct on (h.client_id) h.*
      from hearing_dated h
     order by h.client_id, h.visit_day desc, h.created_at desc
  )
  select v.client_id,
         (v.visit_day + interval '24 months')::date,
         v.visit_day,
         v.id,
         coalesce(nullif(btrim(v.data->>'sheetLabel'), ''), nullif(btrim(v.title), ''), 'Analisi visiva'),
         ''::text,
         ''::text,
         coalesce(nullif(btrim(v.operator), ''), nullif(btrim(v.data->>'specialist'), ''), '')
    from vision_last v
  union all
  select l.client_id,
         l.due_day,
         l.sheet_day,
         l.id,
         coalesce(nullif(btrim(l.document_type), ''), 'Scheda LAC'),
         coalesce(nullif(btrim(l.data->'elements'->'lacReference'->>'value'), ''), ''),
         optyker_private.recall_lac_product(l.data),
         coalesce(nullif(btrim(l.data->'elements'->'specialistName'->>'value'), ''), nullif(btrim(l.operator), ''),
                  nullif(btrim(l.data->>'specialist'), ''), '')
    from lac_last l
  union all
  select h.client_id,
         coalesce(h.recall_day, (h.visit_day + interval '12 months')::date),
         h.visit_day,
         h.id,
         'Udito'::text,
         ''::text,
         concat_ws(' · ',
           case when nullif(btrim(h.data->'elements'->'hearingProsthesis'->>'value'), '') is not null
                then 'protesi ' || lower(btrim(h.data->'elements'->'hearingProsthesis'->>'value')) end,
           nullif(btrim(h.data->'elements'->'hearingDiagnosis'->>'value'), ''),
           case when h.recall_day is null then 'richiamo a 12 mesi dall''esame' end),
         coalesce(nullif(btrim(h.data->'elements'->'hearingOperatorName'->>'value'), ''), nullif(btrim(h.operator), ''), '')
    from hearing_last h
$$;

-- Logica del Report, già con l'operatore verificato (chiamata solo da optyker_report_api).
create or replace function optyker_private.report_handle(p_user text, p_action text, p_payload jsonb)
returns jsonb
language plpgsql
set search_path = public, optyker_private, pg_temp
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_year int;
  v_month_no int;
  v_month date;
  v_next date;
  v_type text := nullif(btrim(coalesce(p_payload->>'type', '')), '');
  v_types text[] := array['lac_reorder', 'vision', 'lac_control', 'hearing'];
  v_client uuid;
  v_cost boolean := btrim(coalesce(p_user, '')) ~* '^michael(\s+mologni)?$';
  v_unlimited int := 500;
  v_row record;
  v_data jsonb;
begin
  if p_action in ('overview', 'recalls', 'mark_called', 'unmark_called') then
    if coalesce(v_payload->>'year', '') !~ '^\d{0,4}$' or coalesce(v_payload->>'month', '') !~ '^\d{0,2}$' then
      return jsonb_build_object('ok', false, 'error', 'Mese non valido');
    end if;
    v_year := coalesce(nullif(v_payload->>'year', '')::int, extract(year from v_today)::int);
    v_month_no := coalesce(nullif(v_payload->>'month', '')::int, extract(month from v_today)::int);
    if v_year < 2000 or v_year > 2100 or v_month_no < 1 or v_month_no > 12 then
      return jsonb_build_object('ok', false, 'error', 'Mese non valido');
    end if;
    v_month := make_date(v_year, v_month_no, 1);
    v_next := (v_month + interval '1 month')::date;
  end if;

  if p_action in ('recalls', 'mark_called', 'unmark_called')
     and (v_type is null or not (v_type = any (v_types))) then
    return jsonb_build_object('ok', false, 'error', 'Tipo di richiamo non valido');
  end if;

  if p_action in ('mark_called', 'unmark_called') then
    if coalesce(v_payload->>'client_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok', false, 'error', 'Cliente non valido');
    end if;
    v_client := (v_payload->>'client_id')::uuid;
  end if;

  if p_action = 'overview' then
    select jsonb_object_agg(t.k, jsonb_build_object('pending', c.pending, 'called', c.called))
      into v_data
      from unnest(v_types) as t(k)
      cross join lateral (
        select count(*) filter (where rc.id is null) as pending,
               count(*) filter (where rc.id is not null) as called
          from optyker_private.recall_items(t.k) i
          join public.optyker_clients cl on cl.id = i.client_id
          left join public.optyker_recall_calls rc
            on rc.recall_type = t.k and rc.client_id = i.client_id
           and rc.due_month = v_month and rc.removed_at is null
         where i.due_date >= v_month and i.due_date < v_next
      ) c;
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'year', v_year,
      'month', v_month_no,
      'today', jsonb_build_object('year', extract(year from v_today)::int, 'month', extract(month from v_today)::int, 'date', v_today),
      'recalls', v_data,
      'stock', (select jsonb_build_object('items', count(*), 'pieces', coalesce(sum(i.inventory_quantity), 0))
                  from public.optyker_inventory_items i
                 where i.active and i.category <> 'services'
                   and i.inventory_quantity between 1 and v_unlimited - 1)));

  elsif p_action = 'recalls' then
    with items as (
      select i.client_id, i.due_date, i.base_date, i.sheet_id, i.sheet_label, i.sheet_ref, i.detail, i.operator,
             cl.name, cl.surname, cl.phone, cl.home_phone, cl.email, cl.birth, cl.city, cl.reference_code,
             make_date(extract(year from i.due_date)::int, extract(month from i.due_date)::int, 1) as due_month
        from optyker_private.recall_items(v_type) i
        join public.optyker_clients cl on cl.id = i.client_id
    ), marked as (
      select it.*, rc.id as call_id, rc.called_by, rc.called_at
        from items it
        left join public.optyker_recall_calls rc
          on rc.recall_type = v_type and rc.client_id = it.client_id
         and rc.due_month = it.due_month and rc.removed_at is null
    )
    select jsonb_build_object(
      'type', v_type,
      'year', v_year,
      'month', v_month_no,
      'today', jsonb_build_object('year', extract(year from v_today)::int, 'month', extract(month from v_today)::int, 'date', v_today),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'client_id', m.client_id,
                 'name', coalesce(m.name, ''),
                 'surname', coalesce(m.surname, ''),
                 'phone', coalesce(m.phone, ''),
                 'home_phone', coalesce(m.home_phone, ''),
                 'email', coalesce(m.email, ''),
                 'birth', coalesce(m.birth, ''),
                 'city', coalesce(m.city, ''),
                 'client_ref', coalesce(m.reference_code, ''),
                 'due_date', m.due_date,
                 'base_date', m.base_date,
                 'sheet_id', m.sheet_id,
                 'sheet_label', m.sheet_label,
                 'sheet_ref', m.sheet_ref,
                 'detail', m.detail,
                 'operator', m.operator,
                 'called', m.call_id is not null,
                 'called_by', coalesce(m.called_by, ''),
                 'called_at', m.called_at)
               order by m.due_date, lower(coalesce(m.surname, '')), lower(coalesce(m.name, '')))
          from marked m
         where m.due_month = v_month), '[]'::jsonb),
      'months', (
        select jsonb_agg(jsonb_build_object(
                 'year', extract(year from g.m)::int,
                 'month', extract(month from g.m)::int,
                 'pending', coalesce(c.pending, 0),
                 'called', coalesce(c.called, 0))
               order by g.m)
          from generate_series(v_month - interval '6 months', v_month + interval '6 months', interval '1 month') as g(m)
          left join (
            select mm.due_month,
                   count(*) filter (where mm.call_id is null) as pending,
                   count(*) filter (where mm.call_id is not null) as called
              from marked mm
             group by mm.due_month
          ) c on c.due_month = g.m::date)
    ) into v_data;
    return jsonb_build_object('ok', true, 'data', v_data);

  elsif p_action = 'mark_called' then
    if not exists (select 1 from public.optyker_clients c where c.id = v_client) then
      return jsonb_build_object('ok', false, 'error', 'Cliente non trovato');
    end if;
    insert into public.optyker_recall_calls (recall_type, client_id, due_month, called_by)
    values (v_type, v_client, v_month, coalesce(p_user, ''))
    on conflict (recall_type, client_id, due_month) where removed_at is null do nothing;
    select rc.id, rc.called_by, rc.called_at into v_row
      from public.optyker_recall_calls rc
     where rc.recall_type = v_type and rc.client_id = v_client
       and rc.due_month = v_month and rc.removed_at is null;
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'id', v_row.id, 'type', v_type, 'client_id', v_client, 'year', v_year, 'month', v_month_no,
      'called_by', v_row.called_by, 'called_at', v_row.called_at));

  elsif p_action = 'unmark_called' then
    update public.optyker_recall_calls rc
       set removed_at = now(), removed_by = coalesce(p_user, '')
     where rc.recall_type = v_type and rc.client_id = v_client
       and rc.due_month = v_month and rc.removed_at is null;
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'type', v_type, 'client_id', v_client, 'year', v_year, 'month', v_month_no));

  elsif p_action = 'stock' then
    select jsonb_build_object(
      'generated_at', now(),
      'can_view_cost', v_cost,
      'unlimited_from', v_unlimited,
      'rows', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', i.id,
          'category', i.category,
          'title', nullif(btrim(i.title), ''),
          'variant', nullif(nullif(btrim(i.variant_title), ''), 'Default Title'),
          'vendor', nullif(btrim(i.vendor), ''),
          'type', nullif(btrim(i.product_type), ''),
          'sku', nullif(btrim(i.sku), ''),
          'barcode', nullif(btrim(i.barcode), ''),
          'quantity', i.inventory_quantity,
          'price', i.price,
          'vat', nullif(btrim(i.vat_code), ''),
          'cost', case when v_cost then i.confidential_cost end,
          'supplier', nullif(btrim(co.name), ''),
          'source', i.source,
          'frame', nullif(concat_ws('-', nullif(btrim(i.frame_caliber), ''), nullif(btrim(i.frame_bridge), ''),
                                    nullif(btrim(i.frame_temple), '')), ''),
          'color', coalesce(nullif(btrim(i.frame_color), ''), nullif(btrim(i.lens_color), '')),
          'liquid', nullif(btrim(i.liquid_quantity), ''),
          'sphere', nullif(btrim(lp.sphere), ''),
          'cylinder', nullif(btrim(lp.cylinder), ''),
          'axis', nullif(btrim(lp.axis), ''),
          'expiry', least(i.expiry_date, lots.first_expiry),
          'lots', lots.list))
        order by i.category, lower(coalesce(i.title, '')), lower(coalesce(i.variant_title, ''))), '[]'::jsonb))
      into v_data
      from public.optyker_inventory_items i
      left join public.optyker_inventory_companies co on co.id = i.company_id
      left join public.optyker_inventory_lac_params lp on lp.inventory_item_id = i.id
      left join lateral (
        select min(l.expiry_date) as first_expiry,
               jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'lot', nullif(btrim(l.lot_number), ''), 'expiry', l.expiry_date, 'quantity', l.quantity))
                 order by l.expiry_date nulls last, l.created_at) as list
          from public.optyker_inventory_lots l
         where l.inventory_item_id = i.id and l.quantity > 0
      ) lots on true
     where i.active and i.category <> 'services' and i.inventory_quantity <> 0;
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return jsonb_build_object('ok', false, 'error', 'Azione non riconosciuta');
end
$$;

create or replace function public.optyker_report_api(
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
    return optyker_private.report_handle(v_login->>'username', p_action, p_payload);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
end
$$;

revoke all on function optyker_private.recall_date(text) from public, anon, authenticated;
revoke all on function optyker_private.recall_lac_product(jsonb) from public, anon, authenticated;
revoke all on function optyker_private.recall_items(text) from public, anon, authenticated;
revoke all on function optyker_private.report_handle(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.optyker_report_api(text, text, text, jsonb) from public;
grant execute on function public.optyker_report_api(text, text, text, jsonb) to anon, authenticated, service_role;
