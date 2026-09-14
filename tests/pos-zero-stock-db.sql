begin;
do $test$
declare item uuid; sale uuid; r jsonb; again jsonb; n integer;
begin
 select id into sale from public.optyker_pos_sales limit 1;
 if sale is null then raise exception 'Test requires an existing sale'; end if;
 foreach n in array array[0,1,5] loop
  insert into public.optyker_inventory_items(title,inventory_quantity,category,source)
   values ('ROLLBACK TEST POS STOCK',n,'accessories','manual') returning id into item;
  r:=public.optyker_apply_pos_inventory_movements(sale,jsonb_build_array(jsonb_build_object('inventory_item_id',item,'quantity',2,'unit_price',10)),'test');
  if (r->0->>'stock_after')::integer<>greatest(0,n-2) or (r->0->>'quantity')::integer<>2 then raise exception 'Invalid stock result %',r; end if;
  if not exists(select 1 from public.optyker_inventory_movements where inventory_item_id=item and (data->>'missing_quantity')::integer=greatest(0,2-n)) then raise exception 'Missing shortage audit'; end if;
  again:=public.optyker_apply_pos_inventory_movements(sale,jsonb_build_array(jsonb_build_object('inventory_item_id',item,'quantity',2,'unit_price',10)),'test');
  if (again->0->>'applied')::boolean then raise exception 'Duplicate movement';end if;
  begin
   perform public.optyker_apply_pos_inventory_movements(sale,jsonb_build_array(jsonb_build_object('inventory_item_id',item,'quantity',0,'unit_price',10)),'test');
   raise exception 'Invalid quantity accepted';
  exception when others then if sqlerrm not like 'Quantità magazzino non valida%' then raise;end if; end;
 end loop;
 if has_function_privilege('anon','public.optyker_apply_pos_inventory_movements(uuid,jsonb,text)','EXECUTE') or has_function_privilege('authenticated','public.optyker_apply_pos_inventory_movements(uuid,jsonb,text)','EXECUTE') then raise exception 'Unexpected access'; end if;
end $test$;
rollback;
