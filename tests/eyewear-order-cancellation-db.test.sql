-- Synthetic fixtures only. Every write is rolled back, including successful tests.
begin;
do $$
declare cid uuid:=gen_random_uuid();other_client uuid:=gen_random_uuid();q uuid:=gen_random_uuid();b uuid:=gen_random_uuid();other_sheet uuid:=gen_random_uuid();w uuid:=gen_random_uuid();other_work uuid:=gen_random_uuid();
 stamp timestamptz;result jsonb;before_financial text;after_financial text;blocked boolean;kept jsonb;
begin
 insert into public.optyker_clients(id,name,reference_no) values(cid,'ROLLBACK order test','TEST-'||cid),(other_client,'ROLLBACK other','TEST-'||other_client);
 insert into public.optyker_sheets(id,client_id,sheet_type,title,operator,data,reference_no,reference_code,document_type)
 values(q,cid,'eyewear_quote','TEST quote','test','{"pricing":{"total":80}}','TEST-'||q,'TEST-'||q,'Preventivo'),
 (b,cid,'eyewear_job','TEST busta','test','{"pricing":{"total":80},"order_parameters":{"height_od_mm":23.5,"pd_od_mm":31,"pd_os_mm":32,"pantoscopic_angle_deg":8}}','TEST-'||b,'TEST-'||b,'Busta'),
 (other_sheet,cid,'eyewear_job','TEST kept','test','{"pricing":{"total":20}}','TEST-'||other_sheet,'TEST-'||other_sheet,'Busta');
 insert into public.optyker_work_orders(id,reference_code,client_id,source_sheet_id,order_type,status,payload,created_by)
 select w,'TEST-'||w,cid,b,'eyewear_busta','da_fare',jsonb_build_object('snapshot',data,'summary_text','TEST'),'test' from public.optyker_sheets where id=b;
 insert into public.optyker_work_orders(id,reference_code,client_id,source_sheet_id,order_type,status,payload,created_by)
 values(other_work,'TEST-'||other_work,cid,other_sheet,'eyewear_busta','da_fare','{}','test');
 insert into public.optyker_quote_order_links(quote_id,order_sheet_id,work_order_id,client_id,created_by) values(q,b,w,cid,'test');
 assert (select payload->>'summary_text' like '%Altezza DX 23.5 mm%Distanza DX 31 mm%Distanza SX 32 mm%Pantoscopico 8 °%' from public.optyker_work_orders where id=w),'Laboratory measurements missing';
 update public.optyker_client_carts set items=items||'[{"variant_id":"ordinary-kept","price":10,"quantity":1,"selected":false}]'::jsonb where client_id=cid;
 select md5(coalesce(jsonb_agg(to_jsonb(x))::text,'')) into before_financial from public.optyker_pos_sales x where client_id=cid;
 select updated_at into stamp from public.optyker_sheets where id=q;
 blocked:=false;begin perform public.optyker_cancel_order_sheet(cid,q,stamp,'test',false);exception when others then blocked:=true;end;assert blocked,'Confirmation required';
 blocked:=false;begin perform public.optyker_cancel_order_sheet(other_client,q,stamp,'test',true);exception when others then blocked:=true;end;assert blocked,'Wrong client rejected';
 blocked:=false;begin perform public.optyker_cancel_order_sheet(cid,q,stamp-interval '1 second','test',true);exception when others then blocked:=true;end;assert blocked,'Stale sheet rejected';
 result:=public.optyker_cancel_order_sheet(cid,q,stamp,'test',true);
 assert (result->>'cancelled_orders')::int=1,'Exactly one order cancelled';
 assert jsonb_array_length(result->'archived_sheet_ids')=2,'Linked quote/Busta archived together';
 assert (select count(*)=2 from public.optyker_sheets where id in(q,b) and archived_at is not null),'Sheets archived';
 assert (select status='annullato' and source_sheet_id=b from public.optyker_work_orders where id=w),'Order cancelled with original link retained';
 assert (select status='da_fare' from public.optyker_work_orders where id=other_work),'Other order untouched';
 assert (select archived_at is null from public.optyker_sheets where id=other_sheet),'Other sheet untouched';
 assert (select count(*)=2 from public.optyker_sheet_trash where sheet_id in(q,b)),'Recovery snapshots retained';
 assert (select snapshot#>>'{cancelled_order_snapshots,0,status}'='da_fare' from public.optyker_sheet_trash where sheet_id=q),'Original order status saved';
 select items into kept from public.optyker_client_carts where client_id=cid;
 assert jsonb_array_length(kept)=2,'Only linked cart row removed';
 assert exists(select 1 from jsonb_array_elements(kept) x where x->>'variant_id'='ordinary-kept' and x->>'selected'='false'),'Deferred selection retained';
 perform optyker_private.client_cart_add_work_order(w,'test');
 assert (select items=kept from public.optyker_client_carts where client_id=cid),'Cancelled order cannot reenter cart';
 result:=public.optyker_cancel_order_sheet(cid,q,stamp,'test',true);assert result->>'already_deleted'='true','Retry idempotent';
 blocked:=false;begin update public.optyker_work_orders set status='da_fare' where id=w;exception when others then blocked:=true;end;assert blocked,'Cancelled order cannot be reopened';
 blocked:=false;begin update public.optyker_work_orders set payload='{}' where id=w;exception when others then blocked:=true;end;assert blocked,'Cancellation audit immutable';
 blocked:=false;begin update public.optyker_sheets set archived_at=null where id=b;exception when others then blocked:=true;end;assert blocked,'Archived sheet immutable';
 select md5(coalesce(jsonb_agg(to_jsonb(x))::text,'')) into after_financial from public.optyker_pos_sales x where client_id=cid;
 assert before_financial=after_financial,'Sales unchanged';
 assert not has_function_privilege('anon','public.optyker_cancel_order_sheet(uuid,uuid,timestamptz,text,boolean)','execute'),'Anonymous RPC denied';
 assert not has_function_privilege('authenticated','public.optyker_cancel_order_sheet(uuid,uuid,timestamptz,text,boolean)','execute'),'Direct authenticated RPC denied';
 assert has_function_privilege('service_role','public.optyker_cancel_order_sheet(uuid,uuid,timestamptz,text,boolean)','execute'),'Backend RPC allowed';
end;$$;
rollback;
select 'PASS: cancellation, linked documents, cart, retry, stale protection, permissions and rollback' as result;
