-- Consume only the lines of a completed checkout, once, retaining excluded lines.
-- Staff authentication remains in the Edge Functions; this RPC is service-role only.
create or replace function public.optyker_complete_client_cart_sale(p_sale_id uuid,p_operator text)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public
as $$
declare
  s public.optyker_pos_sales%rowtype;
  c public.optyker_client_carts%rowtype;
  item jsonb;
  kept jsonb := '[]'::jsonb;
  bought numeric;
  remaining numeric;
begin
  select * into s from public.optyker_pos_sales where id=p_sale_id for update;
  if not found then raise exception 'Vendita non trovata'; end if;
  if s.client_id is null then return null; end if;
  select * into c from public.optyker_client_carts where client_id=s.client_id for update;
  if not found then c.client_id:=s.client_id;c.items:='[]'::jsonb; end if;
  if coalesce(s.data->>'client_cart_selection','false') <> 'true'
    or coalesce(s.data->>'client_cart_consumed','false') = 'true' then
    return jsonb_build_object('client_id',c.client_id,'items',c.items,'updated_at',c.updated_at);
  end if;
  if s.status not in ('completed','open_balance') then raise exception 'Incasso da riconciliare'; end if;
  if s.paid_amount>0 and not exists(select 1 from public.optyker_pos_payments p where p.sale_id=s.id) then
    raise exception 'Pagamento da riconciliare';
  end if;
  for item in select value from jsonb_array_elements(c.items) loop
    select coalesce(sum((l->>'quantity')::numeric),0) into bought
      from jsonb_array_elements(coalesce(s.data->'lines','[]'::jsonb)) l
      where coalesce(nullif(l->>'variant_id',''),l->>'catalog_id')=item->>'variant_id';
    remaining:=coalesce((item->>'quantity')::numeric,1)-bought;
    if remaining>0 then
      kept:=kept||jsonb_build_array(case when bought>0 then jsonb_set(item,'{quantity}',to_jsonb(remaining)) else item end);
    end if;
  end loop;
  update public.optyker_client_carts set items=kept,updated_by=p_operator,updated_at=clock_timestamp()
    where client_id=s.client_id returning * into c;
  update public.optyker_pos_sales set data=coalesce(data,'{}'::jsonb)||jsonb_build_object('client_cart_consumed',true,'client_cart_consumed_at',clock_timestamp())
    where id=s.id;
  return jsonb_build_object('client_id',s.client_id,'items',kept,'updated_at',c.updated_at);
end;
$$;
revoke all on function public.optyker_complete_client_cart_sale(uuid,text) from public,anon,authenticated;
grant execute on function public.optyker_complete_client_cart_sale(uuid,text) to service_role;
