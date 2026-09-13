-- Run inside BEGIN/ROLLBACK. Fixtures never contact Shopify, RCH or TS.
do $$
declare s uuid:=gen_random_uuid();p uuid:=gen_random_uuid();j uuid:=gen_random_uuid();q uuid:=gen_random_uuid();v uuid:=gen_random_uuid();
 d jsonb; r bigint; a jsonb; denied boolean; fn text;
begin
 foreach fn in array array['optyker_ts_server_credentials()','optyker_ts_claim_verification(text)','optyker_ts_record_verification(bigint,boolean,text,jsonb)','optyker_ts_claim_send(uuid,bigint,jsonb,text)','optyker_ts_finish_send(uuid,uuid,text,text,jsonb)'] loop
  if has_function_privilege('anon','public.'||fn,'execute') or has_function_privilege('authenticated','public.'||fn,'execute') then raise exception 'Public TS privilege: %',fn;end if;
 end loop;
 insert into public.optyker_pos_sales(id,status,total,paid_amount) values(s,'completed',1,1);
 insert into public.optyker_pos_payments(id,sale_id,payment_stage,amount) values(p,s,'balance',1);
 insert into public.optyker_fiscal_jobs(id,payment_id,sale_id,operator_username,serial,state,document,document_number,document_date)
 values(j,p,s,'TS_TEST','72IV6003831','completed','{"tsRequested":true}', '9876-5432','2026-09-12');
 d='{"serial":"72IV6003831","number":"9876-5432","date":"2026-09-12"}';
 insert into public.optyker_ts_outbox(id,job_id,payment_id,document) values(q,j,p,d);
 select revision into r from public.optyker_ts_connection where id;
 update public.optyker_ts_connection set enabled=false where id;
 denied=false;begin perform public.optyker_ts_claim_send(q,r,d,repeat('a',64));exception when others then if sqlerrm<>'TS_NOT_READY' then raise;end if;denied=true;end;
 if not denied then raise exception 'Unverified transport could send';end if;
 update public.optyker_ts_connection set enabled=true,verified_revision=revision where id;
 insert into public.optyker_fiscal_jobs(id,payment_id,sale_id,operator_username,serial,state,document,operation,original_job_id)
 values(v,p,s,'TS_TEST','72IV6003831','prepared','{}','void',j);
 denied=false;begin perform public.optyker_ts_claim_send(q,r,d,repeat('a',64));exception when others then if sqlerrm<>'TS_INVALID_DOCUMENT' then raise;end if;denied=true;end;
 if not denied then raise exception 'Document with pending void could send';end if;
 delete from public.optyker_fiscal_jobs where id=v;
 denied=false;begin perform public.optyker_ts_claim_send(q,r,d||'{"number":"9876-5433"}'::jsonb,repeat('a',64));exception when others then if sqlerrm<>'TS_INVALID_DOCUMENT' then raise;end if;denied=true;end;
 if not denied then raise exception 'Changed snapshot could send';end if;
 a=public.optyker_ts_claim_send(q,r,d,repeat('a',64));
 if a->>'state'<>'sending' or a->>'attempt_id' is null then raise exception 'Missing durable claim';end if;
 if (select issuer->>'business_vat' from public.optyker_ts_attempts where id=(a->>'attempt_id')::uuid) is distinct from (select business_vat from public.optyker_ts_connection where id) then raise exception 'Missing issuer snapshot';end if;
 denied=false;begin perform public.optyker_ts_claim_send(q,r,d,repeat('a',64));exception when others then if sqlerrm<>'TS_ALREADY_ATTEMPTED' then raise;end if;denied=true;end;
 if not denied then raise exception 'Duplicate claim was allowed';end if;
 if public.optyker_ts_finish_send(q,gen_random_uuid(),'uncertain',null,'{}') then raise exception 'Wrong attempt modified state';end if;
 perform public.optyker_ts_finish_send(q,(a->>'attempt_id')::uuid,'uncertain',null,'{"code":"TS_CONNECTION_FAILED"}');
 denied=false;begin perform public.optyker_ts_claim_send(q,r,d,repeat('a',64));exception when others then if sqlerrm<>'TS_ALREADY_ATTEMPTED' then raise;end if;denied=true;end;
 if not denied then raise exception 'Uncertain attempt could be replayed';end if;
 if (select count(*) from public.optyker_ts_attempts where outbox_id=q)<>1 then raise exception 'Duplicate attempt audit';end if;
 insert into public.optyker_ts_verification_jobs(token_hash,expires_at) values(repeat('b',64),now()+interval '1 minute');
 if not public.optyker_ts_claim_verification(repeat('b',64)) or public.optyker_ts_claim_verification(repeat('b',64)) then raise exception 'Verification capability replay';end if;
 update public.optyker_ts_connection set revision=revision+1 where id;
 if (public.optyker_ts_connection_status()->>'transport_ready')::boolean then raise exception 'Old verification survived credential change';end if;
 if public.optyker_ts_record_verification(r,true,'TS_VERIFIED','[]') then raise exception 'Stale verification changed current credentials';end if;
end;$$;
