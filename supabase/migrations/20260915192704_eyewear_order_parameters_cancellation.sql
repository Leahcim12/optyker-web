-- Cancel/soft-archive order documents together. Retain references, warranties,
-- delivery records and all sale/payment/fiscal snapshots unchanged.
alter table public.optyker_sheets add column if not exists archived_at timestamptz;

create or replace function public.optyker_cancel_order_sheet(
 p_client_id uuid,p_sheet_id uuid,p_expected_updated_at timestamptz,p_operator text,p_confirm boolean default false
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare s public.optyker_sheets%rowtype;ids uuid[];orders jsonb;stamp timestamptz:=clock_timestamp();cart jsonb;
begin
 if p_confirm is not true then raise exception 'Conferma esplicita richiesta';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,7915));
 select * into s from public.optyker_sheets where id=p_sheet_id and client_id=p_client_id for update;
 if not found then raise exception 'Scheda non disponibile per questo cliente';end if;
 if s.archived_at is not null then return jsonb_build_object('ok',true,'sheet_id',s.id,'already_deleted',true,'recoverable_copy',true);end if;
 if s.sheet_type not like 'eyewear\_%' escape '\' and s.sheet_type<>'lac' and s.sheet_type not like 'lac\_%' escape '\' then raise exception 'Usa l’eliminazione della scheda clinica';end if;
 if p_expected_updated_at is distinct from s.updated_at then raise exception 'La scheda è stata modificata: ricarica prima di annullarla';end if;
 -- The quote and its generated Busta are one order, not unrelated client sheets.
 select array_agg(distinct id) into ids from (
   select s.id as id union all select quote_id from public.optyker_quote_order_links where client_id=p_client_id and (quote_id=s.id or order_sheet_id=s.id)
   union all select order_sheet_id from public.optyker_quote_order_links where client_id=p_client_id and (quote_id=s.id or order_sheet_id=s.id)
 ) related;
 perform 1 from public.optyker_sheets where id=any(ids) order by id for update;
 perform 1 from public.optyker_work_orders where client_id=p_client_id and source_sheet_id=any(ids) order by id for update;
 select coalesce(jsonb_agg(to_jsonb(w)),'[]') into orders from public.optyker_work_orders w where w.client_id=p_client_id and w.source_sheet_id=any(ids);
 insert into public.optyker_sheet_trash(sheet_id,client_id,snapshot,deleted_by,deleted_at)
 select x.id,x.client_id,to_jsonb(x)||jsonb_build_object('cancelled_order_snapshots',orders),p_operator,stamp from public.optyker_sheets x where x.id=any(ids) and x.client_id=p_client_id
 on conflict(sheet_id) do nothing;
 update public.optyker_work_orders set status='annullato',status_since=stamp,updated_at=stamp,
   manual_status=true,manual_status_by=p_operator,manual_status_at=stamp,
   payload=coalesce(payload,'{}')||jsonb_build_object('sheet_cancelled_at',stamp,'sheet_cancelled_by',p_operator,'cancelled_from_sheet_id',s.id)
 where client_id=p_client_id and source_sheet_id=any(ids);
 update public.optyker_sheets set archived_at=stamp,updated_at=stamp where client_id=p_client_id and id=any(ids) and archived_at is null;
 update public.optyker_client_carts c set items=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(c.items) x
   where not (coalesce(x->>'source_sheet_id','')=any(ids::text[]) or exists(select 1 from public.optyker_work_orders w where w.client_id=p_client_id and w.source_sheet_id=any(ids) and (x->>'variant_id'='client_cart:'||w.id::text or x->>'source_work_order_id'=w.id::text)))),
   updated_by=p_operator,updated_at=stamp where c.client_id=p_client_id;
 select jsonb_build_object('client_id',client_id,'items',items,'updated_at',updated_at) into cart from public.optyker_client_carts where client_id=p_client_id;
 return jsonb_build_object('ok',true,'sheet_id',s.id,'archived_sheet_ids',to_jsonb(ids),'cancelled_orders',jsonb_array_length(orders),'recoverable_copy',true,'client_cart',cart,'financial_documents_unchanged',true);
end;$$;
revoke all on function public.optyker_cancel_order_sheet(uuid,uuid,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.optyker_cancel_order_sheet(uuid,uuid,timestamptz,text,boolean) to service_role;

create or replace function optyker_private.cancelled_sheet_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if tg_table_name='optyker_sheets' and old.archived_at is not null then raise exception 'Scheda annullata: lo storico non può essere modificato';end if;
 return new;
end;$$;
create trigger optyker_cancelled_sheet_guard before update on public.optyker_sheets for each row execute function optyker_private.cancelled_sheet_guard();
revoke all on function optyker_private.cancelled_sheet_guard() from public,anon,authenticated;

create or replace function optyker_private.cancelled_order_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if old.payload ? 'sheet_cancelled_at' and (new.status<>'annullato' or new.payload->'sheet_cancelled_at' is distinct from old.payload->'sheet_cancelled_at' or new.source_sheet_id is distinct from old.source_sheet_id) then raise exception 'Ordine annullato con la scheda: crea un nuovo documento';end if;
 return new;
end;$$;
create trigger optyker_cancelled_order_guard before update on public.optyker_work_orders for each row execute function optyker_private.cancelled_order_guard();
revoke all on function optyker_private.cancelled_order_guard() from public,anon,authenticated;

create or replace function optyker_private.order_parameter_summary() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare p jsonb;summary text;
begin
 p:=new.payload#>'{snapshot,order_parameters}';
 if p is null then return new;end if;
 select string_agg(label||' '||left(p->>key,32)||' '||unit,' · ' order by seq) into summary
 from (values (1,'height_od_mm','Altezza DX','mm'),(2,'height_os_mm','Altezza SX','mm'),
 (3,'pd_od_mm','Distanza DX','mm'),(4,'pd_os_mm','Distanza SX','mm'),
 (5,'pantoscopic_angle_deg','Pantoscopico','°'),(6,'wrap_angle_deg','Avvolgimento','°')) f(seq,key,label,unit)
 where p->>key is not null;
 new.payload:=jsonb_set(new.payload,'{summary_text}',to_jsonb(split_part(coalesce(new.payload->>'summary_text',''),' · Parametri d’ordine: ',1)||coalesce(' · Parametri d’ordine: '||summary,'')),true);
 return new;
end;$$;
create trigger optyker_order_parameter_summary before insert or update of payload on public.optyker_work_orders for each row execute function optyker_private.order_parameter_summary();
revoke all on function optyker_private.order_parameter_summary() from public,anon,authenticated;

-- Retain the existing staff authentication and ACLs; only active-document behavior changes.
CREATE OR REPLACE FUNCTION public.optyker_client_sheet_actions(p_username text, p_password text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
 cid uuid; sid uuid; s public.optyker_sheets%rowtype; dest public.optyker_sheets%rowtype;
 w public.optyker_work_orders%rowtype; link public.optyker_quote_order_links%rowtype;
 rows jsonb; snap jsonb; ref text; typ text; summ text; is_eye boolean; amount numeric;
begin
 if public.optyker_staff_allowed(p_username,p_password) is not true then
  return jsonb_build_object('ok',false,'error','Operatore non autorizzato');
 end if;
 cid:=nullif(p_payload->>'client_id','')::uuid;
 if cid is null or not exists(select 1 from public.optyker_clients where id=cid) then raise exception 'Seleziona un cliente valido'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(x order by x.created_at desc,x.id),'[]'::jsonb) into rows from (
   select sheet_row.*,public.optyker_sheet_is_quote(sheet_row) as is_quote,
    case when l.quote_id is not null then jsonb_build_object('order_sheet_id',l.order_sheet_id,'work_order_id',l.work_order_id,'reference',ow.reference_code,'status',ow.status) else null end as converted_order,
    case when sw.id is not null then jsonb_build_object('id',sw.id,'reference',sw.reference_code,'status',sw.status) else null end as laboratory_order,
    (sw.id is not null or l.quote_id is not null or exists(select 1 from public.optyker_eyewear_warranty_instances wi where wi.source_sheet_id=sheet_row.id)) and not (sheet_row.sheet_type like 'eyewear\_%' escape '\' or sheet_row.sheet_type='lac' or sheet_row.sheet_type like 'lac\_%' escape '\') as delete_blocked
   from public.optyker_sheets sheet_row
   left join public.optyker_quote_order_links l on l.quote_id=sheet_row.id
   left join public.optyker_work_orders ow on ow.id=l.work_order_id
   left join public.optyker_work_orders sw on sw.source_sheet_id=sheet_row.id
   where sheet_row.client_id=cid and sheet_row.archived_at is null order by sheet_row.created_at desc,sheet_row.id
  )x;
  return jsonb_build_object('ok',true,'client_id',cid,'data',rows);
 end if;
 sid:=nullif(p_payload->>'sheet_id','')::uuid;
 select * into s from public.optyker_sheets where id=sid and client_id=cid for update;
 if not found then
  if p_action='delete' and exists(select 1 from public.optyker_sheet_trash where sheet_id=sid and client_id=cid) then return jsonb_build_object('ok',true,'already_deleted',true); end if;
  raise exception 'Scheda non disponibile per il cliente selezionato';
 end if;
 if s.archived_at is not null then
  if p_action='delete' then return jsonb_build_object('ok',true,'already_deleted',true,'recoverable_copy',true);end if;
  raise exception 'Scheda annullata';
 end if;
 if p_action='get' then return jsonb_build_object('ok',true,'client_id',cid,'data',to_jsonb(s)); end if;
 if p_action not in ('delete','convert') then raise exception 'Azione non riconosciuta'; end if;
 if p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Conferma esplicita richiesta'; end if;
 -- Repeated conversion requests return the same order, even after a later source update.
 if p_action='convert' then
  select * into link from public.optyker_quote_order_links where quote_id=s.id;
  if found then
   select * into dest from public.optyker_sheets where id=link.order_sheet_id;
   select * into w from public.optyker_work_orders where id=link.work_order_id;
   return jsonb_build_object('ok',true,'data',to_jsonb(dest),'order',to_jsonb(w),'already_converted',true);
  end if;
 end if;
 if nullif(p_payload->>'expected_updated_at','')::timestamptz is distinct from s.updated_at then raise exception 'La scheda è stata modificata: ricarica prima di continuare'; end if;
 if p_action='delete' then
  if s.sheet_type like 'eyewear\_%' escape '\' or s.sheet_type='lac' or s.sheet_type like 'lac\_%' escape '\' then
   return public.optyker_cancel_order_sheet(cid,s.id,s.updated_at,p_username,true);
  end if;
  perform set_config('optyker.sheet_actor',p_username,true);
  delete from public.optyker_sheets where id=s.id;
  return jsonb_build_object('ok',true,'sheet_id',s.id,'recoverable_copy',true);
 end if;
 if not public.optyker_sheet_is_quote(s) then raise exception 'Solo un preventivo può essere trasformato in ordine'; end if;
 is_eye:=s.sheet_type in ('eyewear_quote','eyewear_quote_v1');
 if not is_eye and s.sheet_type<>'lac' then raise exception 'Conversione disponibile per preventivi Occhiali e LAC'; end if;
 snap:=s.data;
 if is_eye then
  if nullif(snap#>>'{frame,type}','') is null or nullif(snap#>>'{lens,lens_type_od}','') is null or nullif(snap#>>'{lens,lens_type_os}','') is null then raise exception 'Completa prima montatura e lenti DX/SX nel preventivo'; end if;
  amount:=nullif(snap#>>'{pricing,total}','')::numeric;
  if amount is null or amount<0 or amount='NaN'::numeric then raise exception 'Totale del preventivo non valido'; end if;
  ref:=public.optyker_next_eyewear_reference('job'); typ:='eyewear_job';
  snap:=snap||jsonb_build_object('mode','job','sheetType',typ,'documentType','Busta','reference_code',ref);
  summ:=concat('Montatura: ',concat_ws(' ',snap#>>'{frame,brand}',snap#>>'{frame,model}'),' · DX: ',snap#>>'{lens,lens_type_od}',' · SX: ',snap#>>'{lens,lens_type_os}');
 else
  if coalesce(nullif(snap#>>'{lacState,odProductName}',''),nullif(snap#>>'{lacState,osProductName}','')) is null then raise exception 'Completa almeno una lente nel preventivo LAC prima di ordinare'; end if;
  ref:=public.optyker_next_reference('B',now());typ:='lac';
  snap:=snap||jsonb_build_object('documentType','Busta','document','Busta','sheetLabel','Busta LAC','reference_code',ref,'referenceCode',ref,'documentReference',ref);
  snap:=jsonb_set(snap,'{lacState}',coalesce(snap->'lacState','{}'::jsonb)||jsonb_build_object('document','Busta'),true);
  snap:=jsonb_set(snap,'{elements}',coalesce(snap->'elements','{}'::jsonb)||jsonb_build_object('lacReference',jsonb_build_object('kind','value','value',ref)),true);
  summ:=concat('LAC · ',snap#>>'{lacState,brand}',' · OD: ',snap#>>'{lacState,odProductName}',' · OS: ',snap#>>'{lacState,osProductName}');
 end if;
 snap:=snap||jsonb_build_object('source_quote_id',s.id,'source_quote_reference',coalesce(s.reference_code,s.reference_no),'converted_at',now(),'savedAt',now(),'client_id',cid);
 insert into public.optyker_sheets(client_id,sheet_type,title,operator,data,reference_code,reference_no,document_type)
 values(cid,typ,case when is_eye then 'Busta occhiali' else 'Busta LAC' end||' · '||ref,p_username,snap,ref,ref,'Busta') returning * into dest;
 insert into public.optyker_work_orders(reference_code,client_id,source_sheet_id,order_type,status,status_since,payload,created_by)
 values(ref,cid,dest.id,case when is_eye then 'eyewear_busta' else 'lac_busta' end,'da_fare',now(),
 jsonb_build_object('snapshot',dest.data,'summary_text',summ,'document','Busta','source_quote_id',s.id,'source_quote_reference',coalesce(s.reference_code,s.reference_no),'sent_at',now(),'source_updated_at',dest.updated_at),p_username) returning * into w;
 insert into public.optyker_quote_order_links(quote_id,order_sheet_id,work_order_id,client_id,created_by) values(s.id,dest.id,w.id,cid,p_username);
 return jsonb_build_object('ok',true,'data',to_jsonb(dest),'order',to_jsonb(w),'already_converted',false);
exception when invalid_text_representation or invalid_datetime_format then return jsonb_build_object('ok',false,'error','Dati della richiesta non validi');
 when foreign_key_violation then return jsonb_build_object('ok',false,'error','Scheda collegata ad altri documenti: eliminazione non consentita');
 when others then return jsonb_build_object('ok',false,'error',sqlerrm);
end $function$

;
CREATE OR REPLACE FUNCTION optyker_private.client_cart_add_work_order(p_order_id uuid, p_operator text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'optyker_private', 'pg_temp'
AS $function$
declare
  w public.optyker_work_orders%rowtype;
  s public.optyker_sheets%rowtype;
  v_amount numeric:=0;
  v_title text;
  v_item jsonb;
  v_items jsonb;
begin
  select * into w from public.optyker_work_orders where id=p_order_id;
  if not found or w.status='annullato' or w.source_sheet_id is null then return; end if;
  if w.source_sheet_id is not null then select * into s from public.optyker_sheets where id=w.source_sheet_id; end if;

  if s.archived_at is not null then return;end if;
  if w.order_type='eyewear_busta' then
    v_amount:=coalesce(optyker_private.money_from_text(s.data#>>'{pricing,total}'),0);
    v_title:='Occhiale · '||coalesce(nullif(w.reference_code,''),'Busta');
  else
    v_amount:=coalesce(optyker_private.money_from_text(s.data#>>'{lacState,odCost}'),0)+coalesce(optyker_private.money_from_text(s.data#>>'{lacState,osCost}'),0);
    v_title:='Lenti a contatto · '||coalesce(nullif(w.reference_code,''),'Busta');
  end if;

  v_item:=jsonb_build_object(
    'variant_id','client_cart:'||w.id::text,
    'title',v_title,
    'variant_title',coalesce(w.reference_code,''),
    'sku',coalesce(w.reference_code,''),
    'price',round(v_amount,2),
    'list_price',round(v_amount,2),
    'fiscal_vat_code','',
    'fiscal_item_type','goods',
    'quantity',1,
    'department',null,
    'source_work_order_id',w.id,
    'source_sheet_id',w.source_sheet_id,
    'source_type',w.order_type,
    'locked_price',true,
    'created_at',w.created_at
  );

  insert into public.optyker_client_carts(client_id,items,updated_by,updated_at)
  values(w.client_id,jsonb_build_array(v_item),coalesce(nullif(p_operator,''),w.created_by,''),now())
  on conflict(client_id) do update
  set items=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(public.optyker_client_carts.items) x where x->>'variant_id'<>('client_cart:'||w.id::text)) || jsonb_build_array(v_item),
      updated_by=coalesce(nullif(p_operator,''),w.created_by,''),
      updated_at=now();
end;
$function$

;
CREATE OR REPLACE FUNCTION public.optyker_eyewear_order_api(p_username text, p_password text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  s public.optyker_sheets%rowtype;
  w public.optyker_work_orders%rowtype;
  cid uuid;
  sid uuid;
  summary text;
  snap jsonb;
  v_document text;
begin
  if public.optyker_staff_allowed(p_username,p_password) is not true then
    return jsonb_build_object('ok',false,'error','Operatore non autorizzato');
  end if;

  cid:=nullif(p_payload->>'client_id','')::uuid;
  sid:=nullif(p_payload->>'source_sheet_id','')::uuid;
  if cid is null then raise exception 'Apri prima il cliente a cui vuoi collegare il documento Occhiali'; end if;

  select * into s
  from public.optyker_sheets
  where id=sid and client_id=cid
  for update;
  if not found then raise exception 'Documento Occhiali non trovato per il cliente selezionato'; end if;
  if s.archived_at is not null then raise exception 'Scheda annullata: crea un nuovo documento';end if;

  if not (
    (s.sheet_type='eyewear_job' and coalesce(s.data->>'mode','')='job')
    or
    (s.sheet_type='eyewear_quote' and coalesce(s.data->>'mode','')='quote')
  ) then
    raise exception 'Documento Occhiali non ordinabile';
  end if;

  select * into w from public.optyker_work_orders where source_sheet_id=s.id;
  if p_action='state' then
    return jsonb_build_object('ok',true,'data',case when w.id is null then null else to_jsonb(w) end);
  end if;
  if p_action<>'submit' then raise exception 'Azione non riconosciuta'; end if;

  if w.id is not null and w.status='annullato' then raise exception 'Ordine annullato: crea un nuovo documento';end if;
  if w.id is not null then
    perform optyker_private.client_cart_add_work_order(w.id,p_username);
    return jsonb_build_object('ok',true,'data',to_jsonb(w),'already_sent',true);
  end if;

  if nullif(p_payload->>'updated_at','')::timestamptz is distinct from s.updated_at then
    raise exception 'Il documento Occhiali è stato aggiornato: ricaricalo prima di ordinare';
  end if;
  if nullif(s.reference_code,'') is null then raise exception 'Riferimento documento mancante'; end if;
  if nullif(s.data#>>'{frame,type}','') is null
     or nullif(s.data#>>'{lens,lens_type_od}','') is null
     or nullif(s.data#>>'{lens,lens_type_os}','') is null then
    raise exception 'Completa montatura e lenti DX/SX prima di ordinare';
  end if;

  snap:=s.data;
  v_document:=case when s.sheet_type='eyewear_quote' then 'Preventivo Occhiali ordinato' else 'Busta Occhiali' end;
  summary:=concat(
    'Montatura: ',concat_ws(' ',snap#>>'{frame,brand}',snap#>>'{frame,model}'),
    ' · DX: ',snap#>>'{lens,lens_type_od}',
    ' · SX: ',snap#>>'{lens,lens_type_os}',
    ' · Trattamenti: ',
    coalesce((select string_agg(v,', ') from jsonb_array_elements_text(coalesce(snap#>'{lens,treatments}','[]'::jsonb)) a(v)),'—')
  );

  insert into public.optyker_work_orders(
    reference_code,client_id,source_sheet_id,order_type,status,status_since,payload,created_by
  ) values(
    s.reference_code,cid,s.id,'eyewear_busta','da_fare',now(),
    jsonb_build_object(
      'snapshot',snap,
      'summary_text',summary,
      'document',v_document,
      'source_mode',coalesce(s.data->>'mode',''),
      'sent_at',now(),
      'source_updated_at',s.updated_at
    ),
    p_username
  ) returning * into w;

  return jsonb_build_object('ok',true,'data',to_jsonb(w),'already_sent',false);
exception
  when invalid_text_representation then return jsonb_build_object('ok',false,'error','Riferimenti non validi');
  when others then return jsonb_build_object('ok',false,'error',sqlerrm);
end
$function$

;
CREATE OR REPLACE FUNCTION public.optyker_api_legacy_passwordless_base_20260830(p_username text, p_password text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_id uuid;
  v_client_id uuid;
  v_result jsonb;
  v_rec record;
  v_user text;
begin
  v_user := upper(regexp_replace(trim(coalesce(p_username,'')), '\s+', ' ', 'g'));

  -- Accesso gestionale passwordless: solo gli operatori esplicitamente autorizzati.
  -- Mantiene anche il vecchio accesso con password per compatibilita con eventuali client precedenti.
  if not (
    (trim(coalesce(p_password,'')) = '' and v_user in (
      'OTTICA VISUAL CARE',
      'MICHAEL MOLOGNI',
      'GIORGIA BONO',
      'DIEGO PANSIERI'
    ))
    or
    (v_user = 'OTTICA VISUAL CARE' and encode(digest(trim(coalesce(p_password,'')), 'sha256'), 'hex') = '2f42347699c5b32c974efe7a101d0cef26dbbc828596f4a294ca9d729af370e7')
  ) then
    return jsonb_build_object('ok', false, 'error', 'Operatore non autorizzato');
  end if;

  if p_action = 'ping' then
    return jsonb_build_object('ok', true, 'service', 'Optyker Online', 'operator', trim(p_username));

  elsif p_action = 'list_clients' then
    select coalesce(jsonb_agg(to_jsonb(c) order by lower(c.surname), lower(c.name)), '[]'::jsonb)
      into v_result from public.optyker_clients c;
    return jsonb_build_object('ok', true, 'data', v_result);

  elsif p_action = 'get_client' then
    v_id := nullif(p_payload->>'id','')::uuid;
    select to_jsonb(c) into v_result from public.optyker_clients c where c.id = v_id;
    return jsonb_build_object('ok', true, 'data', v_result);

  elsif p_action = 'save_client' then
    if nullif(p_payload->>'id','') is null then
      insert into public.optyker_clients(name,surname,birth,phone,home_phone,email,pec,fiscal,vat,street,street_number,postal_code,city,province,profession,hobby,referral,notes)
      values(
        coalesce(p_payload->>'name',''), coalesce(p_payload->>'surname',''), coalesce(p_payload->>'birth',''),
        coalesce(p_payload->>'phone',''), coalesce(p_payload->>'home_phone',''), coalesce(p_payload->>'email',''),
        coalesce(p_payload->>'pec',''), coalesce(p_payload->>'fiscal',''), coalesce(p_payload->>'vat',''),
        coalesce(p_payload->>'street',''), coalesce(p_payload->>'street_number',''), coalesce(p_payload->>'postal_code',''),
        coalesce(p_payload->>'city',''), coalesce(p_payload->>'province',''), coalesce(p_payload->>'profession',''),
        coalesce(p_payload->>'hobby',''), coalesce(p_payload->>'referral',''), coalesce(p_payload->>'notes','')
      ) returning * into v_rec;
    else
      v_id := (p_payload->>'id')::uuid;
      update public.optyker_clients set
        name=coalesce(p_payload->>'name',''), surname=coalesce(p_payload->>'surname',''), birth=coalesce(p_payload->>'birth',''),
        phone=coalesce(p_payload->>'phone',''), home_phone=coalesce(p_payload->>'home_phone',''), email=coalesce(p_payload->>'email',''),
        pec=coalesce(p_payload->>'pec',''), fiscal=coalesce(p_payload->>'fiscal',''), vat=coalesce(p_payload->>'vat',''),
        street=coalesce(p_payload->>'street',''), street_number=coalesce(p_payload->>'street_number',''), postal_code=coalesce(p_payload->>'postal_code',''),
        city=coalesce(p_payload->>'city',''), province=coalesce(p_payload->>'province',''), profession=coalesce(p_payload->>'profession',''),
        hobby=coalesce(p_payload->>'hobby',''), referral=coalesce(p_payload->>'referral',''), notes=coalesce(p_payload->>'notes',''), updated_at=now()
      where id=v_id returning * into v_rec;
    end if;
    return jsonb_build_object('ok', true, 'data', to_jsonb(v_rec));

  elsif p_action = 'delete_client' then
    v_id := nullif(p_payload->>'id','')::uuid;
    delete from public.optyker_clients where id=v_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'list_sheets' then
    v_client_id := nullif(p_payload->>'client_id','')::uuid;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb)
      into v_result from public.optyker_sheets s where s.client_id=v_client_id and s.archived_at is null;
    return jsonb_build_object('ok', true, 'data', v_result);

  elsif p_action = 'save_sheet' then
    v_client_id := nullif(p_payload->>'client_id','')::uuid;
    if nullif(p_payload->>'id','') is null then
      insert into public.optyker_sheets(client_id,sheet_type,title,operator,data)
      values(v_client_id, coalesce(p_payload->>'sheet_type',''), coalesce(p_payload->>'title',''), coalesce(p_payload->>'operator',''), coalesce(p_payload->'data','{}'::jsonb))
      returning * into v_rec;
    else
      v_id := (p_payload->>'id')::uuid;
      update public.optyker_sheets set client_id=v_client_id, sheet_type=coalesce(p_payload->>'sheet_type',''), title=coalesce(p_payload->>'title',''), operator=coalesce(p_payload->>'operator',''), data=coalesce(p_payload->'data','{}'::jsonb), updated_at=now()
      where id=v_id returning * into v_rec;
    end if;
    return jsonb_build_object('ok', true, 'data', to_jsonb(v_rec));

  elsif p_action = 'delete_sheet' then
    v_id := nullif(p_payload->>'id','')::uuid;
    delete from public.optyker_sheets where id=v_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'list_consents' then
    v_client_id := nullif(p_payload->>'client_id','')::uuid;
    select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
      into v_result from public.optyker_consents c where c.client_id=v_client_id;
    return jsonb_build_object('ok', true, 'data', v_result);

  elsif p_action = 'save_consent' then
    v_client_id := nullif(p_payload->>'client_id','')::uuid;
    if nullif(p_payload->>'id','') is null then
      insert into public.optyker_consents(client_id,consent_type,file_name,data,signature_data_url)
      values(v_client_id, coalesce(p_payload->>'consent_type',''), coalesce(p_payload->>'file_name',''), coalesce(p_payload->'data','{}'::jsonb), coalesce(p_payload->>'signature_data_url',''))
      returning * into v_rec;
    else
      v_id := (p_payload->>'id')::uuid;
      update public.optyker_consents set consent_type=coalesce(p_payload->>'consent_type',''), file_name=coalesce(p_payload->>'file_name',''), data=coalesce(p_payload->'data','{}'::jsonb), signature_data_url=coalesce(p_payload->>'signature_data_url',''), updated_at=now()
      where id=v_id returning * into v_rec;
    end if;
    return jsonb_build_object('ok', true, 'data', to_jsonb(v_rec));

  elsif p_action = 'delete_consent' then
    v_id := nullif(p_payload->>'id','')::uuid;
    delete from public.optyker_consents where id=v_id;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'Azione non riconosciuta');
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$function$

;
