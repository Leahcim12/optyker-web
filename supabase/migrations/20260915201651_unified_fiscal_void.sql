-- One durable operator-confirmed intent per original receipt. No payment/refund writes.
create table public.optyker_unified_voids (
 original_job_id uuid primary key references public.optyker_fiscal_jobs(id),
 operator_username text not null,
 reason text not null check(length(reason) between 3 and 200),
 confirmed_at timestamptz not null default now(),
 lease_until timestamptz,
 next_check_at timestamptz not null default now(),
 message text not null default '',
 completed_at timestamptz
);
alter table public.optyker_unified_voids enable row level security;
revoke all on public.optyker_unified_voids from public,anon,authenticated;
grant select,insert,update on public.optyker_unified_voids to service_role;

create function public.optyker_unified_void_begin(p_job_id uuid,p_operator text,p_reason text,p_confirm boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.optyker_fiscal_jobs;
begin
 if p_confirm is not true or nullif(trim(p_operator),'') is null then raise exception 'Conferma operatore richiesta';end if;
 select * into j from public.optyker_fiscal_jobs where id=p_job_id for update;
 if not found or j.operation<>'sale' or j.state<>'completed' or j.document_number is null or j.document_date is null then raise exception 'Scontrino originale non confermato';end if;
 insert into public.optyker_unified_voids(original_job_id,operator_username,reason) values(j.id,p_operator,p_reason) on conflict do nothing;
 return true;
end;$$;

create function public.optyker_unified_void_lease(p_job_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 with claimed as(update public.optyker_unified_voids set lease_until=now()+interval '5 minutes'
 where original_job_id=p_job_id and completed_at is null and next_check_at<=now() and (lease_until is null or lease_until<now()) returning 1)
 select exists(select 1 from claimed);
$$;

create function public.optyker_unified_void_ts_token(p_job_id uuid,p_hash text)
returns text language plpgsql security invoker set search_path='' as $$
declare v public.optyker_unified_voids;j public.optyker_fiscal_jobs;q public.optyker_ts_outbox;k public.optyker_ts_cancellations;action text;
begin
 if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'TS_UNAUTHORIZED';end if;
 select * into v from public.optyker_unified_voids where original_job_id=p_job_id;
 if not found then raise exception 'TS_UNAUTHORIZED';end if;
 select * into j from public.optyker_fiscal_jobs where id=p_job_id for update;
 select * into q from public.optyker_ts_outbox where job_id=p_job_id for update;
 if not found or q.state<>'accepted' or q.protocol is null then return null;end if;
 select * into k from public.optyker_ts_cancellations where outbox_id=q.id for update;
 if not found then
  insert into public.optyker_ts_cancellations(outbox_id,original_protocol,expected_number,expected_date,expected_total_cents,reason,authorized_by,token_hash,token_expires_at)
  values(q.id,q.protocol,j.document_number,j.document_date,(j.document->>'totalCents')::int,v.reason,'Optyker operator: '||v.operator_username,p_hash,now()+interval '4 minutes');
  return 'cancel';
 end if;
 if k.state='prepared' and (k.token_used_at is not null or k.token_expires_at>now()) then return null;end if;
 if k.state='prepared' or (k.state='not_sent' and k.request_sha256 is null) then action:='cancel';
 elsif k.state in ('submitted','uncertain') and k.protocol is not null then action:='reconcile';
 else return null;end if;
 update public.optyker_ts_cancellations set state=case when action='cancel' then 'prepared' else state end,
 token_hash=p_hash,token_action=action,token_issued_at=now(),token_expires_at=now()+interval '4 minutes',token_used_at=null,updated_at=now() where id=k.id;
 return action;
end;$$;

-- A new TS submission must not race a confirmed cancellation request.
create function optyker_private.unified_void_send_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.state='sending' and old.state is distinct from 'sending' and exists(select 1 from public.optyker_unified_voids where original_job_id=new.job_id) then raise exception 'TS_VOID_REQUESTED';end if;
 return new;
end;$$;
create trigger optyker_unified_void_send_guard before update of state on public.optyker_ts_outbox for each row execute function optyker_private.unified_void_send_guard();
revoke all on function optyker_private.unified_void_send_guard() from public,anon,authenticated;
revoke all on function public.optyker_unified_void_begin(uuid,text,text,boolean), public.optyker_unified_void_lease(uuid), public.optyker_unified_void_ts_token(uuid,text) from public,anon,authenticated;
grant execute on function public.optyker_unified_void_begin(uuid,text,text,boolean), public.optyker_unified_void_lease(uuid), public.optyker_unified_void_ts_token(uuid,text) to service_role;
