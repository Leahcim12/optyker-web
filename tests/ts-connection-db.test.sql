-- Rollback-only test, including encrypted secret writes. Never sends TS data.
begin;
do $$
declare c jsonb; r bigint; s uuid; queue_before bigint;
begin
  if has_table_privilege('anon','public.optyker_ts_connection','select')
    or has_table_privilege('authenticated','public.optyker_ts_connection','update')
    or has_function_privilege('anon','public.optyker_ts_connection_status()','execute')
    or has_function_privilege('authenticated','public.optyker_ts_connection_save(bigint,text,text,text,text,text,text)','execute')
    or has_table_privilege('anon','public.optyker_ts_technical_files','select') then
    raise exception 'Public TS access was granted';
  end if;
  select count(*) into queue_before from public.optyker_ts_outbox;
  -- Keep pre-existing live credentials entirely untouched even inside this test.
  update public.optyker_ts_connection set username='',password_secret_id=null,pin_secret_id=null where id;
  select revision into r from public.optyker_ts_connection where id;
  c:=public.optyker_ts_connection_save(r,'FIXTURE1','000-000-000000','AAAAAA00A00A000A','00000000000','fixture-secret','1234567890');
  if c->>'password_saved' <> 'true' or c->>'pin_saved' <> 'true' or c->>'transport_ready' <> 'false'
    or c::text like '%fixture-secret%' or c ? 'password_secret_id' then raise exception 'Invalid safe status'; end if;
  select password_secret_id into s from public.optyker_ts_connection where id;
  if not exists(select 1 from vault.decrypted_secrets where id=s and decrypted_secret='fixture-secret') then raise exception 'Vault encryption round-trip failed'; end if;
  begin
    perform public.optyker_ts_connection_save(r,'FIXTURE1','000-000-000000','AAAAAA00A00A000A','00000000000');
    raise exception 'Revision conflict was not rejected';
  exception when sqlstate 'P0001' then if sqlerrm <> 'TS_REVISION_CONFLICT' then raise; end if; end;
  c:=public.optyker_ts_connection_save((c->>'revision')::bigint,'FIXTURE1','000-000-000000','AAAAAA00A00A000A','00000000000');
  if not exists(select 1 from public.optyker_ts_connection where password_secret_id=s) then raise exception 'Blank credentials replaced secret'; end if;
  begin
    perform public.optyker_ts_connection_save((c->>'revision')::bigint,'FIXTURE2','000-000-000000','AAAAAA00A00A000A','00000000000');
    raise exception 'Account change reused another account secret';
  exception when sqlstate 'P0001' then if sqlerrm <> 'TS_ACCOUNT_REQUIRES_CREDENTIALS' then raise; end if; end;
  if (select count(*) from public.optyker_ts_outbox) <> queue_before then raise exception 'TS queue changed'; end if;
  if (select public from storage.buckets where id='optyker-ts-kit') then raise exception 'Kit bucket is public'; end if;
end $$;
rollback;
