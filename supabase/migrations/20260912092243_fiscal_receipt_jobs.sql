-- Only the authenticated fiscal Edge Function (service_role) may access these rows.
create table public.optyker_fiscal_jobs (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null unique references public.optyker_pos_payments(id),
 sale_id uuid not null references public.optyker_pos_sales(id),
 operator_username text not null,
 serial text not null,
 state text not null check (state in ('prepared','sending','not_started','uncertain','awaiting_reference','completed')),
 document jsonb not null,
 claim_hash text,
 claim_expires_at timestamptz,
 result_hash text,
 result jsonb,
 document_number text,
 document_date date,
 reference_confirmed_by text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index optyker_fiscal_one_active_printer on public.optyker_fiscal_jobs(serial) where state in ('sending','uncertain');
create unique index optyker_fiscal_document_unique on public.optyker_fiscal_jobs(serial,document_date,document_number) where document_number is not null;
create index optyker_fiscal_jobs_sale on public.optyker_fiscal_jobs(sale_id);
alter table public.optyker_fiscal_jobs enable row level security;
revoke all on public.optyker_fiscal_jobs from public,anon,authenticated;
grant select,insert,update on public.optyker_fiscal_jobs to service_role;

create table public.optyker_ts_outbox (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null unique references public.optyker_fiscal_jobs(id),
 payment_id uuid not null unique references public.optyker_pos_payments(id),
 state text not null default 'awaiting_configuration' check (state in ('awaiting_configuration','ready','sending','uncertain','accepted','rejected')),
 document jsonb not null,
 protocol text,
 outcome jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.optyker_ts_outbox enable row level security;
revoke all on public.optyker_ts_outbox from public,anon,authenticated;
grant select,insert,update on public.optyker_ts_outbox to service_role;

-- One transaction: reference, TS queue and the link to the legacy preparation.
create function public.optyker_confirm_fiscal_reference(p_job_id uuid,p_number text,p_date date,p_operator text,p_ts_document jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.optyker_fiscal_jobs;
begin
 select * into j from public.optyker_fiscal_jobs where id=p_job_id for update;
 if not found or j.state not in ('awaiting_reference','completed') then raise exception 'Stato documento non confermabile'; end if;
 if j.state='completed' and (j.document_number<>p_number or j.document_date<>p_date) then raise exception 'Riferimento già confermato'; end if;
 if p_number !~ '^[0-9]{4}-[0-9]{4}$' or p_date>current_date then raise exception 'Riferimento non valido'; end if;
 update public.optyker_fiscal_jobs set state='completed',document_number=p_number,document_date=p_date,reference_confirmed_by=p_operator,updated_at=now() where id=p_job_id returning * into j;
 if (j.document->>'tsRequested')::boolean then
  if p_ts_document is null then raise exception 'Preparazione TS mancante'; end if;
  insert into public.optyker_ts_outbox(job_id,payment_id,document) values(j.id,j.payment_id,p_ts_document) on conflict(job_id) do nothing;
 end if;
 update public.optyker_ts_documents set status='linked_fiscal_review',provider='optyker_fiscal',document_number=p_number,document_date=p_date,updated_at=now(),
  provider_payload=jsonb_build_object('fiscal_job_id',j.id,'note','Preparazione originaria sostituita dalla revisione delle righe fiscali. Consultare la coda dei documenti RCH; nessun invio TS effettuato.')
 where payment_id=j.payment_id and status in ('awaiting_fiscal_document','opposition_recorded','ready_focus_ts');
 return to_jsonb(j);
end;
$$;
revoke all on function public.optyker_confirm_fiscal_reference(uuid,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_confirm_fiscal_reference(uuid,text,date,text,jsonb) to service_role;
