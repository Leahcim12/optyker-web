-- Require positive confirmation for every printer-result field; missing data fails closed.
do $$declare src text;begin
 src:=pg_get_functiondef('public.optyker_cash_session_finish(uuid)'::regprocedure);
 src:=replace(src,$old$cmd.result->>'mode'<>'REG'$old$,$new$(cmd.result->>'mode') is distinct from 'REG'$new$);
 src:=replace(src,$old$cmd.result->>'dailyClosureExecuted'<>'true'$old$,$new$(cmd.result->>'dailyClosureExecuted') is distinct from 'true'$new$);
 execute src;
 src:=pg_get_functiondef('public.optyker_cash_session_change(uuid,date,text,text,text,jsonb)'::regprocedure);
 src:=replace(src,$old$p_kind not in ('open','close')$old$,$new$(p_kind is null or p_kind not in ('open','close'))$new$);
 src:=replace(src,$old$if not found or live.last_seen_at<clock_timestamp()$old$,$new$if not found or live.last_seen_at is null or live.last_seen_at<clock_timestamp()$new$);
 src:=replace(src,$old$live.connector_version<>'2.2-daily-closure'$old$,$new$live.connector_version is distinct from '2.2-daily-closure'$new$);
 execute src;
end;$$;
create function public.optyker_cash_session_audit_guard() returns trigger language plpgsql set search_path='' as $$begin
 if old.state='completed' then raise exception 'Lo storico delle chiusure confermate non può essere sovrascritto';end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger optyker_cash_session_immutable before update or delete on public.optyker_cash_session_operations for each row execute function public.optyker_cash_session_audit_guard();
revoke all on function public.optyker_cash_session_audit_guard() from public,anon,authenticated;
