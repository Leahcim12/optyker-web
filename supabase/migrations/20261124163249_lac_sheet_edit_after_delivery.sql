-- Schede LAC modificabili anche con ordine Consegnato o chiuso.
-- La correzione di una scheda aggiorna la riga del carrello cliente solo se c'è
-- ancora: un ordine già incassato e consegnato in cassa non torna nel carrello.

create or replace function optyker_private.client_cart_add_work_order(p_order_id uuid, p_operator text default ''::text)
 returns void
 language plpgsql
 set search_path to 'public', 'optyker_private', 'pg_temp'
as $function$
declare
  w public.optyker_work_orders%rowtype;
  s public.optyker_sheets%rowtype;
  v_amount numeric:=0;
  v_title text;
  v_item jsonb;
  v_manual text;
  v_existing jsonb;
begin
  select * into w from public.optyker_work_orders where id=p_order_id;
  if not found or w.status='annullato' or w.source_sheet_id is null then return; end if;

  select * into s from public.optyker_sheets where id=w.source_sheet_id;
  if not found or s.archived_at is not null then return; end if;

  select x into v_existing
  from public.optyker_client_carts c
  cross join lateral jsonb_array_elements(coalesce(c.items,'[]'::jsonb)) x
  where c.client_id=w.client_id
    and x->>'variant_id'='client_cart:'||w.id::text
  limit 1;

  -- Correzione di una scheda già esistente: si aggiorna la riga ancora nel carrello,
  -- ma non si rimette nel carrello un ordine che non c'è più (già incassato e consegnato).
  if v_existing is null and coalesce(current_setting('optyker.cart_refresh_only',true),'')='on' then
    return;
  end if;

  if w.order_type='eyewear_busta' then
    v_manual:=nullif(trim(coalesce(s.data#>>'{pricing,manual_final_price}','')),'');
    if v_manual is not null then
      v_amount:=optyker_private.money_from_text(v_manual);
    else
      v_amount:=coalesce(optyker_private.money_from_text(s.data#>>'{pricing,total}'),0);
    end if;
    v_title:='Occhiale · '||coalesce(nullif(w.reference_code,''),'Busta');
  else
    v_manual:=nullif(trim(coalesce(s.data#>>'{lacState,manualFinalPrice}','')),'');
    if v_manual is null then v_manual:=nullif(trim(coalesce(s.data#>>'{lacState,manual_final_price}','')),''); end if;
    if v_manual is null then v_manual:=nullif(trim(coalesce(s.data#>>'{lacState,finalPrice}','')),''); end if;
    if v_manual is not null then
      v_amount:=optyker_private.money_from_text(v_manual);
    else
      v_amount:=coalesce(optyker_private.money_from_text(s.data#>>'{lacState,odCost}'),0)
              +coalesce(optyker_private.money_from_text(s.data#>>'{lacState,osCost}'),0);
    end if;
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
    'department',case when v_existing is not null then v_existing->'department' else 'null'::jsonb end,
    'selected',case when v_existing is not null and v_existing ? 'selected' then v_existing->'selected' else 'true'::jsonb end,
    'unit_price_override',case when v_existing is not null and v_existing ? 'unit_price_override' then v_existing->'unit_price_override' else 'null'::jsonb end,
    'source_work_order_id',w.id,
    'source_sheet_id',w.source_sheet_id,
    'source_type',w.order_type,
    'locked_price',true,
    'created_at',w.created_at
  );

  insert into public.optyker_client_carts(client_id,items,updated_by,updated_at)
  values(w.client_id,jsonb_build_array(v_item),coalesce(nullif(p_operator,''),w.created_by,''),now())
  on conflict(client_id) do update
  set items=(select coalesce(jsonb_agg(x),'[]'::jsonb)
             from jsonb_array_elements(public.optyker_client_carts.items) x
             where x->>'variant_id'<>('client_cart:'||w.id::text)) || jsonb_build_array(v_item),
      updated_by=coalesce(nullif(p_operator,''),w.created_by,''),
      updated_at=now();
end;
$function$;

create or replace function public.optyker_client_sheet_update(p_username text, p_password text, p_payload jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
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

  -- Anche con ordine Consegnato o chiuso la scheda resta modificabile.
  select * into w
  from public.optyker_work_orders
  where source_sheet_id=s.id
  order by created_at desc
  limit 1
  for update;

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

  -- La correzione aggiorna il carrello solo se l'ordine è ancora da incassare:
  -- un ordine già incassato e consegnato non torna nel carrello cliente.
  perform set_config('optyker.cart_refresh_only','on',true);

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

  perform set_config('optyker.cart_refresh_only','',true);

  return jsonb_build_object('ok',true,'data',to_jsonb(updated),'work_order_synced',w.id is not null);
exception
  when invalid_text_representation or invalid_datetime_format then
    return jsonb_build_object('ok',false,'error','Dati della richiesta non validi');
  when others then
    return jsonb_build_object('ok',false,'error',sqlerrm);
end
$function$;
