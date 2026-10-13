-- Ufficio: fatturato personale degli operatori e cedolini caricati dall'amministrazione.
-- Accesso dal sito tramite la RPC optyker_office_api (20261014001000_office_api_rpc.sql).
-- Nota: il bucket optyker-payslips creato qui non è usato (il progetto ha raggiunto il limite di
-- Edge Functions, necessarie per lo Storage privato): i file sono in optyker_payslip_files.

-- Cedolini --------------------------------------------------------------------------------------
create table if not exists public.optyker_payslips (
  id uuid primary key default gen_random_uuid(),
  operator_username text not null,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  title text not null default 'Cedolino',
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null default 0 check (size_bytes >= 0),
  storage_path text not null unique,
  uploaded_by text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.optyker_payslips is
  'Cedolini degli operatori. File nel bucket privato optyker-payslips; letture e scritture solo tramite optyker-office-api.';

create index if not exists optyker_payslips_operator_period_idx
  on public.optyker_payslips (upper(operator_username), period_year desc, period_month desc, created_at desc);

alter table public.optyker_payslips enable row level security;
revoke all on table public.optyker_payslips from anon, authenticated;
grant select, insert, update, delete on table public.optyker_payslips to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('optyker-payslips', 'optyker-payslips', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Fatturato personale -----------------------------------------------------------------------------
-- Stessa regola del report "Fatturato e incassi": buste occhiali e LAC (importo della busta) e
-- prodotti/servizi venduti in cassa, escluse le righe che incassano una busta (client_cart:*).
-- Attribuzione: operatore della busta o della vendita. I dati storici FOCUS riportano solo il
-- nome ("Diego"): vale come alias solo se nessun altro operatore ha lo stesso nome.

create or replace function optyker_private.office_operator_aliases(p_username text)
returns text[]
language sql
stable
set search_path = public, pg_temp
as $$
  with me as (
    select upper(regexp_replace(btrim(coalesce(p_username, '')), '\s+', ' ', 'g')) as u
  ), ops as (
    select upper(regexp_replace(btrim(username), '\s+', ' ', 'g')) as u
      from public.optyker_operator_profiles
     where btrim(coalesce(username, '')) <> ''
  )
  select array_remove(array[
    (select nullif(u, '') from me),
    (select case
              when position(' ' in me.u) > 0
               and (select count(*) from ops where split_part(ops.u, ' ', 1) = split_part(me.u, ' ', 1)) = 1
              then split_part(me.u, ' ', 1)
            end
       from me)
  ], null)
$$;

revoke all on function optyker_private.office_operator_aliases(text) from public, anon, authenticated;

create or replace function public.optyker_office_revenue(p_username text, p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, optyker_private, pg_temp
as $$
declare
  v_aliases text[];
  v_from timestamptz;
  v_to timestamptz;
  v jsonb;
begin
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Anno non valido';
  end if;
  v_aliases := optyker_private.office_operator_aliases(p_username);
  if coalesce(array_length(v_aliases, 1), 0) = 0 then
    raise exception 'Operatore non valido';
  end if;
  -- Da dicembre dell'anno precedente, per il confronto "mese scorso" a gennaio.
  v_from := (make_date(p_year - 1, 12, 1)::timestamp at time zone 'Europe/Rome');
  v_to := (make_date(p_year + 1, 1, 1)::timestamp at time zone 'Europe/Rome');

  with buste as (
    select (s.created_at at time zone 'Europe/Rome') as ts, s.sheet_type,
           optyker_private.report_busta_amount(s.sheet_type, s.data) as amount
      from public.optyker_sheets s
     where s.created_at >= v_from and s.created_at < v_to
       and s.document_type = 'Busta'
       and s.sheet_type in ('eyewear_job', 'lac')
       and upper(regexp_replace(btrim(coalesce(s.operator, '')), '\s+', ' ', 'g')) = any(v_aliases)
  ), prod as (
    select (ps.created_at at time zone 'Europe/Rome') as ts,
           case when coalesce(l->>'variant_id', '') like 'service:%' then 'service' else 'product' end as kind,
           optyker_private.invoice_num(l->'total') as amount
      from public.optyker_pos_sales ps
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(ps.data->'lines') = 'array' then ps.data->'lines' else '[]'::jsonb end
      ) l
     where ps.created_at >= v_from and ps.created_at < v_to
       and ps.status in ('completed', 'open_balance')
       and coalesce(ps.data->>'source', '') like 'optyker_pos%'
       and coalesce(l->>'variant_id', '') not like 'client_cart:%'
       and upper(regexp_replace(btrim(coalesce(ps.operator_username, '')), '\s+', ' ', 'g')) = any(v_aliases)
  ), entries as (
    select extract(year from ts)::int as y, extract(month from ts)::int as m,
           case when sheet_type = 'eyewear_job' then 'eyewear' else 'lac' end as kind, amount
      from buste
    union all
    select extract(year from ts)::int, extract(month from ts)::int, kind, amount from prod
  ), months as (
    select g.m,
           coalesce(sum(e.amount) filter (where e.kind = 'eyewear'), 0) as eyewear_total,
           count(e.kind) filter (where e.kind = 'eyewear') as eyewear_count,
           coalesce(sum(e.amount) filter (where e.kind = 'lac'), 0) as lac_total,
           count(e.kind) filter (where e.kind = 'lac') as lac_count,
           coalesce(sum(e.amount) filter (where e.kind = 'product'), 0) as products_total,
           coalesce(sum(e.amount) filter (where e.kind = 'service'), 0) as services_total,
           coalesce(sum(e.amount), 0) as total
      from generate_series(1, 12) as g(m)
      left join entries e on e.m = g.m and e.y = p_year
     group by g.m
  )
  select jsonb_build_object(
    'username', p_username,
    'year', p_year,
    'months', (select jsonb_agg(jsonb_build_object(
                  'month', m,
                  'total', round(total, 2),
                  'eyewear_total', round(eyewear_total, 2),
                  'eyewear_count', eyewear_count,
                  'lac_total', round(lac_total, 2),
                  'lac_count', lac_count,
                  'products_total', round(products_total, 2),
                  'services_total', round(services_total, 2)) order by m)
                 from months),
    'totals', (select jsonb_build_object(
                  'total', round(coalesce(sum(total), 0), 2),
                  'eyewear_total', round(coalesce(sum(eyewear_total), 0), 2),
                  'eyewear_count', coalesce(sum(eyewear_count), 0),
                  'lac_total', round(coalesce(sum(lac_total), 0), 2),
                  'lac_count', coalesce(sum(lac_count), 0),
                  'products_total', round(coalesce(sum(products_total), 0), 2),
                  'services_total', round(coalesce(sum(services_total), 0), 2))
                 from months),
    'previous_december_total', (select round(coalesce(sum(amount), 0), 2) from entries where y = p_year - 1 and m = 12)
  ) into v;
  return v;
end
$$;

revoke all on function public.optyker_office_revenue(text, integer) from public, anon, authenticated;
grant execute on function public.optyker_office_revenue(text, integer) to service_role;

create or replace function public.optyker_office_accounts(p_year integer, p_month integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, optyker_private, pg_temp
as $$
declare
  r record;
  rev jsonb;
  v_accounts jsonb := '[]'::jsonb;
begin
  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Mese non valido';
  end if;
  for r in
    select username, display_name, email, photo_data
      from public.optyker_operator_profiles
     where btrim(coalesce(username, '')) <> ''
     order by lower(coalesce(nullif(btrim(display_name), ''), username))
  loop
    rev := public.optyker_office_revenue(r.username, p_year);
    v_accounts := v_accounts || jsonb_build_array(jsonb_build_object(
      'username', r.username,
      'display_name', coalesce(nullif(btrim(r.display_name), ''), r.username),
      'email', coalesce(r.email, ''),
      'photo', case when coalesce(r.photo_data, '') like 'data:image/%' and length(r.photo_data) < 400000 then r.photo_data else '' end,
      'month_total', coalesce((rev->'months'->(p_month - 1)->>'total')::numeric, 0),
      'year_total', coalesce((rev->'totals'->>'total')::numeric, 0),
      'payslips_count', (select count(*) from public.optyker_payslips p where upper(p.operator_username) = upper(r.username)),
      'last_payslip', (select jsonb_build_object('year', p.period_year, 'month', p.period_month)
                         from public.optyker_payslips p
                        where upper(p.operator_username) = upper(r.username)
                        order by p.period_year desc, p.period_month desc, p.created_at desc
                        limit 1)
    ));
  end loop;
  return jsonb_build_object('year', p_year, 'month', p_month, 'accounts', v_accounts);
end
$$;

revoke all on function public.optyker_office_accounts(integer, integer) from public, anon, authenticated;
grant execute on function public.optyker_office_accounts(integer, integer) to service_role;
