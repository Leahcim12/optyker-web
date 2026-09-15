-- An authorized cancellation is separate from the original TS transmission and RCH void.
create table public.optyker_ts_cancellations (
 id uuid primary key default gen_random_uuid(),
 outbox_id uuid not null unique references public.optyker_ts_outbox(id),
 original_protocol text not null check(original_protocol ~ '^[0-9]{17}$'),
 expected_number text not null check(expected_number ~ '^[0-9]{4}-[0-9]{4}$'),
 expected_date date not null,
 expected_total_cents integer not null check(expected_total_cents>0),
 reason text not null check(length(reason) between 3 and 200),
 authorized_by text not null check(length(authorized_by) between 3 and 300),
 state text not null default 'prepared' check(state in ('prepared','checking','not_sent','sending','submitted','uncertain','rejected','accepted')),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 token_action text not null default 'cancel' check(token_action in ('cancel','reconcile')),
 token_issued_at timestamptz not null default now(),
 token_expires_at timestamptz not null,
 token_used_at timestamptz,
 request_sha256 text check(request_sha256 ~ '^[a-f0-9]{64}$'),
 protocol text check(protocol ~ '^[0-9]{17}$'),
 outcome jsonb not null default '{}',
 receipt_data text check(length(receipt_data)<=2000000),
 receipt_kind text check(receipt_kind in ('pdf','zip')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(token_expires_at>token_issued_at and token_expires_at<=token_issued_at+interval '5 minutes')
);
alter table public.optyker_ts_cancellations enable row level security;
revoke all on public.optyker_ts_cancellations from public,anon,authenticated;
grant select,insert,update on public.optyker_ts_cancellations to service_role;
alter table public.optyker_ts_outbox drop constraint optyker_ts_outbox_state_check;
alter table public.optyker_ts_outbox add constraint optyker_ts_outbox_state_check
 check(state in ('awaiting_configuration','ready','sending','submitted','uncertain','accepted','rejected','held_for_void','voided','ts_cancelled'));

create function public.optyker_ts_claim_cancellation(p_hash text,p_action text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare k public.optyker_ts_cancellations;q public.optyker_ts_outbox;j public.optyker_fiscal_jobs;a public.optyker_ts_attempts;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('cancel','reconcile') then raise exception 'TS_UNAUTHORIZED';end if;
 select * into k from public.optyker_ts_cancellations where token_hash=p_hash for update;
 if not found or k.token_action<>p_action or k.token_used_at is not null or k.token_expires_at<=now() then raise exception 'TS_UNAUTHORIZED';end if;
 select * into q from public.optyker_ts_outbox where id=k.outbox_id;
 select * into j from public.optyker_fiscal_jobs where id=q.job_id for update;
 select * into q from public.optyker_ts_outbox where id=k.outbox_id for update;
 select * into a from public.optyker_ts_attempts where id=q.attempt_id and outbox_id=q.id;
 if q.state is distinct from 'accepted' or q.protocol is distinct from k.original_protocol or a.state is distinct from 'accepted'
 or a.protocol is distinct from k.original_protocol or a.issuer is null or j.operation is distinct from 'sale' or j.state is distinct from 'completed'
 or j.document_number is distinct from k.expected_number or j.document_date is distinct from k.expected_date
 or (j.document->>'totalCents')::integer is distinct from k.expected_total_cents
 or q.document->>'number' is distinct from k.expected_number or q.document->>'date' is distinct from k.expected_date::text
 or exists(select 1 from public.optyker_fiscal_jobs v where v.original_job_id=j.id and v.state<>'not_started')
 then raise exception 'TS_INVALID_DOCUMENT';end if;
 if (p_action='cancel' and k.state<>'prepared') or (p_action='reconcile' and (k.state not in ('submitted','uncertain') or k.protocol is null)) then raise exception 'TS_ALREADY_ATTEMPTED';end if;
 update public.optyker_ts_cancellations set token_used_at=now(),state=case when p_action='cancel' then 'checking' else state end,updated_at=now() where id=k.id returning * into k;
 return jsonb_build_object('cancellation',to_jsonb(k)-'token_hash','outbox',to_jsonb(q),'issuer',a.issuer);
end;$$;
revoke all on function public.optyker_ts_claim_cancellation(text,text) from public,anon,authenticated;
grant execute on function public.optyker_ts_claim_cancellation(text,text) to service_role;

create function public.optyker_ts_finish_cancellation(p_id uuid,p_state text,p_protocol text,p_outcome jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare k public.optyker_ts_cancellations;q public.optyker_ts_outbox;matches integer;
begin
 select * into k from public.optyker_ts_cancellations where id=p_id for update;
 if not found or p_state is null or p_state not in ('not_sent','submitted','uncertain','rejected','accepted') then raise exception 'TS_STATE_CHANGED';end if;
 if k.state='accepted' then return true;end if;
 if p_state='not_sent' then
  if k.state<>'checking' or k.request_sha256 is not null then raise exception 'TS_STATE_CHANGED';end if;
 elsif k.state not in ('sending','submitted','uncertain') or k.request_sha256 is null then raise exception 'TS_STATE_CHANGED';
 end if;
 if p_protocol is not null and p_protocol !~ '^[0-9]{17}$' then raise exception 'TS_INVALID_PROTOCOL';end if;
 if k.protocol is not null and p_protocol is distinct from k.protocol then raise exception 'TS_STATE_CHANGED';end if;
 if p_state='accepted' then
  if p_protocol is null or p_outcome->>'code' is distinct from 'TS_CANCELLATION_CONFIRMED' or p_outcome->>'esito' is distinct from '0' then raise exception 'TS_INVALID_RESPONSE';end if;
  select count(*) into matches from jsonb_array_elements(p_outcome->'outcomes') x
   where x->>'protocol'=p_protocol and x->>'state'='2' and x->>'sent'='1' and x->>'accepted'='1' and x->>'errors'='0';
  if matches<>1 or jsonb_array_length(p_outcome->'outcomes')<>1 then raise exception 'TS_INVALID_RESPONSE';end if;
  select * into q from public.optyker_ts_outbox where id=k.outbox_id for update;
  if q.state is distinct from 'accepted' or q.protocol is distinct from k.original_protocol then raise exception 'TS_STATE_CHANGED';end if;
  update public.optyker_ts_outbox set state='ts_cancelled',
   outcome=coalesce(outcome,'{}')||jsonb_build_object('cancellation_id',k.id,'cancellation_protocol',p_protocol,'cancellation_confirmed',true),
   updated_at=now() where id=q.id;
 end if;
 update public.optyker_ts_cancellations set state=p_state,protocol=p_protocol,outcome=p_outcome,updated_at=now() where id=k.id;
 return true;
end;$$;
revoke all on function public.optyker_ts_finish_cancellation(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_ts_finish_cancellation(uuid,text,text,jsonb) to service_role;

create function public.optyker_ts_can_void(p_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select
  (q.state='awaiting_configuration' and q.protocol is null)
  or (q.state='ts_cancelled' and exists(select 1 from public.optyker_ts_cancellations k
   where k.outbox_id=q.id and k.state='accepted' and k.original_protocol=q.protocol
   and k.protocol=q.outcome->>'cancellation_protocol' and k.expected_number=q.document->>'number'
   and k.expected_date::text=q.document->>'date'))
 from public.optyker_ts_outbox q where q.id=p_id),false);
$$;
revoke all on function public.optyker_ts_can_void(uuid) from public,anon,authenticated;
grant execute on function public.optyker_ts_can_void(uuid) to service_role;

create or replace function public.optyker_claim_fiscal_job(p_job_id uuid,p_claim_hash text,p_result_hash text,p_operation text)
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
   if not public.optyker_ts_can_void(q.id) then raise exception 'Spesa TS già elaborata o sospesa: occorre verificarne la rettifica prima dell’annullo'; end if;
   update public.optyker_ts_outbox set state='held_for_void',outcome=coalesce(outcome,'{}')||jsonb_build_object('void_job_id',j.id,'void_previous_ts_state',q.state),updated_at=now() where id=q.id;
  end if;
 end if;
 -- This update uses the existing unique index on serial for sending/uncertain.
 update public.optyker_fiscal_jobs set state='sending',claim_hash=null,result_hash=p_result_hash,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end;
$$;
revoke all on function public.optyker_claim_fiscal_job(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.optyker_claim_fiscal_job(uuid,text,text,text) to service_role;

create or replace function public.optyker_record_fiscal_outcome(p_job_id uuid,p_result_hash text,p_state text,p_result jsonb)
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
   set state=case p_state when 'awaiting_reference' then 'voided' when 'not_started' then case when outcome->>'void_previous_ts_state'='ts_cancelled' then 'ts_cancelled' else 'awaiting_configuration' end else 'held_for_void' end,
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

