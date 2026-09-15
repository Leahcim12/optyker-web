-- Read an existing confirmed fixture, but persist NO intent and make NO network calls.
begin;
do $$
declare j public.optyker_fiscal_jobs;q public.optyker_ts_outbox;blocked boolean;h text:=encode(extensions.gen_random_bytes(32),'hex');action text;k uuid;
begin
 select f.* into j from public.optyker_fiscal_jobs f join public.optyker_ts_outbox t on t.job_id=f.id
 where f.state='completed' and f.operation='sale' and t.state='accepted'
 and not exists(select 1 from public.optyker_ts_cancellations c where c.outbox_id=t.id)
 and not exists(select 1 from public.optyker_unified_voids v where v.original_job_id=f.id)
 order by f.created_at limit 1;
 assert j.id is not null,'Confirmed TS fixture unavailable';
 blocked:=false;begin perform public.optyker_unified_void_begin(j.id,'test','Rollback only',false);exception when others then blocked:=true;end;assert blocked,'Confirmation is mandatory';
 perform public.optyker_unified_void_begin(j.id,'test','Rollback only',true);
 perform public.optyker_unified_void_begin(j.id,'other','Cannot replace original confirmation',true);
 assert (select operator_username='test' and reason='Rollback only' from public.optyker_unified_voids where original_job_id=j.id),'Confirmation immutable on repeated clicks';
 assert public.optyker_unified_void_lease(j.id),'First worker can claim';
 assert not public.optyker_unified_void_lease(j.id),'Second worker cannot run concurrently';
 action:=public.optyker_unified_void_ts_token(j.id,h);assert action='cancel','Cancellation capability created';
 select id into k from public.optyker_ts_cancellations where token_hash=h;
 assert k is not null,'Scoped cancellation exists';
 assert public.optyker_unified_void_ts_token(j.id,encode(extensions.gen_random_bytes(32),'hex')) is null,'Live capability cannot be replaced';
 select * into q from public.optyker_ts_outbox where job_id=j.id;
 assert q.state='accepted' and (select state='completed' from public.optyker_fiscal_jobs where id=j.id),'No TS or RCH operation executed';
 update public.optyker_ts_cancellations set state='uncertain',request_sha256=h,token_used_at=now() where id=k;
 assert public.optyker_unified_void_ts_token(j.id,encode(extensions.gen_random_bytes(32),'hex')) is null,'Uncertain POST without protocol cannot be resent';
 update public.optyker_ts_cancellations set state='submitted',protocol='99260915000000999' where id=k;
 assert public.optyker_unified_void_ts_token(j.id,encode(extensions.gen_random_bytes(32),'hex'))='reconcile','Known protocol permits read-only reconciliation';
 assert not has_table_privilege('anon','public.optyker_unified_voids','SELECT'),'Anonymous intents hidden';
 assert not has_function_privilege('authenticated','public.optyker_unified_void_ts_token(uuid,text)','EXECUTE'),'Browser cannot mint TS capabilities';
end;$$;
rollback;
select 'PASS: confirmation, scoped capabilities, lease, no duplicate POST, permissions; all writes rolled back' as result;
