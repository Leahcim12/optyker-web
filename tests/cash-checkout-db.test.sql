-- No external requests. Synthetic rows and constraints are checked then rolled back.
begin;
do $$
declare request_id text:=gen_random_uuid()::text; blocked boolean:=false;
begin
 insert into public.optyker_pos_sales(operator_username,status,total,data)
 values('CASH_AUTO_ROLLBACK','pending',1,jsonb_build_object('checkout_request_id',request_id));
 begin
  insert into public.optyker_pos_sales(operator_username,status,total,data)
  values('CASH_AUTO_ROLLBACK','pending',1,jsonb_build_object('checkout_request_id',request_id));
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Duplicate checkout request accepted'; end if;
 if has_function_privilege('anon','public.optyker_confirm_fiscal_reference(uuid,text,date,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.optyker_confirm_fiscal_reference(uuid,text,date,text,jsonb)','EXECUTE') then
  raise exception 'Reference confirmation exposed publicly';
 end if;
 if position('Europe/Rome' in pg_get_functiondef('public.optyker_confirm_fiscal_reference(uuid,text,date,text,jsonb)'::regprocedure))=0 then
  raise exception 'Italian receipt date not used';
 end if;
end;
$$;
rollback;
select 'Checkout uniqueness, private fiscal confirmation and Italian date verified; fixtures rolled back.' as verification;
