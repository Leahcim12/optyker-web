-- No customer records or hardware/service requests. All fixtures are rolled back.
begin;
do $$
declare s uuid; p uuid; original uuid; v uuid; other uuid; p2 uuid; j jsonb; blocked boolean; qstate text;
begin
 if has_function_privilege('anon','public.optyker_claim_fiscal_job(uuid,text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.optyker_record_fiscal_outcome(uuid,text,text,jsonb)','EXECUTE') then raise exception 'Public access to fiscal writes'; end if;
 insert into public.optyker_pos_sales(operator_username,status,total) values('SYNTHETIC_ROLLBACK_TEST','completed',70) returning id into s;
 insert into public.optyker_pos_payments(sale_id,payment_stage,amount) values(s,'balance',70) returning id into p;
 insert into public.optyker_pos_payments(sale_id,payment_stage,amount) values(s,'balance',70) returning id into p2;
 insert into public.optyker_fiscal_jobs(payment_id,sale_id,operator_username,serial,state,document,document_number,document_date)
  values(p,s,'SYNTHETIC_ROLLBACK_TEST','SYNTHETIC-VOID-RT','completed','{"tsRequested":true,"totalCents":7000}','1161-0009',current_date) returning id into original;
 insert into public.optyker_ts_outbox(job_id,payment_id,document) values(original,p,'{"synthetic":true}');
 insert into public.optyker_fiscal_jobs(payment_id,sale_id,operator_username,serial,state,operation,original_job_id,document,claim_hash,claim_expires_at)
  values(p,s,'SYNTHETIC_ROLLBACK_TEST','SYNTHETIC-VOID-RT','prepared','void',original,
   jsonb_build_object('operation','void','totalCents',7000,'tsRequested',false,'original',jsonb_build_object('jobId',original,'number','1161-0009','date',current_date)),repeat('a',64),now()+interval '10 minutes') returning id into v;
 insert into public.optyker_fiscal_jobs(payment_id,sale_id,operator_username,serial,state,document) values(p2,s,'SYNTHETIC_ROLLBACK_TEST','SYNTHETIC-VOID-RT','prepared','{}') returning id into other;
 blocked:=false;
 begin
  insert into public.optyker_fiscal_jobs(payment_id,sale_id,operator_username,serial,state,operation,original_job_id,document)
   values(p,s,'SYNTHETIC_ROLLBACK_TEST','SYNTHETIC-VOID-RT','prepared','void',original,'{}');
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Two voids for one original permitted'; end if;
 blocked:=false;
 begin perform public.optyker_claim_fiscal_job(v,repeat('a',64),repeat('b',64),'sale'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Wrong operation accepted'; end if;
 if (select state from public.optyker_ts_outbox where job_id=original)<>'awaiting_configuration' then raise exception 'Failed claim modified TS'; end if;
 -- A pending TS transport must never be silently replaced with an annulled row.
 update public.optyker_ts_outbox set state='accepted',protocol='SYNTHETIC_PROTOCOL' where job_id=original;
 blocked:=false;
 begin perform public.optyker_claim_fiscal_job(v,repeat('a',64),repeat('b',64),'void'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Accepted TS expense was voided without TS rectification'; end if;
 update public.optyker_ts_outbox set state='awaiting_configuration',protocol=null where job_id=original;
 j:=public.optyker_claim_fiscal_job(v,repeat('a',64),repeat('b',64),'void');
 if j->>'state'<>'sending' or (select state from public.optyker_ts_outbox where job_id=original)<>'held_for_void' then raise exception 'Claim and TS hold not atomic'; end if;
 blocked:=false;
 begin perform public.optyker_claim_fiscal_job(v,repeat('a',64),repeat('c',64),'void'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Capability reused'; end if;
 blocked:=false;
 begin update public.optyker_fiscal_jobs set state='sending' where id=other; exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Sale bypassed active void printer lock'; end if;
 blocked:=false;
 begin perform public.optyker_record_fiscal_outcome(v,repeat('c',64),'not_started','{}'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Wrong outcome token accepted'; end if;
 perform public.optyker_record_fiscal_outcome(v,repeat('b',64),'not_started','{"writeStarted":false}');
 if (select state from public.optyker_ts_outbox where job_id=original)<>'awaiting_configuration' then raise exception 'No-write outcome did not release TS hold'; end if;
 update public.optyker_fiscal_jobs set state='prepared',claim_hash=repeat('d',64) where id=v;
 perform public.optyker_claim_fiscal_job(v,repeat('d',64),repeat('e',64),'void');
 perform public.optyker_record_fiscal_outcome(v,repeat('e',64),'uncertain','{"writeStarted":true}');
 if (select state from public.optyker_ts_outbox where job_id=original)<>'held_for_void' then raise exception 'Uncertain void released TS'; end if;
 blocked:=false;
 begin update public.optyker_fiscal_jobs set state='sending' where id=other; exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Uncertain void released printer'; end if;
 -- Synthetic fixture reset only: production has no automatic uncertain-to-retry path.
 update public.optyker_fiscal_jobs set state='sending' where id=v;
 perform public.optyker_record_fiscal_outcome(v,repeat('e',64),'awaiting_reference','{"writeStarted":true,"commandsAcknowledged":1,"idleAfter":true}');
 if (select state from public.optyker_ts_outbox where job_id=original)<>'voided' then raise exception 'Acknowledged void did not exclude TS'; end if;
 perform public.optyker_record_fiscal_outcome(v,repeat('e',64),'not_started','{}');
 if (select state from public.optyker_ts_outbox where job_id=original)<>'voided' then raise exception 'Outcome replay resurrected expense'; end if;
 blocked:=false;
 begin perform public.optyker_confirm_fiscal_reference(v,'1161-0009',current_date,'SYNTHETIC_ROLLBACK_TEST',null); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Original number accepted as void reference'; end if;
 perform public.optyker_confirm_fiscal_reference(v,'1161-0010',current_date,'SYNTHETIC_ROLLBACK_TEST',null);
 perform public.optyker_confirm_fiscal_reference(v,'1161-0010',current_date,'SYNTHETIC_ROLLBACK_TEST',null);
 perform public.optyker_confirm_fiscal_reference(original,'1161-0009',current_date,'SYNTHETIC_ROLLBACK_TEST','{}');
 if (select count(*) from public.optyker_ts_outbox where payment_id=p)<>1 or (select state from public.optyker_ts_outbox where job_id=original)<>'voided' then raise exception 'Reference replay recreated TS expense'; end if;
 if (select status from public.optyker_pos_sales where id=s)<>'completed' then raise exception 'Void changed Shopify sale status'; end if;
 if (select count(*) from public.optyker_pos_payments where sale_id=s)<>2 then raise exception 'Void changed payments'; end if;
end;
$$;
rollback;
select 'Void claim, shared printer lock, outcome recovery, TS hold/exclusion, reference immutability and unchanged sale/payment verified. Fixtures rolled back.' as verification;
