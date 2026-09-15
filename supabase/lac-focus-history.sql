-- Extend the existing password-authenticated staff API. No new public data access.
CREATE OR REPLACE FUNCTION public.optyker_client_details_api(p_username text, p_password text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare a jsonb; actor text; cid uuid; prof optyker_clients_private.profiles; fields jsonb; ver integer; can_import boolean;
begin
 if nullif(btrim(p_username),'') is null or nullif(p_password,'') is null then return jsonb_build_object('ok',false,'error','Accedi a Optyker con il tuo utente.');end if;
 a:=public.optyker_staff_login_internal(p_username,p_password);
 if not coalesce((a->>'ok')::boolean,false) then return jsonb_build_object('ok',false,'error',coalesce(a->>'error','Credenziali non valide'));end if;
 actor:=a->>'username';can_import:=upper(actor) in ('MICHAEL MOLOGNI','OTTICA VISUAL CARE');
 if jsonb_typeof(p_payload) is distinct from 'object' then return jsonb_build_object('ok',false,'error','Dati non validi');end if;
 begin
  if p_action='capabilities' then return jsonb_build_object('ok',true,'data',jsonb_build_object('can_import',can_import,'version','20260913-client-details1'));end if;
  if p_action in ('preview_import','commit_import','last_import') then
   if not can_import then return jsonb_build_object('ok',false,'error','Importazione riservata a Michael e all’amministrazione.');end if;
   if p_action='preview_import' then return jsonb_build_object('ok',true,'data',optyker_clients_private.prepare_import(p_payload,actor));end if;
   if p_action='commit_import' then return jsonb_build_object('ok',true,'data',optyker_clients_private.commit_import(p_payload,actor));end if;
   select jsonb_build_object('batch_id',id,'status',status,'file',filename,'summary',summary) into a from optyker_clients_private.import_batches where operator=actor order by created_at desc limit 1;
   return jsonb_build_object('ok',true,'data',a);
  end if;

  if p_action='get_lac_history' then
   cid:=(p_payload->>'client_id')::uuid;
   if not exists(select 1 from public.optyker_clients where id=cid) then
    return jsonb_build_object('ok',false,'error','Cliente non trovato.');
   end if;
   with supplies as materialized (
    select distinct on (coalesce(nullif(raw->>'codiceFornitura',''),source_row_id)) id,raw,occurred_at
    from optyker_clients_private.legacy_history_records
    where client_id=cid and record_type='lac_supply'
    order by coalesce(nullif(raw->>'codiceFornitura',''),source_row_id),imported_at desc,id
   ), liquids as materialized (
    select distinct on (coalesce(nullif(raw->>'codiceFornituraLacLiquidi',''),source_row_id)) id,raw,occurred_at
    from optyker_clients_private.legacy_history_records
    where client_id=cid and record_type in ('liquid','lac_liquid')
    order by coalesce(nullif(raw->>'codiceFornituraLacLiquidi',''),source_row_id),imported_at desc,id
   )
   select jsonb_build_object('client_id',cid,
    'supplies',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'raw',s.raw,'occurred_at',s.occurred_at,
      'liquids',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'raw',l.raw) order by l.raw->>'id') from liquids l where nullif(l.raw->>'codiceFornitura','')=nullif(s.raw->>'codiceFornitura','')),'[]'::jsonb)
     ) order by s.occurred_at desc nulls last,s.id) from supplies s),'[]'::jsonb),
    'liquid_count',(select count(*) from liquids),
    'unassigned_liquids',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'raw',l.raw)) from liquids l where not exists(select 1 from supplies s where nullif(s.raw->>'codiceFornitura','')=nullif(l.raw->>'codiceFornitura',''))),'[]'::jsonb)
   ) into a;
   return jsonb_build_object('ok',true,'data',a);
  end if;
  if p_action not in ('get','save') then return jsonb_build_object('ok',false,'error','Azione non riconosciuta');end if;
  cid:=(p_payload->>'client_id')::uuid;
  if p_action='save' then perform 1 from public.optyker_clients where id=cid for update;
  else perform 1 from public.optyker_clients where id=cid;end if;
  if not found then return jsonb_build_object('ok',false,'error','Salva prima l’anagrafica principale.');end if;
  select * into prof from optyker_clients_private.profiles where client_id=cid;
  if p_action='save' then
   fields:=p_payload->'fields';ver:=coalesce((p_payload->>'version')::integer,-1);
   if ver<>coalesce(prof.version,0) then return jsonb_build_object('ok',false,'code','VERSION_CONFLICT','error','I dettagli sono stati modificati altrove. Ricaricali prima di salvare; le tue modifiche restano sullo schermo.');end if;
   if jsonb_typeof(fields) is distinct from 'object' or length(fields::text)>40000
    or exists(select 1 from jsonb_each(fields) x where not(x.key=any(optyker_clients_private.field_keys())) or jsonb_typeof(x.value)<>'string' or length(x.value::text)>4000)
   then return jsonb_build_object('ok',false,'error','Uno dei campi aggiuntivi non è valido.');end if;
   insert into optyker_clients_private.profile_audit(client_id,operator,previous_fields,new_fields) values(cid,actor,coalesce(prof.fields,'{}'),coalesce(prof.fields,'{}')||fields);
   insert into optyker_clients_private.profiles(client_id,fields) values(cid,fields)
    on conflict(client_id) do update set fields=optyker_clients_private.profiles.fields||excluded.fields,version=optyker_clients_private.profiles.version+1,updated_at=now()
    returning * into prof;
  end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('client_id',cid,'fields',coalesce(prof.fields,'{}'),'version',coalesce(prof.version,0),
   'original_focus',coalesce(prof.original_focus,'{}'),'warnings',coalesce(prof.warnings,'[]'),'can_import',can_import));
 exception when others then
  return jsonb_build_object('ok',false,'code','OPERATION_FAILED','error',case when sqlstate='P0001' then sqlerrm else 'Operazione non completata. Nessuna modifica applicata; controlla i dati e riprova.' end);
 end;
end $function$

