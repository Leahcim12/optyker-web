-- Sale and void share the SAME active-printer lock and persistent attempt ledger.
alter table public.optyker_fiscal_jobs
 add column operation text not null default 'sale' check(operation in ('sale','void')),
 add column original_job_id uuid references public.optyker_fiscal_jobs(id),
 add constraint optyker_fiscal_operation_parent check((operation='sale' and original_job_id is null) or (operation='void' and original_job_id is not null and original_job_id<>id));
alter table public.optyker_fiscal_jobs drop constraint optyker_fiscal_jobs_payment_id_key;
create unique index optyker_fiscal_sale_payment on public.optyker_fiscal_jobs(payment_id) where operation='sale';
create unique index optyker_fiscal_void_original on public.optyker_fiscal_jobs(original_job_id) where operation='void';
alter table public.optyker_ts_outbox drop constraint optyker_ts_outbox_state_check;
alter table public.optyker_ts_outbox add constraint optyker_ts_outbox_state_check
 check(state in ('awaiting_configuration','ready','sending','uncertain','accepted','rejected','held_for_void','voided'));

create function public.optyker_claim_fiscal_job(p_job_id uuid,p_claim_hash text,p_result_hash text,p_operation text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.optyker_fiscal_jobs; original public.optyker_fiscal_jobs; q public.optyker_ts_outbox;
begin
 select * into j from public.optyker_fiscal_jobs where id=p_job_id for update;
 if not found or j.state<>'prepared' or j.operation is distinct from p_operation or j.claim_hash is distinct from p_claim_hash
    or j.claim_expires_at is null or j.claim_expires_at<=now() or p_result_hash !~ '^[a-f0-9]{64}$'
 then raise exception 'Autorizzazione scaduta o già utilizzata. Aggiorna lo stato senza ripetere la stampa.'; end if;
 if j.operation='void' then
  select * into original from public.optyker_fiscal_jobs where id=j.original_job_id for update;
  if not found or original.operation<>'sale' or original.state<>'completed' or original.payment_id<>j.payment_id or original.sale_id<>j.sale_id or original.serial<>j.serial
     or j.document#>>'{original,jobId}' is distinct from original.id::text
     or j.document#>>'{original,number}' is distinct from original.document_number
     or j.document#>>'{original,date}' is distinct from original.document_date::text
     or j.document->>'totalCents' is distinct from original.document->>'totalCents'
  then raise exception 'Riferimento originale non valido per annullo'; end if;
  select * into q from public.optyker_ts_outbox where job_id=original.id for update;
  if found then
   if q.state<>'awaiting_configuration' or q.protocol is not null then raise exception 'Spesa TS già elaborata o sospesa: occorre verificarne la rettifica prima dell’annullo'; end if;
   update public.optyker_ts_outbox set state='held_for_void',outcome=coalesce(outcome,'{}')||jsonb_build_object('void_job_id',j.id),updated_at=now() where id=q.id;
  end if;
 end if;
 -- This update uses the existing unique index on serial for sending/uncertain.
 update public.optyker_fiscal_jobs set state='sending',claim_hash=null,result_hash=p_result_hash,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end;
$$;
revoke all on function public.optyker_claim_fiscal_job(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.optyker_claim_fiscal_job(uuid,text,text,text) to service_role;

create function public.optyker_record_fiscal_outcome(p_job_id uuid,p_result_hash text,p_state text,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.optyker_fiscal_jobs;
begin
 select * into j from public.optyker_fiscal_jobs where id=p_job_id for update;
 if not found or j.result_hash is null or j.result_hash is distinct from p_result_hash then raise exception 'Esito non autorizzato'; end if;
 if j.state<>'sending' then return to_jsonb(j); end if;
 if p_state not in ('not_started','uncertain','awaiting_reference') then raise exception 'Esito non valido'; end if;
 update public.optyker_fiscal_jobs set state=p_state,result=p_result,updated_at=now() where id=j.id returning * into j;
 if j.operation='void' then
  update public.optyker_ts_outbox
   set state=case p_state when 'awaiting_reference' then 'voided' when 'not_started' then 'awaiting_configuration' else 'held_for_void' end,
       outcome=coalesce(outcome,'{}')||jsonb_build_object('void_job_id',j.id,'void_state',p_state),updated_at=now()
   where job_id=j.original_job_id and state='held_for_void';
  if p_state='awaiting_reference' then
   update public.optyker_ts_documents set provider_payload=coalesce(provider_payload,'{}')||jsonb_build_object('fiscal_void_job_id',j.id,'fiscal_void_confirmed',true),updated_at=now()
    where payment_id=j.payment_id and provider='optyker_fiscal';
  end if;
 end if;
 return to_jsonb(j);
end;
$$;
revoke all on function public.optyker_record_fiscal_outcome(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_record_fiscal_outcome(uuid,text,text,jsonb) to service_role;

create or replace function public.optyker_confirm_fiscal_reference(p_job_id uuid,p_number text,p_date date,p_operator text,p_ts_document jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.optyker_fiscal_jobs;
begin
 select * into j from public.optyker_fiscal_jobs where id=p_job_id for update;
 if not found or j.state not in ('awaiting_reference','completed') then raise exception 'Stato documento non confermabile'; end if;
 if j.state='completed' and (j.document_number<>p_number or j.document_date<>p_date) then raise exception 'Riferimento già confermato'; end if;
 if p_number is null or p_number !~ '^[0-9]{4}-[0-9]{4}$' or right(p_number,4)='0000' or p_date is null or p_date>current_date then raise exception 'Riferimento non valido'; end if;
 if j.operation='void' and (p_date<(j.document#>>'{original,date}')::date or (p_number=j.document#>>'{original,number}' and p_date=(j.document#>>'{original,date}')::date)) then raise exception 'Riporta il nuovo documento di annullo, non lo scontrino originale'; end if;
 update public.optyker_fiscal_jobs set state='completed',document_number=p_number,document_date=p_date,reference_confirmed_by=p_operator,updated_at=now() where id=p_job_id returning * into j;
 if j.operation='void' then
  update public.optyker_ts_outbox set outcome=coalesce(outcome,'{}')||jsonb_build_object('void_document_number',p_number,'void_document_date',p_date),updated_at=now() where job_id=j.original_job_id and state='voided';
  return to_jsonb(j);
 end if;
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
