-- Synthetic data only; no customers, printer IO or TS requests. Always rolled back.
begin;
do $$
declare sale uuid; payment1 uuid; payment2 uuid; job1 uuid; job2 uuid; n integer; blocked boolean;
begin
 if has_table_privilege('anon','public.optyker_fiscal_jobs','SELECT') or has_table_privilege('authenticated','public.optyker_ts_outbox','SELECT') then raise exception 'Public fiscal access'; end if;
 if has_function_privilege('anon','public.optyker_confirm_fiscal_reference(uuid,text,date,text,jsonb)','EXECUTE') then raise exception 'Public reference mutation'; end if;
 select count(*) into n from pg_class where oid in ('public.optyker_fiscal_jobs'::regclass,'public.optyker_ts_outbox'::regclass) and relrowsecurity;
 if n<>2 then raise exception 'RLS missing'; end if;
 insert into public.optyker_pos_sales(operator_username,status,total) values('SYNTHETIC_ROLLBACK_TEST','completed',25) returning id into sale;
 insert into public.optyker_pos_payments(sale_id,payment_stage,amount) values(sale,'balance',12.5) returning id into payment1;
 insert into public.optyker_pos_payments(sale_id,payment_stage,amount) values(sale,'balance',12.5) returning id into payment2;
 insert into public.optyker_fiscal_jobs(payment_id,sale_id,operator_username,serial,state,document) values(payment1,sale,'SYNTHETIC_ROLLBACK_TEST','SYNTHETIC-REGISTER','sending','{"tsRequested":true,"totalCents":1250}') returning id into job1;
 blocked:=false;
 begin
  insert into public.optyker_fiscal_jobs(payment_id,sale_id,operator_username,serial,state,document) values(payment1,sale,'SYNTHETIC_ROLLBACK_TEST','SYNTHETIC-REGISTER','prepared','{}');
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Duplicate payment allowed'; end if;
 insert into public.optyker_fiscal_jobs(payment_id,sale_id,operator_username,serial,state,document) values(payment2,sale,'SYNTHETIC_ROLLBACK_TEST','SYNTHETIC-REGISTER','prepared','{}') returning id into job2;
 blocked:=false;
 begin update public.optyker_fiscal_jobs set state='sending' where id=job2; exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Concurrent printer claim allowed'; end if;
 update public.optyker_fiscal_jobs set state='uncertain' where id=job1;
 blocked:=false;
 begin update public.optyker_fiscal_jobs set state='sending' where id=job2; exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Uncertain printer was unlocked'; end if;
 update public.optyker_fiscal_jobs set state='awaiting_reference' where id=job1;
 perform public.optyker_confirm_fiscal_reference(job1,'1160-0001','2026-09-12','SYNTHETIC_ROLLBACK_TEST','{"opposition":true,"fiscalCode":"","number":"1160-0001"}');
 update public.optyker_ts_outbox set state='accepted',protocol='SYNTHETIC_TEST_ONLY' where job_id=job1;
 perform public.optyker_confirm_fiscal_reference(job1,'1160-0001','2026-09-12','SYNTHETIC_ROLLBACK_TEST','{"opposition":true,"fiscalCode":"","number":"1160-0001"}');
 select count(*) into n from public.optyker_ts_outbox where job_id=job1 and state='accepted' and protocol='SYNTHETIC_TEST_ONLY';
 if n<>1 then raise exception 'Reference replay duplicated or reset TS outcome'; end if;
 blocked:=false;
 begin perform public.optyker_confirm_fiscal_reference(job1,'1160-0002','2026-09-12','SYNTHETIC_ROLLBACK_TEST','{}'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Confirmed reference overwritten'; end if;
end;
$$;
rollback;
select 'Fiscal unique constraints, printer lock, RLS and atomic reference/TS queue verified; synthetic rows rolled back.' as verification;
