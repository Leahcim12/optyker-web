-- Cassa 20261123: niente stampa RCH finché manca la chiusura del giorno precedente
-- (o del periodo di chiusura / ferie). Solo lettura: non invia comandi alla RCH.
--
-- Regola, giorno D (Europe/Rome):
--   * chiusura RCH (Z) confermata in D            -> stampa consentita;
--   * ultima Z confermata in D-1, nessun documento
--     stampato dopo quella Z prima di oggi        -> stampa consentita;
--   * altrimenti                                  -> stampa bloccata finché non si fa la chiusura.
-- Le Z valide sono quelle che Optyker ha visto eseguire (comando daily_closure confermato
-- dal giornale) o che l'operatore ha verificato sulla striscia (manual_verification).

create table if not exists public.optyker_cash_print_gate_settings(
 register_code text primary key default 'main',
 enabled boolean not null default true,
 -- Sblocco di emergenza fino a questo istante (es. connettore RCH guasto). Solo da database.
 override_until timestamptz,
 override_note text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.optyker_cash_print_gate_settings enable row level security;
revoke all on public.optyker_cash_print_gate_settings from public, anon, authenticated;
grant select, insert, update on public.optyker_cash_print_gate_settings to service_role;
insert into public.optyker_cash_print_gate_settings(register_code) values ('main') on conflict (register_code) do nothing;

create or replace function public.optyker_cash_print_gate_day(p_day date)
returns text
language sql
immutable
set search_path to ''
as $function$
 select case when p_day is null then '' else
  (array['lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica'])[extract(isodow from p_day)::int]
  ||' '||to_char(p_day,'DD/MM') end
$function$;

create or replace function public.optyker_cash_print_gate(p_register_code text default 'main', p_now timestamptz default now())
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
 v_today date:=(p_now at time zone 'Europe/Rome')::date;
 v_day_start timestamptz:=(v_today::timestamp at time zone 'Europe/Rome');
 v_enabled boolean;
 v_override timestamptz;
 v_last_at timestamptz;
 v_last_number integer;
 v_last_date date;
 v_docs integer:=0;
 v_docs_from date;
 v_uncertain integer:=0;
 v_pending jsonb;
 v_opened boolean:=false;
 v_allowed boolean;
 v_reason text;
 v_message text:='';
 v_last_text text:='';
begin
 select s.enabled,s.override_until into v_enabled,v_override
   from public.optyker_cash_print_gate_settings s where s.register_code=p_register_code;
 v_enabled:=coalesce(v_enabled,true);

 -- Ultima chiusura RCH (Z) nota a Optyker.
 select z.at,z.num into v_last_at,v_last_number from (
   select coalesce(c.completed_at,c.claimed_at,c.requested_at) as at,
          case when c.result->>'closureNumber' ~ '^[0-9]{1,9}$' then (c.result->>'closureNumber')::int end as num
     from public.optyker_rch_remote_commands c
    where c.kind='daily_closure' and c.state='completed'
      and (c.result->>'dailyClosureExecuted'='true' or c.result#>>'{manualVerification,executed}'='true')
   union all
   select coalesce(c.completed_at,c.claimed_at,c.requested_at,o.created_at),
          case when c.result->>'closureNumber' ~ '^[0-9]{1,9}$' then (c.result->>'closureNumber')::int end
     from public.optyker_cash_session_operations o
     left join public.optyker_rch_remote_commands c on c.id=o.command_id
    where o.register_code=p_register_code and o.kind='close'
      and ((o.state='completed' and o.snapshot#>>'{closure,fiscal_closure}'='true')
           or o.snapshot#>>'{manual_verification,executed}'='true')
 ) z
 where z.at is not null and z.at<=p_now
 order by z.at desc
 limit 1;
 v_last_date:=(v_last_at at time zone 'Europe/Rome')::date;

 -- Documenti fiscali (scontrini e annulli) stampati o forse stampati dopo l'ultima Z, nei giorni precedenti.
 -- Ora del documento: ultima preparazione (claim valido 10 minuti), mai prima della creazione.
 select count(*)::int,min((x.at at time zone 'Europe/Rome')::date) into v_docs,v_docs_from
   from (
    select greatest(j.created_at,coalesce(j.claim_expires_at-interval '10 minutes',j.created_at)) as at
      from public.optyker_fiscal_jobs j
     where j.operation in ('sale','void')
       and j.state not in ('prepared','not_started')
       and not (j.state='cancelled' and coalesce(j.result->>'reason','')='manual_verified_not_printed')
   ) x
  where x.at>coalesce(v_last_at,'-infinity'::timestamptz) and x.at<v_day_start and x.at<=p_now;

 -- Solo suggerimenti per l'operatore: non cambiano la regola.
 select count(*)::int into v_uncertain from public.optyker_fiscal_jobs j where j.state in ('sending','uncertain');
 select jsonb_build_object('id',o.id,'business_date',o.business_date,'state',o.state,'created_at',o.created_at)
   into v_pending
   from public.optyker_cash_session_operations o
  where o.register_code=p_register_code and o.kind='close' and o.state in ('pending','attention')
  order by o.created_at desc limit 1;
 v_opened:=exists(select 1 from public.optyker_cash_openings op where op.register_code=p_register_code and op.business_date=v_today);

 if not v_enabled then v_allowed:=true;v_reason:='disabled';
 elsif v_override is not null and v_override>p_now then v_allowed:=true;v_reason:='override';
 elsif v_last_at is null then v_allowed:=false;v_reason:='no_closure';
 elsif v_last_date>=v_today then v_allowed:=true;v_reason:='closed_today';
 elsif v_last_date=v_today-1 and v_docs=0 then v_allowed:=true;v_reason:='closed_yesterday';
 elsif v_last_date=v_today-1 then v_allowed:=false;v_reason:='documents_after_closure';
 else v_allowed:=false;v_reason:='missing_closure';
 end if;

 if v_last_at is not null then
  v_last_text:=public.optyker_cash_print_gate_day(v_last_date)||' alle '||to_char(v_last_at at time zone 'Europe/Rome','HH24:MI');
 end if;
 if not v_allowed then
  v_message:='Stampa bloccata: '||case v_reason
   when 'no_closure' then 'in Optyker non risulta nessuna chiusura RCH.'
   when 'documents_after_closure' then 'ci sono scontrini di '||public.optyker_cash_print_gate_day(v_docs_from)||' stampati dopo l''ultima chiusura RCH ('||v_last_text||').'
   else 'manca la chiusura RCH del giorno precedente'||case when v_last_date<v_today-2 then ' (periodo dal '||to_char(v_last_date+1,'DD/MM')||' al '||to_char(v_today-1,'DD/MM')||')' else ' ('||public.optyker_cash_print_gate_day(v_today-1)||')' end||'. Ultima chiusura: '||v_last_text||'.'
  end||' Fai prima «Chiusura cassa e RCH» con la chiusura della RCH: poi la stampa si sblocca.';
 end if;

 return jsonb_build_object(
  'allowed',v_allowed,
  'reason',v_reason,
  'message',v_message,
  'today',v_today,
  'last_closure_at',v_last_at,
  'last_closure_date',v_last_date,
  'last_closure_number',v_last_number,
  'last_closure_text',v_last_text,
  'documents_after_closure',v_docs,
  'documents_from',v_docs_from,
  'uncertain_jobs',v_uncertain,
  'pending_closure',v_pending,
  'today_opened',v_opened,
  'override_until',case when v_override>p_now then v_override end,
  'checked_at',p_now,
  'version','20261123-gate1'
 );
end;
$function$;

revoke all on function public.optyker_cash_print_gate_day(date) from public, anon, authenticated;
revoke all on function public.optyker_cash_print_gate(text,timestamptz) from public, anon, authenticated;
grant execute on function public.optyker_cash_print_gate_day(date) to service_role;
grant execute on function public.optyker_cash_print_gate(text,timestamptz) to service_role;
