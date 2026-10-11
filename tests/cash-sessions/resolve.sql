\set ON_ERROR_STOP on
-- Synthetic data only. Runs after schema.sql and the cash session migrations.
begin;
alter table public.optyker_rch_remote_commands add column if not exists completed_at timestamptz, add column if not exists updated_at timestamptz;
do $$
declare d date:=(now() at time zone 'Europe/Rome')::date;m jsonb;r jsonb;p jsonb;op uuid;op2 uuid;cmd uuid;cmd2 uuid;closures int;
begin
 insert into fixture_day_flows values(d,100,40,60,2) on conflict(day) do update set total=excluded.total,cash=excluded.cash,card=excluded.card,n=excluded.n;
 insert into optyker_rch_connectors(active,serial,last_seen_at,last_status,connector_version) values(true,'72IV6003831',clock_timestamp(),'{"ok":true,"mode":"REG","idleState":"0","busy":0,"paperEnd":0,"coverOpen":0,"errorCode":0,"printerError":0}','2.2-daily-closure');
 m:=optyker_cash_session_state(d);
 r:=optyker_cash_session_change(gen_random_uuid(),d,'open','TEST',m#>>'{session,token}','{"opening_cash":70,"opening_checks":0,"notes":"fixture"}');assert r->>'state'='completed';

 -- A fiscal closure whose answer was lost: the operation needs attention.
 m:=optyker_cash_session_state(d);op:=gen_random_uuid();
 p:='{"cash_counted":110,"checks_counted":0,"bank_deposit_cash":0,"bank_deposit_checks":0,"safe_deposit_cash":40,"safe_deposit_checks":0,"notes":"lost answer","fiscal":true}';
 r:=optyker_cash_session_change(op,d,'close','GIORGIA TEST',m#>>'{session,token}',p);assert r->>'state'='pending','closure queued';
 select command_id into cmd from optyker_cash_session_operations where id=op;assert (select kind from optyker_rch_remote_commands where id=cmd)='daily_closure';
 update optyker_rch_remote_commands set state='completed',completed_at=clock_timestamp(),result='{"ok":false,"state":"uncertain","error":"Connessione sottostante chiusa"}' where id=cmd;
 r:=optyker_cash_session_finish(op);assert r->>'state'='attention','uncertain outcome needs attention';
 m:=optyker_cash_session_state(d);
 assert m#>>'{session,pending,state}'='attention' and m#>>'{session,pending,command_outcome}'='uncertain' and m#>>'{session,pending,operator_username}'='GIORGIA TEST','state exposes the closure to verify';

 -- Attention blocks new closures, never the opening of another day.
 begin perform optyker_cash_session_change(gen_random_uuid(),d,'close','TEST',m#>>'{session,token}',jsonb_set(p,'{fiscal}','false'));raise exception 'ATTENTION_NOT_BLOCKING';
 exception when others then assert sqlerrm like 'Una chiusura precedente ha un esito RCH da verificare%',sqlerrm;end;
 m:=optyker_cash_session_state(d-1);
 r:=optyker_cash_session_change(gen_random_uuid(),d-1,'open','TEST',m#>>'{session,token}','{"opening_cash":70,"opening_checks":0,"notes":"other day"}');
 assert r->>'state'='completed','opening allowed while a closure is being verified';
 assert (select count(*) from optyker_rch_remote_commands)=1,'opening never contacts the printer';

 -- Operator checked the paper: the Z was printed. The cashier summary is saved, no new command.
 r:=optyker_cash_session_resolve(op,true,'MICHAEL TEST');
 assert r->>'state'='completed',r::text;
 assert (select count(*) from optyker_rch_remote_commands)=1,'resolution never sends a printer command';
 assert (select result->>'state' from optyker_rch_remote_commands where id=cmd)='uncertain','original outcome preserved';
 assert (select result#>>'{manualVerification,executed}' from optyker_rch_remote_commands where id=cmd)='true';
 assert (select result#>>'{manualVerification,by}' from optyker_rch_remote_commands where id=cmd)='MICHAEL TEST';
 assert (select snapshot#>>'{closure,fiscal_confirmation}' from optyker_cash_session_operations where id=op)='manual';
 assert (select snapshot#>>'{closure,fiscal_closure}' from optyker_cash_session_operations where id=op)='true';
 assert (select cash_counted from optyker_cash_closures where business_date=d)=110,'summary of the verified closure saved';
 r:=optyker_cash_session_resolve(op,false,'SOMEONE');assert r->>'state'='completed','a confirmed closure cannot be changed by a second verification';
 begin update optyker_cash_session_operations set state='failed' where id=op;raise exception 'IMMUTABLE_BROKEN';exception when others then assert sqlerrm<>'IMMUTABLE_BROKEN';end;

 -- The verified uncertainty no longer blocks the next fiscal closure.
 m:=optyker_cash_session_state(d);op2:=gen_random_uuid();
 r:=optyker_cash_session_change(op2,d,'open','TEST',m#>>'{session,token}','{"opening_cash":70,"opening_checks":0,"notes":"reopen"}');assert r->>'state'='completed';
 m:=optyker_cash_session_state(d);op2:=gen_random_uuid();
 r:=optyker_cash_session_change(op2,d,'close','TEST',m#>>'{session,token}',jsonb_set(p,'{notes}','"second"'));assert r->>'state'='pending','verified closure no longer blocks';
 select command_id into cmd2 from optyker_cash_session_operations where id=op2;
 update optyker_rch_remote_commands set state='completed',completed_at=clock_timestamp(),result='{"ok":false,"state":"uncertain"}' where id=cmd2;
 r:=optyker_cash_session_finish(op2);assert r->>'state'='attention';
 select count(*) into closures from optyker_cash_session_operations where kind='close' and state='completed';

 -- Operator checked the paper: nothing was printed. The attempt fails and can be repeated.
 r:=optyker_cash_session_resolve(op2,false,'MICHAEL TEST');
 assert r->>'state'='failed' and r->>'error' like '%non stampata%',r::text;
 assert (select count(*) from optyker_cash_session_operations where kind='close' and state='completed')=closures,'no summary for an unprinted Z';
 assert (select result#>>'{manualVerification,executed}' from optyker_rch_remote_commands where id=cmd2)='false';
 assert (select count(*) from optyker_rch_remote_commands)=2;
 m:=optyker_cash_session_state(d);assert m#>'{session,pending}' is null or jsonb_typeof(m#>'{session,pending}')='null','nothing left to verify';
 r:=optyker_cash_session_change(gen_random_uuid(),d,'close','TEST',m#>>'{session,token}',jsonb_set(p,'{notes}','"retry"'));assert r->>'state'='pending','retry allowed after an unprinted Z';
 assert (select count(*) from optyker_rch_remote_commands)=3;

 -- An unresolved uncertain closure of another operation still blocks fiscal closures.
 update optyker_rch_remote_commands set state='completed',completed_at=clock_timestamp(),result='{"ok":false,"state":"uncertain"}' where id=(select command_id from optyker_cash_session_operations where state='pending');
 perform optyker_cash_session_finish((select id from optyker_cash_session_operations where state='pending'));
 update optyker_cash_session_operations set state='failed' where state='attention';
 m:=optyker_cash_session_state(d);
 begin perform optyker_cash_session_change(gen_random_uuid(),d,'close','TEST',m#>>'{session,token}',jsonb_set(p,'{notes}','"blocked"'));raise exception 'UNVERIFIED_NOT_BLOCKING';
 exception when others then assert sqlerrm='Un comando RCH è già in corso o da verificare',sqlerrm;end;

 assert not has_function_privilege('anon','public.optyker_cash_session_resolve(uuid,boolean,text)','EXECUTE');
 assert not has_function_privilege('authenticated','public.optyker_cash_session_resolve(uuid,boolean,text)','EXECUTE');
 raise notice 'PASS attention resolution: printed/not printed, opening never blocked, no printer command, guard and privileges';
end;$$;
rollback;
