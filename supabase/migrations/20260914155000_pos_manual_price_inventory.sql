create table if not exists public.optyker_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.optyker_pos_sales(id) on delete cascade,
  inventory_item_id uuid not null references public.optyker_inventory_items(id) on delete restrict,
  shopify_variant_id text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  stock_before integer not null,
  stock_after integer not null check (stock_after >= 0),
  operator_username text not null default '',
  reason text not null default 'pos_sale',
  shopify_synced boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sale_id, inventory_item_id)
);

alter table public.optyker_inventory_movements enable row level security;
revoke all on public.optyker_inventory_movements from anon, authenticated;
grant all on public.optyker_inventory_movements to service_role;

create or replace function public.optyker_apply_pos_inventory_movements(
  p_sale_id uuid,
  p_lines jsonb,
  p_operator text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_variant text;
  v_inventory_id uuid;
  v_qty integer;
  v_price numeric(12,2);
  v_item public.optyker_inventory_items%rowtype;
  v_existing public.optyker_inventory_movements%rowtype;
  v_before integer;
  v_after integer;
  v_remaining integer;
  v_cut integer;
  v_lot record;
  v_out jsonb := '[]'::jsonb;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Righe magazzino non valide';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_variant := nullif(trim(coalesce(v_line->>'variant_id','')), '');
    v_inventory_id := null;
    begin
      if nullif(trim(coalesce(v_line->>'inventory_item_id','')), '') is not null then
        v_inventory_id := (v_line->>'inventory_item_id')::uuid;
      end if;
    exception when others then
      raise exception 'Riferimento magazzino non valido';
    end;

    if v_inventory_id is null and (v_variant is null or v_variant not like 'gid://shopify/ProductVariant/%') then
      continue;
    end if;

    begin
      v_qty := (v_line->>'quantity')::integer;
    exception when others then
      raise exception 'Quantità magazzino non valida';
    end;
    if v_qty is null or v_qty <= 0 or v_qty > 999 then
      raise exception 'Quantità magazzino non valida';
    end if;

    begin
      v_price := round(coalesce((v_line->>'unit_price')::numeric,0),2);
    exception when others then
      raise exception 'Prezzo magazzino non valido';
    end;
    if v_price < 0 or v_price > 1000000 then
      raise exception 'Prezzo magazzino non valido';
    end if;

    if v_inventory_id is not null then
      select * into v_item
      from public.optyker_inventory_items
      where active = true and id = v_inventory_id
      for update;
    else
      select * into v_item
      from public.optyker_inventory_items
      where active = true and shopify_variant_id = v_variant
      order by updated_at desc nulls last, created_at desc
      limit 1
      for update;
    end if;

    if not found or v_item.category = 'services' then
      continue;
    end if;

    select * into v_existing
    from public.optyker_inventory_movements
    where sale_id = p_sale_id and inventory_item_id = v_item.id;
    if found then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'applied',false,'movement_id',v_existing.id,'inventory_item_id',v_item.id,
        'variant_id',coalesce(v_item.shopify_variant_id,v_variant,''),'quantity',v_existing.quantity,
        'stock_before',v_existing.stock_before,'stock_after',v_existing.stock_after,
        'shopify_synced',v_existing.shopify_synced,
        'shopify_inventory_item_id',coalesce(v_item.shopify_inventory_item_id,''),
        'shopify_location_id',coalesce(v_item.shopify_location_id,'')
      ));
      continue;
    end if;

    v_before := greatest(0, coalesce(v_item.inventory_quantity,0));
    if v_before < v_qty then
      raise exception 'Giacenza insufficiente per %: disponibili %, richiesti %', v_item.title, v_before, v_qty;
    end if;
    v_after := v_before - v_qty;

    update public.optyker_inventory_items
    set inventory_quantity = v_after,
        shopify_inventory_quantity = case
          when shopify_inventory_quantity is null then null
          else greatest(0, shopify_inventory_quantity - v_qty)
        end,
        updated_at = now()
    where id = v_item.id;

    v_remaining := v_qty;
    for v_lot in
      select id, quantity
      from public.optyker_inventory_lots
      where inventory_item_id = v_item.id and quantity > 0
      order by expiry_date asc nulls last, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_cut := least(v_lot.quantity, v_remaining);
      update public.optyker_inventory_lots
      set quantity = quantity - v_cut,
          notes = case when notes = '' then 'Scarico vendita Optyker' else notes || ' · Scarico vendita Optyker' end,
          updated_at = now()
      where id = v_lot.id;
      v_remaining := v_remaining - v_cut;
    end loop;

    insert into public.optyker_inventory_movements(
      sale_id, inventory_item_id, shopify_variant_id, quantity, unit_price,
      stock_before, stock_after, operator_username, reason, data
    ) values (
      p_sale_id, v_item.id, coalesce(v_item.shopify_variant_id,v_variant,''), v_qty, v_price,
      v_before, v_after, coalesce(p_operator,''), 'pos_sale',
      jsonb_build_object('zero_price',v_price = 0,'manual_price',true)
    ) returning * into v_existing;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'applied',true,'movement_id',v_existing.id,'inventory_item_id',v_item.id,
      'variant_id',coalesce(v_item.shopify_variant_id,v_variant,''),'quantity',v_qty,
      'stock_before',v_before,'stock_after',v_after,'shopify_synced',false,
      'shopify_inventory_item_id',coalesce(v_item.shopify_inventory_item_id,''),
      'shopify_location_id',coalesce(v_item.shopify_location_id,'')
    ));
  end loop;

  return v_out;
end;
$$;

revoke all on function public.optyker_apply_pos_inventory_movements(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.optyker_apply_pos_inventory_movements(uuid,jsonb,text) to service_role;
