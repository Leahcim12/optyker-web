create or replace function optyker_private.client_cart_add_work_order(p_order_id uuid,p_operator text default '')
returns void
language plpgsql
security invoker
set search_path='public','optyker_private','pg_temp'
as $$
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
$$;
