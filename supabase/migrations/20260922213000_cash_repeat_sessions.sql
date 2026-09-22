-- Repeatable cash sessions. Daily summaries stay cumulative; every confirmation is audited.
-- Deploying this migration does not change payments, receipts, openings or closures.
create table public.optyker_cash_session_operations (
 id uuid primary key, register_code text not null default 'main', business_date date not null,
 kind text not null check(kind in ('open','close','legacy_close')),
 state text not null check(state in ('pending','completed','failed','attention')),
 sequence_no integer,operator_username text not null,input jsonb not null default '{}',snapshot jsonb not null default '{}',
 command_id uuid references public.optyker_rch_remote_commands(id),legacy_key text unique,error text not null default '',
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz
);
create unique index optyker_cash_session_pending on public.optyker_cash_session_operations(register_code) where state in ('pending','attention');
create unique index optyker_cash_session_sequence on public.optyker_cash_session_operations(register_code,business_date,sequence_no) where kind in ('close','legacy_close') and state in ('pending','completed','attention');
create index optyker_cash_session_day on public.optyker_cash_session_operations(business_date,created_at desc);
alter table public.optyker_cash_session_operations enable row level security;
revoke all on public.optyker_cash_session_operations from public,anon,authenticated;
grant select,insert,update on public.optyker_cash_session_operations to service_role;

create function public.optyker_cash_session_state(p_business_date date) returns jsonb
language plpgsql stable set search_path='' as $$
declare m jsonb; daily jsonb; delta jsonb; baseline jsonb; c jsonb; o jsonb; fund jsonb; k text; n integer; pending jsonb; is_closed boolean;
begin
 m:=public.optyker_cash_day_metrics(p_business_date);
 daily:=m-'opening'-'closure';c:=nullif(m->'closure','null'::jsonb);o:=nullif(m->'opening','null'::jsonb);
 baseline:=coalesce(c#>'{snapshot,cumulative}',c->'snapshot','{}'::jsonb);delta:=daily;
 foreach k in array array['total_collected','cash_total','card_total','bank_total','other_total','invoice_payments_total','payments_count','turnover_total','sales_count','receipts_total','receipts_count','receipt_cash_total','receipt_card_total','receipt_bank_total','receipt_other_total'] loop
  delta:=jsonb_set(delta,array[k],to_jsonb(coalesce((daily->>k)::numeric,0)-coalesce((baseline->>k)::numeric,0)));
 end loop;
 is_closed:=c is not null and (o is null or (o->>'updated_at')::timestamptz<=(c->>'closed_at')::timestamptz);
 fund:=case when c is not null and is_closed then jsonb_build_object('opening_cash',coalesce((c->>'next_opening_cash')::numeric,0),'opening_checks',coalesce((c->>'next_opening_checks')::numeric,0)) else coalesce(o,jsonb_build_object('opening_cash',m->'suggested_opening_cash','opening_checks',m->'suggested_opening_checks')) end;
 select count(*)::int into n from public.optyker_cash_session_operations where register_code='main' and business_date=p_business_date and kind in ('close','legacy_close') and state='completed';
 if c is not null and n=0 then n:=1;end if;
 select jsonb_build_object('id',id,'business_date',business_date,'state',state,'error',error,'fiscal',input->'fiscal') into pending from public.optyker_cash_session_operations where register_code='main' and state in ('pending','attention') limit 1;
 return m||jsonb_build_object('closed',is_closed,'session_version','20260922-sessions1','session',jsonb_build_object('number',n+1,'closures_count',n,'totals',delta,'daily_totals',daily,'opening',fund,'cash_expected',coalesce((fund->>'opening_cash')::numeric,0)+coalesce((delta->>'cash_total')::numeric,0),'token',md5(jsonb_build_array(p_business_date,o,c->'id',c->'closed_at',daily)::text),'pending',pending));
end;$$;

create function public.optyker_cash_session_finish(p_request_id uuid) returns jsonb
language plpgsql set search_path='' as $$
declare op public.optyker_cash_session_operations;cmd public.optyker_rch_remote_commands;old public.optyker_cash_closures;result public.optyker_cash_closures;
 v jsonb;totals jsonb;session_totals jsonb;inp jsonb;report jsonb;t timestamptz;new_command uuid;expected numeric;oc numeric;oq numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended('optyker-cash-sessions-main',0));
 select * into op from public.optyker_cash_session_operations where id=p_request_id for update;
 if not found then raise exception 'Operazione cassa non trovata';end if;
 if op.state<>'pending' then return jsonb_build_object('operation_id',op.id,'state',op.state,'error',op.error,'data',public.optyker_cash_session_state(op.business_date));end if;
 if op.kind<>'close' then raise exception 'Operazione non valida';end if;
 if op.command_id is not null then
  select * into cmd from public.optyker_rch_remote_commands where id=op.command_id;
  if cmd.state in ('failed','expired') then
   update public.optyker_cash_session_operations set state='failed',error=coalesce(nullif(cmd.error,''),'Comando RCH non eseguito') where id=op.id;
   return jsonb_build_object('operation_id',op.id,'state','failed','error',coalesce(nullif(cmd.error,''),'Comando RCH non eseguito'));
  end if;
  if cmd.state<>'completed' then return jsonb_build_object('operation_id',op.id,'state','pending');end if;
  if cmd.result->>'state'='uncertain' or coalesce((cmd.result->>'ok')::boolean,false) is not true then
   update public.optyker_cash_session_operations set state='attention',error='Esito RCH non confermato: nessuna ripetizione automatica. Verifica il registratore.' where id=op.id;
   return jsonb_build_object('operation_id',op.id,'state','attention','error','Esito RCH non confermato: non ripetere il comando.');
  end if;
  if cmd.kind='restore_reg' then
   if cmd.result->>'mode'<>'REG' then raise exception 'Ritorno REG non confermato';end if;
   if op.business_date<>(now() at time zone 'Europe/Rome')::date then
    update public.optyker_cash_session_operations set state='failed',error='Giornata cambiata: chiusura fiscale non inviata.' where id=op.id;
    return jsonb_build_object('operation_id',op.id,'state','failed','error','Giornata cambiata: chiusura fiscale non inviata.');
   end if;
   insert into public.optyker_rch_remote_commands(kind,serial,state,requested_by,expires_at,payload) values('daily_closure','72IV6003831','queued',op.operator_username,clock_timestamp()+interval '120 seconds',jsonb_build_object('business_date',op.business_date,'cash_session_request',op.id,'source','cash_repeat_sessions')) returning id into new_command;
   update public.optyker_cash_session_operations set command_id=new_command,snapshot=snapshot||jsonb_build_object('restore_command_id',cmd.id) where id=op.id;
   return jsonb_build_object('operation_id',op.id,'state','pending');
  end if;
  if cmd.kind<>'daily_closure' or cmd.result->>'dailyClosureExecuted'<>'true' then raise exception 'Chiusura fiscale non confermata';end if;
 end if;
 select * into old from public.optyker_cash_closures where register_code='main' and business_date=op.business_date for update;
 if coalesce(old.closed_at::text,'')<>coalesce(op.snapshot->>'previous_closed_at','') then
  update public.optyker_cash_session_operations set state='attention',error='Una chiusura precedente è cambiata: riepilogo da verificare, nessun reinvio.' where id=op.id;
  return jsonb_build_object('operation_id',op.id,'state','attention','error','Riepilogo modificato da un altro accesso. Nessun reinvio.');
 end if;
 v:=op.snapshot->'preview';totals:=v#>'{session,daily_totals}';session_totals:=v#>'{session,totals}';inp:=op.input;t:=clock_timestamp();
 oc:=coalesce((v#>>'{session,opening,opening_cash}')::numeric,0);oq:=coalesce((v#>>'{session,opening,opening_checks}')::numeric,0);expected:=(v#>>'{session,cash_expected}')::numeric;
 report:=session_totals||jsonb_build_object('sequence_no',op.sequence_no,'closed_at',t,'operator_username',op.operator_username,'opening_cash',oc,'opening_checks',oq,'cash_expected',expected,'cash_counted',inp->'cash_counted','checks_counted',inp->'checks_counted','cash_difference',(inp->>'cash_counted')::numeric-expected,'next_opening_cash',(inp->>'cash_counted')::numeric-(inp->>'bank_deposit_cash')::numeric-(inp->>'safe_deposit_cash')::numeric,'next_opening_checks',(inp->>'checks_counted')::numeric-(inp->>'bank_deposit_checks')::numeric-(inp->>'safe_deposit_checks')::numeric,'fiscal_closure',coalesce((inp->>'fiscal')::boolean,false),'command_id',op.command_id);
 if old.id is not null then
  insert into public.optyker_cash_session_operations(id,business_date,kind,state,sequence_no,operator_username,legacy_key,snapshot,created_at,completed_at)
  select gen_random_uuid(),op.business_date,'legacy_close','completed',1,old.operator_username,'legacy:'||old.id,jsonb_build_object('closure',to_jsonb(old),'preserved_original',true),old.closed_at,old.closed_at
  where not exists(select 1 from public.optyker_cash_session_operations where business_date=op.business_date and kind in ('close','legacy_close') and state='completed');
 end if;
 insert into public.optyker_cash_closures(register_code,business_date,operator_username,opening_cash,opening_checks,cash_expected,cash_counted,checks_counted,cash_difference,card_total,bank_total,other_total,total_collected,payments_count,sales_count,pending_total,pending_count,turnover_total,receipts_total,receipts_count,invoice_payments_total,bank_deposit_cash,bank_deposit_checks,safe_deposit_cash,safe_deposit_checks,next_opening_cash,next_opening_checks,notes,snapshot,closed_at)
 values('main',op.business_date,op.operator_username,coalesce(old.opening_cash,oc),coalesce(old.opening_checks,oq),expected,(inp->>'cash_counted')::numeric,(inp->>'checks_counted')::numeric,coalesce(old.cash_difference,0)+(inp->>'cash_counted')::numeric-expected,
 (totals->>'card_total')::numeric,(totals->>'bank_total')::numeric,(totals->>'other_total')::numeric,(totals->>'total_collected')::numeric,(totals->>'payments_count')::int,(totals->>'sales_count')::int,(totals->>'pending_total')::numeric,(totals->>'pending_count')::int,(totals->>'turnover_total')::numeric,(totals->>'receipts_total')::numeric,(totals->>'receipts_count')::int,(totals->>'invoice_payments_total')::numeric,
 coalesce(old.bank_deposit_cash,0)+(inp->>'bank_deposit_cash')::numeric,coalesce(old.bank_deposit_checks,0)+(inp->>'bank_deposit_checks')::numeric,coalesce(old.safe_deposit_cash,0)+(inp->>'safe_deposit_cash')::numeric,coalesce(old.safe_deposit_checks,0)+(inp->>'safe_deposit_checks')::numeric,(report->>'next_opening_cash')::numeric,(report->>'next_opening_checks')::numeric,inp->>'notes',jsonb_build_object('cumulative',totals,'session',report,'request_id',op.id,'cutoff',op.created_at),t)
 on conflict(register_code,business_date) do update set operator_username=excluded.operator_username,cash_expected=excluded.cash_expected,cash_counted=excluded.cash_counted,checks_counted=excluded.checks_counted,cash_difference=excluded.cash_difference,card_total=excluded.card_total,bank_total=excluded.bank_total,other_total=excluded.other_total,total_collected=excluded.total_collected,payments_count=excluded.payments_count,sales_count=excluded.sales_count,pending_total=excluded.pending_total,pending_count=excluded.pending_count,turnover_total=excluded.turnover_total,receipts_total=excluded.receipts_total,receipts_count=excluded.receipts_count,invoice_payments_total=excluded.invoice_payments_total,bank_deposit_cash=excluded.bank_deposit_cash,bank_deposit_checks=excluded.bank_deposit_checks,safe_deposit_cash=excluded.safe_deposit_cash,safe_deposit_checks=excluded.safe_deposit_checks,next_opening_cash=excluded.next_opening_cash,next_opening_checks=excluded.next_opening_checks,notes=excluded.notes,snapshot=excluded.snapshot,closed_at=excluded.closed_at returning * into result;
 update public.optyker_cash_session_operations set state='completed',completed_at=t,snapshot=snapshot||jsonb_build_object('closure',report,'daily_summary',to_jsonb(result)) where id=op.id;
 return jsonb_build_object('operation_id',op.id,'state','completed','data',public.optyker_cash_session_state(op.business_date));
end;$$;

create function public.optyker_cash_session_change(p_request_id uuid,p_business_date date,p_kind text,p_operator text,p_expected_token text,p_input jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare previous public.optyker_cash_session_operations;m jsonb;cmd_id uuid;live public.optyker_rch_connectors;k text;f boolean;remote_kind text;seq integer;
begin
 if p_request_id is null or p_business_date is null or p_business_date>(now() at time zone 'Europe/Rome')::date or p_kind not in ('open','close') or nullif(trim(p_operator),'') is null then raise exception 'Richiesta cassa non valida';end if;
 perform pg_advisory_xact_lock(hashtextextended('optyker-cash-sessions-main',0));
 select * into previous from public.optyker_cash_session_operations where id=p_request_id;
 if found then
  if previous.input is distinct from p_input or previous.business_date<>p_business_date or previous.kind<>p_kind or previous.operator_username<>p_operator then raise exception 'Identificativo già usato per dati diversi';end if;
  return public.optyker_cash_session_finish(previous.id);
 end if;
 if exists(select 1 from public.optyker_cash_session_operations where register_code='main' and state in ('pending','attention')) then raise exception 'Una chiusura è in corso o da verificare. Usa Verifica esito, senza ripetere.';end if;
 m:=public.optyker_cash_session_state(p_business_date);
 if p_expected_token is distinct from m#>>'{session,token}' then raise exception 'Stato o importi cambiati: aggiorna il riepilogo prima di confermare.';end if;
 if p_kind='open' then
  if (m->>'opened')::boolean and not (m->>'closed')::boolean then raise exception 'La cassa è già aperta';end if;
  foreach k in array array['opening_cash','opening_checks'] loop
   if p_input->k is null or jsonb_typeof(p_input->k)<>'number' or (p_input->>k)::numeric<0 or (p_input->>k)::numeric>100000000 then raise exception 'Fondo cassa non valido';end if;
  end loop;
  insert into public.optyker_cash_session_operations(id,business_date,kind,state,operator_username,input,snapshot,completed_at) values(p_request_id,p_business_date,'open','completed',p_operator,p_input,jsonb_build_object('previous_opening',m->'opening','previous_closure',m->'closure'),clock_timestamp());
  insert into public.optyker_cash_openings(register_code,business_date,operator_username,opening_cash,opening_checks,notes,opened_at,updated_at)
  values('main',p_business_date,p_operator,round((p_input->>'opening_cash')::numeric,2),round((p_input->>'opening_checks')::numeric,2),left(coalesce(p_input->>'notes',''),2000),clock_timestamp(),clock_timestamp())
  on conflict(register_code,business_date) do update set operator_username=excluded.operator_username,opening_cash=excluded.opening_cash,opening_checks=excluded.opening_checks,notes=excluded.notes,opened_at=excluded.opened_at,updated_at=excluded.updated_at;
  return jsonb_build_object('operation_id',p_request_id,'state','completed','data',public.optyker_cash_session_state(p_business_date));
 end if;
 if not (m->>'opened')::boolean then raise exception 'Prima registra il fondo di apertura';end if;
 foreach k in array array['cash_counted','checks_counted','bank_deposit_cash','bank_deposit_checks','safe_deposit_cash','safe_deposit_checks'] loop
  if p_input->k is null or jsonb_typeof(p_input->k)<>'number' or (p_input->>k)::numeric<0 or (p_input->>k)::numeric>100000000 then raise exception 'Importo chiusura non valido';end if;
 end loop;
 if (p_input->>'bank_deposit_cash')::numeric+(p_input->>'safe_deposit_cash')::numeric>(p_input->>'cash_counted')::numeric or (p_input->>'bank_deposit_checks')::numeric+(p_input->>'safe_deposit_checks')::numeric>(p_input->>'checks_counted')::numeric then raise exception 'I prelievi superano il denaro contato';end if;
 f:=coalesce((p_input->>'fiscal')::boolean,false);
 if f then
  if p_business_date<>(now() at time zone 'Europe/Rome')::date then raise exception 'La chiusura fiscale è consentita soltanto per oggi';end if;
  if exists(select 1 from public.optyker_rch_remote_commands where serial='72IV6003831' and (state in ('queued','claimed') or (kind='daily_closure' and result->>'state'='uncertain'))) then raise exception 'Un comando RCH è già in corso o da verificare';end if;
  select * into live from public.optyker_rch_connectors where active=true and serial='72IV6003831' order by last_seen_at desc limit 1;
  if not found or live.last_seen_at<clock_timestamp()-interval '25 seconds' then raise exception 'PC cassa offline. La chiusura gestionale resta disponibile senza selezionare la chiusura fiscale.';end if;
  if live.connector_version<>'2.2-daily-closure' then raise exception 'Versione connettore RCH non compatibile';end if;
  if (live.last_status->>'ok') is distinct from 'true' or (live.last_status->>'idleState') is distinct from '0' or coalesce(live.last_status->>'mode','') not in ('REG','Z') then raise exception 'RCH non pronta: non invio chiusure';end if;
  foreach k in array array['busy','errorCode','printerError','paperEnd','coverOpen'] loop
   if (live.last_status->>k) is distinct from '0' then raise exception 'RCH occupata o in errore';end if;
  end loop;
  remote_kind:=case when live.last_status->>'mode'='Z' then 'restore_reg' else 'daily_closure' end;
  insert into public.optyker_rch_remote_commands(kind,serial,state,requested_by,expires_at,payload) values(remote_kind,'72IV6003831','queued',p_operator,clock_timestamp()+interval '120 seconds',jsonb_build_object('business_date',p_business_date,'cash_session_request',p_request_id,'source','cash_repeat_sessions')) returning id into cmd_id;
 end if;
 seq:=(m#>>'{session,number}')::int;
 insert into public.optyker_cash_session_operations(id,business_date,kind,state,sequence_no,operator_username,input,snapshot,command_id) values(p_request_id,p_business_date,'close','pending',seq,p_operator,p_input,jsonb_build_object('preview',m-'closure','previous_closed_at',coalesce((m#>>'{closure,closed_at}')::timestamptz::text,'')),cmd_id);
 return public.optyker_cash_session_finish(p_request_id);
end;$$;
revoke all on function public.optyker_cash_session_state(date),public.optyker_cash_session_finish(uuid),public.optyker_cash_session_change(uuid,date,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_cash_session_state(date),public.optyker_cash_session_finish(uuid),public.optyker_cash_session_change(uuid,date,text,text,text,jsonb) to service_role;

create function public.optyker_cash_session_month(p_year int,p_month int) returns jsonb language sql stable set search_path='' as $$
 with days as(select d::date business_date from generate_series(make_date(p_year,p_month,1)::timestamp,least((make_date(p_year,p_month,1)+interval '1 month - 1 day')::date,(now() at time zone 'Europe/Rome')::date)::timestamp,interval '1 day')d),metrics as(select business_date,public.optyker_cash_session_state(business_date) m from days)
 select jsonb_build_object('year',p_year,'month',p_month,'turnover_total',coalesce(sum((m->>'turnover_total')::numeric),0),'paid_total',coalesce(sum((m->>'total_collected')::numeric),0),'receipts_total',coalesce(sum((m->>'receipts_total')::numeric),0),'receipts_count',coalesce(sum((m->>'receipts_count')::int),0),'pending_total',coalesce(sum((m->>'pending_total')::numeric),0),'days',coalesce(jsonb_agg(jsonb_build_object('date',business_date,'metrics',m) order by business_date desc),'[]'::jsonb)) from metrics;
$$;
revoke all on function public.optyker_cash_session_month(int,int) from public,anon,authenticated;
grant execute on function public.optyker_cash_session_month(int,int) to service_role;
