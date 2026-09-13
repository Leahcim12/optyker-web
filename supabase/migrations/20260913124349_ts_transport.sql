-- TS transport remains disabled until a real, read-only authentication check succeeds.
alter table public.optyker_ts_connection
 add column verified_revision bigint,
 add column verified_at timestamptz,
 add column enabled boolean not null default false,
 add column last_check_code text,
 add column last_check_codes jsonb not null default '[]',
 add column last_check_at timestamptz,
 add column kit_sha256 text,
 add column transport_version text;
alter table public.optyker_ts_technical_files drop constraint optyker_ts_technical_files_review_state_check;
alter table public.optyker_ts_technical_files add constraint optyker_ts_technical_files_review_state_check check(review_state in ('pending_review','verified','rejected'));
update public.optyker_ts_technical_files set review_state='verified'
 where sha256='02cbcdb02702fcc3dad2d157de64dcf0d3b591639792bdf1ba2d0b7d8d5aaccb';
update public.optyker_ts_connection set kit_sha256='02cbcdb02702fcc3dad2d157de64dcf0d3b591639792bdf1ba2d0b7d8d5aaccb',transport_version='20260913-ts3' where id;
alter table public.optyker_ts_outbox drop constraint optyker_ts_outbox_state_check;
alter table public.optyker_ts_outbox add constraint optyker_ts_outbox_state_check check(state in ('awaiting_configuration','ready','sending','submitted','uncertain','accepted','rejected','held_for_void','voided'));
alter table public.optyker_ts_outbox
 add column attempt_id uuid,
 add column sent_revision bigint,
 add column receipt_data text check(length(receipt_data)<=2000000),
 add column receipt_kind text check(receipt_kind in ('pdf','zip'));

create table public.optyker_ts_attempts (
 id uuid primary key default gen_random_uuid(),outbox_id uuid not null references public.optyker_ts_outbox(id),
 revision bigint not null,request_sha256 text not null check(request_sha256 ~ '^[a-f0-9]{64}$'),
 state text not null,protocol text,outcome jsonb,
 started_at timestamptz not null default now(),finished_at timestamptz
);
alter table public.optyker_ts_attempts enable row level security;
revoke all on public.optyker_ts_attempts from public,anon,authenticated;
grant select,insert,update on public.optyker_ts_attempts to service_role;

-- Single-use capability for an administrator-scheduled READ-ONLY connection check.
-- It cannot send expenses, retrieve credentials or change the configured TS account.
create table public.optyker_ts_verification_jobs (
 id uuid primary key default gen_random_uuid(),token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now(),
 check(expires_at<=created_at+interval '5 minutes')
);
alter table public.optyker_ts_verification_jobs enable row level security;
revoke all on public.optyker_ts_verification_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.optyker_ts_verification_jobs to service_role;
create function public.optyker_ts_claim_verification(p_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed uuid;
begin
 update public.optyker_ts_verification_jobs set used_at=now()
 where token_hash=p_hash and used_at is null and expires_at>now() returning id into claimed;
 return claimed is not null;
end;$$;

create or replace function public.optyker_ts_connection_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('username',username,'owner_code',owner_code,'owner_fiscal_code',owner_fiscal_code,'business_vat',business_vat,
 'password_saved',password_secret_id is not null,'pin_saved',pin_secret_id is not null,'revision',revision,'updated_at',updated_at,
 'credentials_verified',coalesce(verified_revision=revision,false),'verified_at',verified_at,
 'transport_ready',enabled and coalesce(verified_revision=revision,false) and kit_sha256='02cbcdb02702fcc3dad2d157de64dcf0d3b591639792bdf1ba2d0b7d8d5aaccb' and now()<'2027-01-23 15:27:17+00'::timestamptz,
 'enabled',enabled,'last_check_code',last_check_code,'last_check_codes',last_check_codes,'last_check_at',last_check_at,'kit_sha256',kit_sha256,'transport_version',transport_version)
 from public.optyker_ts_connection where id;
$$;
-- Server-only credential accessor. No client role can invoke this function.
create function public.optyker_ts_server_credentials() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('username',c.username,'password',p.decrypted_secret,'pin',n.decrypted_secret,
 'owner_code',c.owner_code,'owner_fiscal_code',c.owner_fiscal_code,'business_vat',c.business_vat,'revision',c.revision)
 from public.optyker_ts_connection c
 left join vault.decrypted_secrets p on p.id=c.password_secret_id
 left join vault.decrypted_secrets n on n.id=c.pin_secret_id where c.id;
$$;
create function public.optyker_ts_record_verification(p_revision bigint,p_ok boolean,p_code text,p_codes jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed boolean;
begin
 update public.optyker_ts_connection set verified_revision=case when p_ok then revision else null end,
 verified_at=case when p_ok then now() else null end,enabled=p_ok,last_check_code=p_code,
 last_check_codes=p_codes,last_check_at=now() where id and revision=p_revision returning true into changed;
 return coalesce(changed,false);
end;$$;
create function public.optyker_ts_claim_send(p_id uuid,p_revision bigint,p_document jsonb,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.optyker_ts_outbox;j public.optyker_fiscal_jobs;c public.optyker_ts_connection;attempt uuid;
begin
 select * into q from public.optyker_ts_outbox where id=p_id;
 if not found then raise exception 'TS_INVALID_DOCUMENT'; end if;
 -- Same original-job -> outbox lock order as fiscal voids.
 select * into j from public.optyker_fiscal_jobs where id=q.job_id for update;
 select * into q from public.optyker_ts_outbox where id=p_id for update;
 select * into c from public.optyker_ts_connection where id for share;
 if not c.enabled or c.verified_revision is distinct from c.revision or c.revision<>p_revision
 or c.kit_sha256 is distinct from '02cbcdb02702fcc3dad2d157de64dcf0d3b591639792bdf1ba2d0b7d8d5aaccb'
 or now()>='2027-01-23 15:27:17+00'::timestamptz then raise exception 'TS_NOT_READY'; end if;
 if q.state<>'awaiting_configuration' or q.attempt_id is not null or q.protocol is not null then raise exception 'TS_ALREADY_ATTEMPTED'; end if;
 if j.operation<>'sale' or j.state<>'completed' or not coalesce((j.document->>'tsRequested')::boolean,false)
 or q.document is distinct from p_document or q.document->>'number' is distinct from j.document_number
 or q.document->>'date' is distinct from j.document_date::text or q.document->>'serial' is distinct from j.serial
 or exists(select 1 from public.optyker_fiscal_jobs v where v.original_job_id=j.id and v.operation='void' and v.state<>'not_started')
 then raise exception 'TS_INVALID_DOCUMENT'; end if;
 insert into public.optyker_ts_attempts(outbox_id,revision,request_sha256,state) values(q.id,c.revision,p_hash,'sending') returning id into attempt;
 update public.optyker_ts_outbox set state='sending',attempt_id=attempt,sent_revision=c.revision,updated_at=now() where id=q.id returning * into q;
 return to_jsonb(q);
end;$$;
create function public.optyker_ts_finish_send(p_id uuid,p_attempt uuid,p_state text,p_protocol text,p_outcome jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed boolean;
begin
 if p_state not in ('submitted','uncertain','rejected','accepted') or (p_protocol is not null and p_protocol !~ '^[0-9]{17}$')
 or (p_state in ('submitted','accepted') and p_protocol is null) then raise exception 'TS_INVALID_RESPONSE';end if;
 update public.optyker_ts_outbox set state=p_state,protocol=coalesce(p_protocol,protocol),outcome=p_outcome,updated_at=now()
 where id=p_id and attempt_id=p_attempt and state in ('sending','submitted','uncertain') returning true into changed;
 if changed then update public.optyker_ts_attempts set state=p_state,protocol=p_protocol,outcome=p_outcome,finished_at=now() where id=p_attempt and outbox_id=p_id;end if;
 return coalesce(changed,false);
end;$$;
revoke all on function public.optyker_ts_claim_verification(text) from public,anon,authenticated;
revoke all on function public.optyker_ts_server_credentials() from public,anon,authenticated;
revoke all on function public.optyker_ts_record_verification(bigint,boolean,text,jsonb) from public,anon,authenticated;
revoke all on function public.optyker_ts_claim_send(uuid,bigint,jsonb,text) from public,anon,authenticated;
revoke all on function public.optyker_ts_finish_send(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_ts_claim_verification(text) to service_role;
grant execute on function public.optyker_ts_server_credentials() to service_role;
grant execute on function public.optyker_ts_record_verification(bigint,boolean,text,jsonb) to service_role;
grant execute on function public.optyker_ts_claim_send(uuid,bigint,jsonb,text) to service_role;
grant execute on function public.optyker_ts_finish_send(uuid,uuid,text,text,jsonb) to service_role;
