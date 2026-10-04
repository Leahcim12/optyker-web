-- Admin reports: corrispettivi per chiusura Z, fatturato mensile (occhiali/LAC/udito), fatturato e incassato giornalieri.
-- Read-only functions, callable only with the service role (through optyker-admin-reports-api).

create or replace function optyker_private.report_rome_day(ts timestamptz)
returns date language sql immutable as $$ select (ts at time zone 'Europe/Rome')::date $$;

create or replace function optyker_private.report_busta_amount(p_sheet_type text, p_data jsonb)
returns numeric language sql stable as $$
  select round(case
    when p_sheet_type = 'eyewear_job' then
      coalesce(nullif(optyker_private.invoice_num(p_data->'pricing'->'manual_final_price'),0),
               optyker_private.invoice_num(p_data->'pricing'->'total'))
    when p_sheet_type = 'lac' then
      coalesce(nullif(optyker_private.invoice_num(coalesce(p_data->'lacState'->'manualFinalPrice', p_data->'lacState'->'manual_final_price')),0),
               nullif(optyker_private.invoice_num(p_data->'lacState'->'finalPrice'),0),
               optyker_private.invoice_num(p_data->'lacState'->'odCost') + optyker_private.invoice_num(p_data->'lacState'->'osCost'))
    else 0 end, 2)
$$;

-- Corrispettivi: one row per chiusura Z (prefix of the RCH document number), with totals per VAT rate.
create or replace function public.optyker_report_corrispettivi(p_year int, p_month int)
returns jsonb language plpgsql stable security definer set search_path = public, optyker_private as $$
declare v_from date := make_date(p_year, p_month, 1); v_to date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
        v_maxz int; v_today date := optyker_private.report_rome_day(now()); v_out jsonb;
begin
  select max(split_part(document_number,'-',1)::int) into v_maxz
    from optyker_fiscal_jobs where state = 'completed' and document_number ~ '^\d+-\d+$';
  with docs as (
    select j.id, j.operation, split_part(j.document_number,'-',1)::int z, j.document_number,
           coalesce(j.document_date, optyker_private.report_rome_day(j.created_at)) d,
           case when j.operation = 'void' then coalesce(o.document, j.document) else j.document end doc,
           case when j.operation = 'void' then -1 else 1 end sign,
           (j.document->>'totalCents')::numeric / 100 total
      from optyker_fiscal_jobs j
      left join optyker_fiscal_jobs o on o.id = j.original_job_id
     where j.state = 'completed' and j.document_number ~ '^\d+-\d+$'
       and coalesce(j.document_date, optyker_private.report_rome_day(j.created_at)) >= v_from
       and coalesce(j.document_date, optyker_private.report_rome_day(j.created_at)) < v_to
  ), lines as (
    select d.z, d.d, d.sign,
           case upper(coalesce(l->>'vatCode','')) when '04' then '04' when '4' then '04' when '22' then '22' when '10' then '10' when 'ART10' then 'ART10' else 'ALTRO' end vat,
           (l->>'totalCents')::numeric / 100 amount
      from docs d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.doc->'lines')='array' and jsonb_array_length(d.doc->'lines')>0 then d.doc->'lines' else jsonb_build_array(jsonb_build_object('vatCode','ALTRO','totalCents',(d.doc->>'totalCents'))) end) l
  ), byz as (
    select z, min(d) d, max(d) d_to from docs group by z
  ), closures as (
    select payload->>'business_date' bd, bool_or(state='completed' and (result->>'dailyClosureExecuted')::boolean is true) ok,
           bool_or(state='completed' and result->>'state'='uncertain') uncertain
      from optyker_rch_remote_commands where kind = 'daily_closure' group by 1
  )
  select coalesce(jsonb_agg(row_to_json(r) order by r.z desc), '[]'::jsonb) into v_out from (
    select b.z, b.d as business_date,
      (select count(*) from docs x where x.z=b.z and x.operation='sale') receipts,
      (select count(*) from docs x where x.z=b.z and x.operation='void') voids,
      (select coalesce(sum(amount*sign),0) from lines l where l.z=b.z and l.vat='04') vat_04,
      (select coalesce(sum(amount*sign),0) from lines l where l.z=b.z and l.vat='10') vat_10,
      (select coalesce(sum(amount*sign),0) from lines l where l.z=b.z and l.vat='22') vat_22,
      (select coalesce(sum(amount*sign),0) from lines l where l.z=b.z and l.vat='ART10') art10,
      (select coalesce(sum(amount*sign),0) from lines l where l.z=b.z and l.vat='ALTRO') other,
      (select coalesce(sum(amount) filter (where sign>0),0) from lines l where l.z=b.z) gross,
      (select coalesce(sum(amount) filter (where sign<0),0) from lines l where l.z=b.z) voided,
      (select coalesce(sum(amount*sign),0) from lines l where l.z=b.z) net,
      case
        when b.z < v_maxz or coalesce(c.ok,false) then 'transmitted'
        when coalesce(c.uncertain,false) then 'to_verify'
        when b.d < v_today then 'to_verify'
        else 'open' end status
    from byz b left join closures c on c.bd = b.d::text
  ) r;
  return jsonb_build_object('year',p_year,'month',p_month,'rows',v_out,
    'pending_references',(select count(*) from optyker_fiscal_jobs where state='awaiting_reference'
        and optyker_private.report_rome_day(created_at) >= v_from and optyker_private.report_rome_day(created_at) < v_to));
end $$;

-- Monthly: occhiali / LAC buste created in the month, hearing sheets (count only, excluded from totals), products sold at the till.
create or replace function public.optyker_report_month(p_year int, p_month int)
returns jsonb language plpgsql stable security definer set search_path = public, optyker_private as $$
declare v_from date := make_date(p_year, p_month, 1); v_to date := (make_date(p_year, p_month, 1) + interval '1 month')::date; v jsonb;
begin
  with s as (
    select sheet_type, document_type, data, optyker_private.report_rome_day(created_at) d from optyker_sheets
     where created_at >= (v_from::timestamp at time zone 'Europe/Rome') and created_at < (v_to::timestamp at time zone 'Europe/Rome')
  ), prod as (
    select optyker_private.invoice_num(l->'total') amount, coalesce(nullif(l->>'product_type',''),'') pt, l->>'variant_id' vid
      from optyker_pos_sales ps cross join lateral jsonb_array_elements(case when jsonb_typeof(ps.data->'lines')='array' then ps.data->'lines' else '[]' end) l
     where ps.status in ('completed','open_balance') and coalesce(ps.data->>'source','') like 'optyker_pos%'
       and ps.created_at >= (v_from::timestamp at time zone 'Europe/Rome') and ps.created_at < (v_to::timestamp at time zone 'Europe/Rome')
       and coalesce(l->>'variant_id','') not like 'client_cart:%'
  )
  select jsonb_build_object(
    'year', p_year, 'month', p_month,
    'eyewear_count', (select count(*) from s where sheet_type='eyewear_job' and document_type='Busta'),
    'eyewear_total', (select coalesce(sum(optyker_private.report_busta_amount(sheet_type,data)),0) from s where sheet_type='eyewear_job' and document_type='Busta'),
    'lac_count', (select count(*) from s where sheet_type='lac' and document_type='Busta'),
    'lac_total', (select coalesce(sum(optyker_private.report_busta_amount(sheet_type,data)),0) from s where sheet_type='lac' and document_type='Busta'),
    'hearing_count', (select count(*) from s where sheet_type ~* 'hear|udit|audio'),
    'products_total', (select coalesce(sum(amount),0) from prod where vid not like 'service:%'),
    'services_total', (select coalesce(sum(amount),0) from prod where vid like 'service:%'),
    'days', (select coalesce(jsonb_agg(x order by x->>'day'),'[]'::jsonb) from (
        select jsonb_build_object('day', d,
          'eyewear_count', count(*) filter (where sheet_type='eyewear_job' and document_type='Busta'),
          'eyewear_total', coalesce(sum(optyker_private.report_busta_amount(sheet_type,data)) filter (where sheet_type='eyewear_job' and document_type='Busta'),0),
          'lac_count', count(*) filter (where sheet_type='lac' and document_type='Busta'),
          'lac_total', coalesce(sum(optyker_private.report_busta_amount(sheet_type,data)) filter (where sheet_type='lac' and document_type='Busta'),0),
          'hearing_count', count(*) filter (where sheet_type ~* 'hear|udit|audio')) x
        from s group by d) q)
  ) into v;
  return v;
end $$;

-- Day: fatturato (buste occhiali, buste LAC, prodotti e servizi venduti) and incassato by payment method.
create or replace function public.optyker_report_day(p_day date)
returns jsonb language plpgsql stable security definer set search_path = public, optyker_private as $$
declare v_a timestamptz := (p_day::timestamp at time zone 'Europe/Rome'); v_b timestamptz := ((p_day + 1)::timestamp at time zone 'Europe/Rome'); v jsonb;
begin
  with buste as (
    select s.id, s.sheet_type, coalesce(nullif(s.reference_code,''), s.title) ref, s.created_at,
           btrim(coalesce(c.surname,'')||' '||coalesce(c.name,'')) client, optyker_private.report_busta_amount(s.sheet_type, s.data) amount
      from optyker_sheets s left join optyker_clients c on c.id = s.client_id
     where s.created_at >= v_a and s.created_at < v_b
       and ((s.sheet_type='eyewear_job' and s.document_type='Busta')
         or (s.sheet_type='lac' and s.document_type='Busta'))
  ), prod as (
    select ps.created_at, btrim(coalesce(c.surname,'')||' '||coalesce(c.name,'')) client, l->>'title' title,
           optyker_private.invoice_num(l->'quantity') qty, optyker_private.invoice_num(l->'total') amount,
           case when l->>'variant_id' like 'service:%' then 'service' else 'product' end kind
      from optyker_pos_sales ps left join optyker_clients c on c.id = ps.client_id
      cross join lateral jsonb_array_elements(case when jsonb_typeof(ps.data->'lines')='array' then ps.data->'lines' else '[]' end) l
     where ps.status in ('completed','open_balance') and coalesce(ps.data->>'source','') like 'optyker_pos%'
       and ps.created_at >= v_a and ps.created_at < v_b and coalesce(l->>'variant_id','') not like 'client_cart:%'
  ), pay as (
    select p.created_at, p.payment_method, p.payment_stage, p.amount, p.operator_username,
           btrim(coalesce(c.surname,'')||' '||coalesce(c.name,'')) client, p.data->'payment_breakdown' br, p.data->>'mixed_payment_note' note
      from optyker_pos_payments p left join optyker_clients c on c.id = p.client_id
     where p.created_at >= v_a and p.created_at < v_b
  ), split as (
    select case when payment_method='mixed' and jsonb_typeof(br)='object' then k else payment_method end method,
           case when payment_method='mixed' and jsonb_typeof(br)='object' then optyker_private.invoice_num(br->k) else amount end amount
      from pay left join lateral (select jsonb_object_keys(case when jsonb_typeof(br)='object' then br else '{}' end) k) kk on payment_method='mixed'
  )
  select jsonb_build_object(
    'day', p_day,
    'turnover', jsonb_build_object(
       'eyewear_total', (select coalesce(sum(amount),0) from buste where sheet_type='eyewear_job'),
       'eyewear_count', (select count(*) from buste where sheet_type='eyewear_job'),
       'lac_total', (select coalesce(sum(amount),0) from buste where sheet_type='lac'),
       'lac_count', (select count(*) from buste where sheet_type='lac'),
       'products_total', (select coalesce(sum(amount),0) from prod where kind='product'),
       'services_total', (select coalesce(sum(amount),0) from prod where kind='service')),
    'turnover_rows', (select coalesce(jsonb_agg(x order by x->>'at'),'[]'::jsonb) from (
        select jsonb_build_object('at',created_at,'type',case when sheet_type='eyewear_job' then 'Occhiali' else 'LAC' end,'description',ref,'client',client,'qty',1,'amount',amount) x from buste
        union all
        select jsonb_build_object('at',created_at,'type',case when kind='service' then 'Servizi' else 'Prodotti' end,'description',title,'client',client,'qty',qty,'amount',amount) from prod) q),
    'collected', (select coalesce(jsonb_object_agg(method, total),'{}'::jsonb) from (select method, sum(amount) total from split group by method) q),
    'collected_total', (select coalesce(sum(amount),0) from pay),
    'collected_rows', (select coalesce(jsonb_agg(jsonb_build_object('at',created_at,'method',payment_method,'stage',payment_stage,'amount',amount,'client',client,'operator',operator_username,'breakdown',br,'note',note) order by created_at),'[]'::jsonb) from pay)
  ) into v;
  return v;
end $$;

revoke all on function public.optyker_report_corrispettivi(int,int) from public, anon, authenticated;
revoke all on function public.optyker_report_month(int,int) from public, anon, authenticated;
revoke all on function public.optyker_report_day(date) from public, anon, authenticated;
grant execute on function public.optyker_report_corrispettivi(int,int) to service_role;
grant execute on function public.optyker_report_month(int,int) to service_role;
grant execute on function public.optyker_report_day(date) to service_role;
