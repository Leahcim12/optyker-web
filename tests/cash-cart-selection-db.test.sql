-- Entire fixture is rolled back; no fiscal jobs, inventory changes or external calls.
begin;
do $$
declare c uuid;s uuid;r jsonb;before_items jsonb;blocked boolean:=false;
begin
  -- Use an existing client only as an FK: its cart is protected by this transaction.
  select id into c from public.optyker_clients order by id limit 1;
  if c is null then raise exception 'A client fixture is required'; end if;
  insert into public.optyker_client_carts(client_id,items) values(c,'[]') on conflict(client_id) do nothing;
  update public.optyker_client_carts set items='[{"variant_id":"test:pay","quantity":3,"selected":true},{"variant_id":"client_cart:test-paid","quantity":1,"selected":true},{"variant_id":"client_cart:test-later","quantity":1,"selected":false}]'::jsonb where client_id=c;
  insert into public.optyker_pos_sales(client_id,status,paid_amount,total,data) values(c,'completed',10,10,'{"client_cart_selection":true,"lines":[{"variant_id":"test:pay","quantity":2},{"variant_id":"client_cart:test-paid","quantity":1}]}') returning id into s;
  begin perform public.optyker_complete_client_cart_sale(s,'test');exception when others then blocked:=true;end;
  if not blocked then raise exception 'Missing payment was accepted';end if;
  insert into public.optyker_pos_payments(sale_id,payment_stage,amount) values(s,'balance',10);
  r:=public.optyker_complete_client_cart_sale(s,'test');
  if jsonb_array_length(r->'items')<>2 or r#>>'{items,0,quantity}'<>'1' or r#>>'{items,1,selected}'<>'false' then raise exception 'Deferred or remaining quantities lost: %',r;end if;
  before_items:=r->'items';
  r:=public.optyker_complete_client_cart_sale(s,'test');
  if r->'items'<>before_items then raise exception 'Replay consumed cart twice';end if;
  update public.optyker_client_carts set items=items||'{"variant_id":"test:new","quantity":1,"selected":true}'::jsonb where client_id=c;
  r:=public.optyker_complete_client_cart_sale(s,'test');
  if jsonb_array_length(r->'items')<>3 then raise exception 'Replay lost a later addition';end if;
  if has_function_privilege('anon','public.optyker_complete_client_cart_sale(uuid,text)','execute') or has_function_privilege('authenticated','public.optyker_complete_client_cart_sale(uuid,text)','execute') then raise exception 'RPC public access';end if;
end;
$$;
rollback;
select 'partial checkout, deferred lines, replay, new additions and RPC access: OK (rolled back)' as result;
