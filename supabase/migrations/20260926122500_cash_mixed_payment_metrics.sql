-- Allocate one mixed fiscal receipt to cash and card in daily and closure totals.
create or replace function public.optyker_cash_day_metrics(p_business_date date) returns jsonb language sql stable set search_path=public as $$
with sale_day as(
 select * from public.optyker_pos_sales s where (s.created_at at time zone 'Europe/Rome')::date=p_business_date and coalesce(s.status,'') not in('error','cancelled')
),pay_day as(
 select * from public.optyker_pos_payments p where (p.created_at at time zone 'Europe/Rome')::date=p_business_date
),fiscal_sales as(
 select j.* from public.optyker_fiscal_jobs j
 where coalesce(j.operation,'sale')='sale' and j.state in('completed','awaiting_reference')
 and coalesce(j.document_date,(j.updated_at at time zone 'Europe/Rome')::date,(j.created_at at time zone 'Europe/Rome')::date)=p_business_date
 and not exists(select 1 from public.optyker_fiscal_jobs v where v.operation='void' and v.original_job_id=j.id and v.state in('completed','awaiting_reference'))
),receipt_payments as(
 select j.id job_id,p.* from fiscal_sales j left join public.optyker_pos_payments p on p.id=j.payment_id
),sales_agg as(
 select coalesce(sum(total),0)::numeric(12,2) turnover_total,count(*)::int sales_count,
 coalesce(sum(due_amount) filter(where due_amount>0),0)::numeric(12,2) pending_total,count(*) filter(where due_amount>0)::int pending_count from sale_day
),pay_agg as(
 select coalesce(sum(amount),0)::numeric(12,2) total_collected,
 (coalesce(sum(amount) filter(where payment_method='cash'),0)+coalesce(sum((data->'payment_breakdown'->>'cash')::numeric) filter(where payment_method='mixed'),0))::numeric(12,2) cash_total,
 (coalesce(sum(amount) filter(where payment_method='card'),0)+coalesce(sum((data->'payment_breakdown'->>'card')::numeric) filter(where payment_method='mixed'),0))::numeric(12,2) card_total,
 coalesce(sum(amount) filter(where payment_method='bank'),0)::numeric(12,2) bank_total,
 coalesce(sum(amount) filter(where payment_method not in('cash','card','mixed','bank')),0)::numeric(12,2) other_total,
 coalesce(sum(amount) filter(where invoice_requested is true),0)::numeric(12,2) invoice_payments_total,count(*)::int payments_count from pay_day
),receipt_agg as(
 select coalesce(sum(coalesce(amount,0)),0)::numeric(12,2) receipts_total,count(*)::int receipts_count,
 (coalesce(sum(coalesce(amount,0)) filter(where payment_method='cash'),0)+coalesce(sum((data->'payment_breakdown'->>'cash')::numeric) filter(where payment_method='mixed'),0))::numeric(12,2) receipt_cash_total,
 (coalesce(sum(coalesce(amount,0)) filter(where payment_method='card'),0)+coalesce(sum((data->'payment_breakdown'->>'card')::numeric) filter(where payment_method='mixed'),0))::numeric(12,2) receipt_card_total,
 coalesce(sum(coalesce(amount,0)) filter(where payment_method='bank'),0)::numeric(12,2) receipt_bank_total,
 coalesce(sum(coalesce(amount,0)) filter(where payment_method not in('cash','card','mixed','bank')),0)::numeric(12,2) receipt_other_total from receipt_payments
),stages as(
 select coalesce(jsonb_object_agg(payment_stage,amount_sum),'{}'::jsonb) by_stage from(select payment_stage,round(sum(amount),2) amount_sum from pay_day group by payment_stage)x
),opening_row as(
 select to_jsonb(o) row from public.optyker_cash_openings o where o.register_code='main' and o.business_date=p_business_date limit 1
),previous_fund as(
 select c.next_opening_cash,c.next_opening_checks from public.optyker_cash_closures c where c.register_code='main' and c.business_date<p_business_date order by c.business_date desc limit 1
),closure_row as(
 select to_jsonb(c) row from public.optyker_cash_closures c where c.register_code='main' and c.business_date=p_business_date limit 1
)
select jsonb_build_object('business_date',p_business_date,'turnover_total',s.turnover_total,'sales_count',s.sales_count,'pending_total',s.pending_total,'pending_count',s.pending_count,
 'total_collected',p.total_collected,'cash_total',p.cash_total,'card_total',p.card_total,'bank_total',p.bank_total,'other_total',p.other_total,'invoice_payments_total',p.invoice_payments_total,'payments_count',p.payments_count,
 'receipts_total',r.receipts_total,'receipts_count',r.receipts_count,'receipt_cash_total',r.receipt_cash_total,'receipt_card_total',r.receipt_card_total,'receipt_bank_total',r.receipt_bank_total,'receipt_other_total',r.receipt_other_total,
 'by_stage',st.by_stage,'opening',(select row from opening_row),'opened',exists(select 1 from opening_row),
 'suggested_opening_cash',coalesce((select next_opening_cash from previous_fund),0),'suggested_opening_checks',coalesce((select next_opening_checks from previous_fund),0),
 'closure',(select row from closure_row),'closed',exists(select 1 from closure_row))
from sales_agg s cross join pay_agg p cross join receipt_agg r cross join stages st;
$$;
