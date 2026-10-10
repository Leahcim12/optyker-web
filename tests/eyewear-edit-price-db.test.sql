-- Synthetic fixtures, rolled back. Exercise the same role used by the Edge API.
begin;
do $$
declare cid uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();wid uuid:=gen_random_uuid();
begin
 insert into public.optyker_clients(id,name,reference_no)
 values(cid,'ROLLBACK eyewear price test','TEST-'||cid);
 insert into public.optyker_sheets(id,client_id,sheet_type,reference_code,document_type,data)
 values(sid,cid,'eyewear_job','TEST-'||sid,'Busta','{"pricing":{"total":320},"notes":"kept"}');
 insert into public.optyker_work_orders(id,reference_code,client_id,source_sheet_id,order_type,payload)
 select wid,'TEST-'||wid,cid,sid,'eyewear_busta',jsonb_build_object('snapshot',data)
 from public.optyker_sheets where id=sid;
 perform set_config('role','service_role',true);
 update public.optyker_sheets set data=jsonb_set(data,'{pricing}','{"total":285.5,"manual_final_price":285.5,"calculated_total":320}') where id=sid;
 -- This update failed after the sheet was already saved: missing schema USAGE.
 update public.optyker_work_orders set payload=jsonb_set(payload,'{snapshot}',(select data from public.optyker_sheets where id=sid)) where id=wid;
 assert (select payload#>>'{snapshot,pricing,total}'='285.5' from public.optyker_work_orders where id=wid),'Laboratory price synchronized';
 assert (select items#>>'{0,price}'='285.50' from public.optyker_client_carts where client_id=cid),'Cart price synchronized';
 update public.optyker_sheets set data=jsonb_set(data,'{pricing}','{"total":280,"manual_final_price":280,"calculated_total":320}') where id=sid;
 update public.optyker_work_orders set payload=jsonb_set(payload,'{snapshot}',(select data from public.optyker_sheets where id=sid)) where id=wid;
 assert (select data#>>'{pricing,total}'='280' and data->>'notes'='kept' from public.optyker_sheets where id=sid),'Second save preserves same document';
 assert (select items#>>'{0,price}'='280.00' from public.optyker_client_carts where client_id=cid),'Second price synchronized';
 assert (select count(*)=1 from public.optyker_sheets where client_id=cid),'No duplicate sheets';
 assert not exists(select 1 from public.optyker_pos_sales where client_id=cid),'No fiscal operations';
 assert not has_schema_privilege('anon','optyker_private','usage'),'No anonymous access';
 assert not has_schema_privilege('authenticated','optyker_private','usage'),'No customer access';
 perform set_config('role','postgres',true);
end $$;
rollback;
select 'PASS: two price changes, same sheet, laboratory/cart synchronized, no fiscal writes; fixtures rolled back' as result;
