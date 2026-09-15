-- All changes, including the test cancellation, MUST be rolled back.
do $test$
declare q public.optyker_ts_outbox;j public.optyker_fiscal_jobs;k uuid;scope jsonb;
begin
 if has_table_privilege('anon','public.optyker_ts_cancellations','SELECT') or has_table_privilege('authenticated','public.optyker_ts_cancellations','INSERT')
 or has_function_privilege('anon','public.optyker_ts_claim_cancellation(text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.optyker_ts_finish_cancellation(uuid,text,text,jsonb)','EXECUTE') then raise exception 'TEST_UNAUTHORIZED_ACCESS';end if;
 select * into j from public.optyker_fiscal_jobs where document_number='1164-0005' and document_date='2026-09-15' and operation='sale';
 select * into q from public.optyker_ts_outbox where job_id=j.id;
 if q.state is distinct from 'accepted' then raise exception 'TEST_FIXTURE_NOT_ACCEPTED';end if;
 if public.optyker_ts_can_void(q.id) then raise exception 'TEST_ACCEPTED_SPEND_VOIDABLE';end if;
 update public.optyker_ts_outbox set state='ts_cancelled' where id=q.id;
 if public.optyker_ts_can_void(q.id) then raise exception 'TEST_UNPROVEN_DELETION_VOIDABLE';end if;
 update public.optyker_ts_outbox set state='accepted' where id=q.id;
 insert into public.optyker_ts_cancellations(outbox_id,original_protocol,expected_number,expected_date,expected_total_cents,reason,authorized_by,token_hash,token_expires_at)
 values(q.id,q.protocol,j.document_number,j.document_date,(j.document->>'totalCents')::integer,'Rollback test','Automated test; no external request',repeat('a',64),now()+interval '4 minutes') returning id into k;
 begin
  perform public.optyker_ts_claim_cancellation(repeat('b',64),'cancel');
  raise exception 'TEST_BAD_TOKEN_ACCEPTED';
 exception when others then if sqlerrm<>'TS_UNAUTHORIZED' then raise;end if;end;
 scope:=public.optyker_ts_claim_cancellation(repeat('a',64),'cancel');
 if scope#>>'{cancellation,state}' is distinct from 'checking' then raise exception 'TEST_CLAIM_FAILED';end if;
 begin
  perform public.optyker_ts_claim_cancellation(repeat('a',64),'cancel');
  raise exception 'TEST_DUPLICATE_CLAIM_ACCEPTED';
 exception when others then if sqlerrm<>'TS_UNAUTHORIZED' then raise;end if;end;
 begin
  perform public.optyker_ts_finish_cancellation(k,'accepted','99260915000000002','{}');
  raise exception 'TEST_PREMATURE_SUCCESS';
 exception when others then if sqlerrm<>'TS_STATE_CHANGED' then raise;end if;end;
 update public.optyker_ts_cancellations set state='sending',request_sha256=repeat('c',64) where id=k;
 begin
  perform public.optyker_ts_finish_cancellation(k,'accepted','99260915000000002','{"code":"TS_CANCELLATION_CONFIRMED","esito":"0","outcomes":[]}');
  raise exception 'TEST_MISSING_EVIDENCE_ACCEPTED';
 exception when others then if sqlerrm<>'TS_INVALID_RESPONSE' then raise;end if;end;
 perform public.optyker_ts_finish_cancellation(k,'accepted','99260915000000002','{"code":"TS_CANCELLATION_CONFIRMED","esito":"0","outcomes":[{"protocol":"99260915000000002","state":"2","sent":"1","accepted":"1","errors":"0"}]}');
 if not public.optyker_ts_can_void(q.id) then raise exception 'TEST_CONFIRMED_CANCELLATION_BLOCKED';end if;
 if (select protocol from public.optyker_ts_outbox where id=q.id) is distinct from q.protocol then raise exception 'TEST_ORIGINAL_PROTOCOL_CHANGED';end if;
 if (select state from public.optyker_fiscal_jobs where id=j.id) is distinct from 'completed' then raise exception 'TEST_RCH_CHANGED';end if;
end;$test$;

