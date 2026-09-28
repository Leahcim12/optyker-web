-- Applied as Supabase migration 20260928165101.
-- Do not modify fiscal results, payments, closures, or the command queue.
-- A historical uncertain closure ceases to block a NEW business day only when
-- the SAME printer has positively confirmed a closure on a later day.
-- Pending/claimed commands and current-day uncertainty always remain blocking.
-- Verified against live history and 11 read-only regression cases; no fiscal
-- command is executed by this migration or by those checks.
DO $patch$
DECLARE
  definition text;
  old_guard text := $old$if exists(select 1 from public.optyker_rch_remote_commands where serial='72IV6003831' and (state in ('queued','claimed') or (kind='daily_closure' and result->>'state'='uncertain'))) then raise exception 'Un comando RCH è già in corso o da verificare';end if;$old$;
  new_guard text := $new$-- RCH_HISTORICAL_CLOSURE_GUARD_20260928: preserve history; require later positive evidence.
  if exists(
   select 1 from public.optyker_rch_remote_commands c
   where c.serial='72IV6003831' and (
    c.state in ('queued','claimed')
    or (c.kind='daily_closure' and c.result->>'state'='uncertain' and not (
     c.state='completed'
     and c.completed_at is not null
     and (c.requested_at at time zone 'Europe/Rome')::date < p_business_date
     and exists(
      select 1 from public.optyker_rch_remote_commands later
      where later.serial=c.serial
       and later.kind='daily_closure'
       and later.state='completed'
       and later.result->>'ok'='true'
       and later.result->>'dailyClosureExecuted'='true'
       and later.requested_at > c.completed_at
       and later.completed_at > later.requested_at
       and (later.requested_at at time zone 'Europe/Rome')::date > (c.requested_at at time zone 'Europe/Rome')::date
       and (later.requested_at at time zone 'Europe/Rome')::date <= p_business_date
     )
    ))
   )
  ) then raise exception 'Un comando RCH è già in corso o da verificare';end if;$new$;
BEGIN
  SELECT pg_get_functiondef('public.optyker_cash_session_change(uuid,date,text,text,text,jsonb)'::regprocedure) INTO definition;
  IF position('RCH_HISTORICAL_CLOSURE_GUARD_20260928' in definition)>0 THEN
    RETURN;
  END IF;
  IF md5(definition)<>'79c96f72e2a1f59e48a186ec8a01e7fe' OR position(old_guard in definition)=0 THEN
    RAISE EXCEPTION 'Cash closure function changed; re-review before applying patch';
  END IF;
  EXECUTE replace(definition,old_guard,new_guard);
END;
$patch$;
