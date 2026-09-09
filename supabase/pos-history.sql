-- Visibility in the customer/POS history only. Sales, payments, inventory and fiscal records are retained.
create table if not exists public.optyker_pos_history_visibility (
  sale_id uuid primary key references public.optyker_pos_sales(id),
  hidden_at timestamptz,
  changed_by text not null,
  changed_at timestamptz not null default now()
);
alter table public.optyker_pos_history_visibility enable row level security;
revoke all on public.optyker_pos_history_visibility from public, anon, authenticated;
grant select, insert, update on public.optyker_pos_history_visibility to service_role;

create or replace view public.optyker_pos_history with (security_invoker=true) as
select s.id,s.client_id,s.operator_username,s.payment_stage,s.payment_method,s.payment_status,
       s.status,s.total,s.paid_amount,s.due_amount,s.currency,s.shopify_order_name,s.note,
       s.invoice_requested,s.billing_invoice_id,s.created_at,s.completed_at,s.error_message,
       h.hidden_at,h.changed_by,h.changed_at
from public.optyker_pos_sales s
left join public.optyker_pos_history_visibility h on h.sale_id=s.id;
revoke all on public.optyker_pos_history from public, anon, authenticated;
grant select on public.optyker_pos_history to service_role;
