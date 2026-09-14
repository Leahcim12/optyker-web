-- Administrator daily cash opening/closure accounting.
-- Fatturato is full sale value; paid/corrispettivi remain separate.
create table if not exists public.optyker_cash_openings(
  id uuid primary key default gen_random_uuid(),register_code text not null default 'main',business_date date not null,
  operator_username text not null default '',opening_cash numeric(12,2) not null default 0,opening_checks numeric(12,2) not null default 0,
  notes text not null default '',opened_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(register_code,business_date),check(opening_cash>=0),check(opening_checks>=0)
);
alter table public.optyker_cash_openings enable row level security;
revoke all on public.optyker_cash_openings from anon,authenticated;
grant select,insert,update,delete on public.optyker_cash_openings to service_role;
alter table public.optyker_cash_closures
 add column if not exists opening_checks numeric(12,2) not null default 0,
 add column if not exists checks_counted numeric(12,2) not null default 0,
 add column if not exists turnover_total numeric(12,2) not null default 0,
 add column if not exists receipts_total numeric(12,2) not null default 0,
 add column if not exists receipts_count integer not null default 0,
 add column if not exists invoice_payments_total numeric(12,2) not null default 0,
 add column if not exists bank_deposit_cash numeric(12,2) not null default 0,
 add column if not exists bank_deposit_checks numeric(12,2) not null default 0,
 add column if not exists safe_deposit_cash numeric(12,2) not null default 0,
 add column if not exists safe_deposit_checks numeric(12,2) not null default 0,
 add column if not exists next_opening_cash numeric(12,2) not null default 0,
 add column if not exists next_opening_checks numeric(12,2) not null default 0;

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
 coalesce(sum(amount) filter(where payment_method='cash'),0)::numeric(12,2) cash_total,
 coalesce(sum(amount) filter(where payment_method='card'),0)::numeric(12,2) card_total,
 coalesce(sum(amount) filter(where payment_method='bank'),0)::numeric(12,2) bank_total,
 coalesce(sum(amount) filter(where payment_method not in('cash','card','bank')),0)::numeric(12,2) other_total,
 coalesce(sum(amount) filter(where invoice_requested is true),0)::numeric(12,2) invoice_payments_total,count(*)::int payments_count from pay_day
),receipt_agg as(
 select coalesce(sum(coalesce(amount,0)),0)::numeric(12,2) receipts_total,count(*)::int receipts_count,
 coalesce(sum(coalesce(amount,0)) filter(where payment_method='cash'),0)::numeric(12,2) receipt_cash_total,
 coalesce(sum(coalesce(amount,0)) filter(where payment_method='card'),0)::numeric(12,2) receipt_card_total,
 coalesce(sum(coalesce(amount,0)) filter(where payment_method='bank'),0)::numeric(12,2) receipt_bank_total,
 coalesce(sum(coalesce(amount,0)) filter(where payment_method not in('cash','card','bank')),0)::numeric(12,2) receipt_other_total from receipt_payments
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
create or replace function public.optyker_cash_closure_preview(p_business_date date) returns jsonb language sql stable set search_path=public as $$select public.optyker_cash_day_metrics(p_business_date);$$;

create or replace function public.optyker_cash_admin_open_day(p_business_date date,p_operator text,p_opening_cash numeric,p_opening_checks numeric default 0,p_notes text default '') returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if p_business_date is null or p_business_date>(now() at time zone 'Europe/Rome')::date then raise exception 'Data apertura non valida';end if;
 if coalesce(p_opening_cash,0)<0 or coalesce(p_opening_checks,0)<0 then raise exception 'Gli importi di apertura non possono essere negativi';end if;
 if exists(select 1 from public.optyker_cash_closures where register_code='main' and business_date=p_business_date) then raise exception 'La giornata del % è già chiusa',to_char(p_business_date,'DD/MM/YYYY');end if;
 insert into public.optyker_cash_openings(register_code,business_date,operator_username,opening_cash,opening_checks,notes)
 values('main',p_business_date,coalesce(p_operator,''),round(coalesce(p_opening_cash,0),2),round(coalesce(p_opening_checks,0),2),left(coalesce(p_notes,''),2000))
 on conflict(register_code,business_date) do update set operator_username=excluded.operator_username,opening_cash=excluded.opening_cash,opening_checks=excluded.opening_checks,notes=excluded.notes,updated_at=now();
 return public.optyker_cash_day_metrics(p_business_date);
end;$$;

create or replace function public.optyker_cash_admin_close_day(p_business_date date,p_operator text,p_cash_counted numeric,p_checks_counted numeric default 0,p_bank_deposit_cash numeric default 0,p_bank_deposit_checks numeric default 0,p_safe_deposit_cash numeric default 0,p_safe_deposit_checks numeric default 0,p_notes text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;o public.optyker_cash_openings;r public.optyker_cash_closures;expected_cash numeric(12,2);
 counted_cash numeric(12,2):=round(coalesce(p_cash_counted,0),2);counted_checks numeric(12,2):=round(coalesce(p_checks_counted,0),2);
 dep_bank_cash numeric(12,2):=round(coalesce(p_bank_deposit_cash,0),2);dep_bank_checks numeric(12,2):=round(coalesce(p_bank_deposit_checks,0),2);
 dep_safe_cash numeric(12,2):=round(coalesce(p_safe_deposit_cash,0),2);dep_safe_checks numeric(12,2):=round(coalesce(p_safe_deposit_checks,0),2);
begin
 if p_business_date is null or p_business_date>(now() at time zone 'Europe/Rome')::date then raise exception 'Data chiusura non valida';end if;
 if exists(select 1 from public.optyker_cash_closures where register_code='main' and business_date=p_business_date) then raise exception 'La cassa del % è già stata chiusa',to_char(p_business_date,'DD/MM/YYYY');end if;
 select * into o from public.optyker_cash_openings where register_code='main' and business_date=p_business_date;if not found then raise exception 'Prima di chiudere devi registrare l’apertura giornaliera';end if;
 if counted_cash<0 or counted_checks<0 or dep_bank_cash<0 or dep_bank_checks<0 or dep_safe_cash<0 or dep_safe_checks<0 then raise exception 'Gli importi non possono essere negativi';end if;
 if dep_bank_cash+dep_safe_cash>counted_cash+0.005 then raise exception 'I prelievi di contanti superano il contante contato';end if;
 if dep_bank_checks+dep_safe_checks>counted_checks+0.005 then raise exception 'I prelievi di assegni superano gli assegni contati';end if;
 v:=public.optyker_cash_day_metrics(p_business_date);expected_cash:=round(o.opening_cash+coalesce((v->>'cash_total')::numeric,0),2);
 insert into public.optyker_cash_closures(register_code,business_date,operator_username,opening_cash,opening_checks,cash_expected,cash_counted,checks_counted,cash_difference,card_total,bank_total,other_total,total_collected,payments_count,sales_count,pending_total,pending_count,turnover_total,receipts_total,receipts_count,invoice_payments_total,bank_deposit_cash,bank_deposit_checks,safe_deposit_cash,safe_deposit_checks,next_opening_cash,next_opening_checks,notes,snapshot)
 values('main',p_business_date,coalesce(p_operator,''),o.opening_cash,o.opening_checks,expected_cash,counted_cash,counted_checks,round(counted_cash-expected_cash,2),
 coalesce((v->>'card_total')::numeric,0),coalesce((v->>'bank_total')::numeric,0),coalesce((v->>'other_total')::numeric,0),coalesce((v->>'total_collected')::numeric,0),coalesce((v->>'payments_count')::int,0),coalesce((v->>'sales_count')::int,0),coalesce((v->>'pending_total')::numeric,0),coalesce((v->>'pending_count')::int,0),coalesce((v->>'turnover_total')::numeric,0),coalesce((v->>'receipts_total')::numeric,0),coalesce((v->>'receipts_count')::int,0),coalesce((v->>'invoice_payments_total')::numeric,0),
 dep_bank_cash,dep_bank_checks,dep_safe_cash,dep_safe_checks,round(counted_cash-dep_bank_cash-dep_safe_cash,2),round(counted_checks-dep_bank_checks-dep_safe_checks,2),left(coalesce(p_notes,''),2000),v||jsonb_build_object('cash_counted',counted_cash,'checks_counted',counted_checks,'bank_deposit_cash',dep_bank_cash,'bank_deposit_checks',dep_bank_checks,'safe_deposit_cash',dep_safe_cash,'safe_deposit_checks',dep_safe_checks)) returning * into r;
 return to_jsonb(r);
end;$$;

create or replace function public.optyker_cash_month_overview(p_year int,p_month int) returns jsonb language sql stable set search_path=public as $$
with bounds as(select make_date(p_year,p_month,1)d1,(make_date(p_year,p_month,1)+interval '1 month - 1 day')::date d2,(now() at time zone 'Europe/Rome')::date today),
days as(select g::date business_day from bounds b cross join lateral generate_series(b.d1,least(b.d2,b.today),'1 day'::interval)g),metrics as(select business_day,public.optyker_cash_day_metrics(business_day)m from days),normalized as(
 select business_day,m,coalesce((m->'closure'->>'turnover_total')::numeric,(m->>'turnover_total')::numeric,0)turnover_total,
 coalesce((m->'closure'->>'total_collected')::numeric,(m->>'total_collected')::numeric,0)paid_total,
 coalesce((m->'closure'->>'receipts_total')::numeric,(m->>'receipts_total')::numeric,0)receipts_total,
 coalesce((m->'closure'->>'receipts_count')::int,(m->>'receipts_count')::int,0)receipts_count,
 coalesce((m->'closure'->>'pending_total')::numeric,(m->>'pending_total')::numeric,0)pending_total from metrics)
select jsonb_build_object('year',p_year,'month',p_month,'turnover_total',coalesce(sum(turnover_total),0),'paid_total',coalesce(sum(paid_total),0),'receipts_total',coalesce(sum(receipts_total),0),'receipts_count',coalesce(sum(receipts_count),0),'pending_total',coalesce(sum(pending_total),0),'closed_days',count(*)filter(where(m->>'closed')::boolean),'opened_days',count(*)filter(where(m->>'opened')::boolean and not(m->>'closed')::boolean),'days',coalesce(jsonb_agg(jsonb_build_object('date',business_day,'metrics',m)order by business_day desc),'[]'::jsonb)) from normalized;
$$;
revoke all on function public.optyker_cash_day_metrics(date) from public,anon,authenticated;
revoke all on function public.optyker_cash_closure_preview(date) from public,anon,authenticated;
revoke all on function public.optyker_cash_admin_open_day(date,text,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.optyker_cash_admin_close_day(date,text,numeric,numeric,numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.optyker_cash_month_overview(int,int) from public,anon,authenticated;
grant execute on function public.optyker_cash_day_metrics(date) to service_role;
grant execute on function public.optyker_cash_closure_preview(date) to service_role;
grant execute on function public.optyker_cash_admin_open_day(date,text,numeric,numeric,text) to service_role;
grant execute on function public.optyker_cash_admin_close_day(date,text,numeric,numeric,numeric,numeric,numeric,numeric,text) to service_role;
grant execute on function public.optyker_cash_month_overview(int,int) to service_role;
