-- Edit existing LAC documents in-place from the customer record.
-- The RPC is staff-authenticated and keeps document identity/reference immutable.
create or replace function public.optyker_client_sheet_update(
  p_username text,
  p_password text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  cid uuid;
  sid uuid;
  s public.optyker_sheets%rowtype;
  updated public.optyker_sheets%rowtype;
  w public.optyker_work_orders%rowtype;
  snap jsonb;
  lac_state jsonb;
  elems jsonb;
  expected timestamptz;
  summ text;
begin
  if public.optyker_staff_allowed(p_username,p_password) is not true then
    return jsonb_build_object('ok',false,'error','Operatore non autorizzato');
  end if;

  cid:=nullif(p_payload->>'client_id','')::uuid;
  sid:=nullif(p_payload->>'sheet_id','')::uuid;
  if cid is null or sid is null then raise exception 'Cliente o scheda non validi'; end if;

  select * into s
  from public.optyker_sheets
  where id=sid and client_id=cid
  for update;
  if not found then raise exception 'Scheda non disponibile per il cliente selezionato'; end if;

  if not (s.sheet_type='lac' or s.sheet_type like 'lac\_%' escape '\') then
    raise exception 'Modifica disponibile solo per schede e preventivi LAC';
  end if;

  if exists(select 1 from public.optyker_quote_order_links where quote_id=s.id) then
    raise exception 'Preventivo già trasformato in ordine: modifica la Busta collegata';
  end if;

  expected:=nullif(p_payload->>'expected_updated_at','')::timestamptz;
  if expected is null or expected is distinct from s.updated_at then
    raise exception 'La scheda è stata modificata: riaprila dall’anagrafica prima di salvare';
  end if;

  snap:=p_payload->'data';
  if snap is null or jsonb_typeof(snap)<>'object' then raise exception 'Dati della scheda non validi'; end if;
  if octet_length(snap::text)>700000 then raise exception 'Scheda troppo grande'; end if;

  select * into w
  from public.optyker_work_orders
  where source_sheet_id=s.id
  order by created_at desc
  limit 1
  for update;
  if found and w.status in ('completato','annullato') then
    raise exception 'Ordine già chiuso: la scheda non può essere modificata';
  end if;

  lac_state:=case when jsonb_typeof(snap->'lacState')='object' then snap->'lacState' else '{}'::jsonb end;
  elems:=case when jsonb_typeof(snap->'elements')='object' then snap->'elements' else '{}'::jsonb end;

  snap:=snap || jsonb_build_object(
    'client_id',cid,
    'sheetType',s.sheet_type,
    'documentType',coalesce(s.document_type,s.data->>'documentType'),
    'savedAt',now()
  );
  if s.reference_code is not null then
    snap:=snap || jsonb_build_object('reference_code',s.reference_code,'referenceCode',s.reference_code);
  end if;
  if s.reference_no is not null then
    snap:=snap || jsonb_build_object('documentReference',s.reference_no);
    elems:=elems || jsonb_build_object('lacReference',jsonb_build_object('kind','value','value',s.reference_no));
  elsif s.reference_code is not null then
    snap:=snap || jsonb_build_object('documentReference',s.reference_code);
    elems:=elems || jsonb_build_object('lacReference',jsonb_build_object('kind','value','value',s.reference_code));
  end if;
  if coalesce(s.document_type,s.data->>'documentType') is not null then
    lac_state:=lac_state || jsonb_build_object('document',coalesce(s.document_type,s.data->>'documentType'));
  end if;
  snap:=jsonb_set(snap,'{lacState}',lac_state,true);
  snap:=jsonb_set(snap,'{elements}',elems,true);

  update public.optyker_sheets
  set data=snap,
      operator=p_username,
      updated_at=now()
  where id=s.id
  returning * into updated;

  if w.id is not null then
    summ:=concat('LAC · ',snap#>>'{lacState,brand}',' · OD: ',snap#>>'{lacState,odProductName}',' · OS: ',snap#>>'{lacState,osProductName}');
    update public.optyker_work_orders
    set payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object(
          'snapshot',updated.data,
          'summary_text',summ,
          'source_updated_at',updated.updated_at,
          'edited_at',now(),
          'edited_by',p_username
        ),
        updated_at=now()
    where id=w.id;
  end if;

  return jsonb_build_object('ok',true,'data',to_jsonb(updated),'work_order_synced',w.id is not null);
exception
  when invalid_text_representation or invalid_datetime_format then
    return jsonb_build_object('ok',false,'error','Dati della richiesta non validi');
  when others then
    return jsonb_build_object('ok',false,'error',sqlerrm);
end
$$;

revoke all on function public.optyker_client_sheet_update(text,text,jsonb) from public;
grant execute on function public.optyker_client_sheet_update(text,text,jsonb) to anon,authenticated,service_role;
