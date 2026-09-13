-- Bind outcome retrieval to the identity that sent the expense, independently of password rotation.
alter table public.optyker_ts_attempts add column issuer jsonb;
create or replace function public.optyker_ts_claim_send(p_id uuid,p_revision bigint,p_document jsonb,p_hash text) returns jsonb
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
 insert into public.optyker_ts_attempts(outbox_id,revision,request_sha256,state,issuer) values(q.id,c.revision,p_hash,'sending',jsonb_build_object('username',c.username,'owner_code',c.owner_code,'owner_fiscal_code',c.owner_fiscal_code,'business_vat',c.business_vat)) returning id into attempt;
 update public.optyker_ts_outbox set state='sending',attempt_id=attempt,sent_revision=c.revision,updated_at=now() where id=q.id returning * into q;
 return to_jsonb(q);
end;$$;
