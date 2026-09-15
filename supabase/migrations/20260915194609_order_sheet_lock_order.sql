-- All entry points must take the client cancellation lock before sheet row locks.
do $$
declare source text;anchor text:=' sid:=nullif(p_payload->>''sheet_id'','''')::uuid;';
begin
 source:=pg_get_functiondef('public.optyker_client_sheet_actions(text,text,text,jsonb)'::regprocedure);
 if position('hashtextextended(cid::text,7915)' in source)>0 then return;end if;
 if position(anchor in source)=0 then raise exception 'Sheet action lock anchor missing';end if;
 execute replace(source,anchor,' if p_action=''delete'' then perform pg_advisory_xact_lock(hashtextextended(cid::text,7915));end if;'||chr(10)||anchor);
end;$$;
