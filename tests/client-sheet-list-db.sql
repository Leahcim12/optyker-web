\set ON_ERROR_STOP on
-- Requires fixtures/schema from client-sheet-actions-db.sql. Disposable CI database ONLY.
-- The former SQL alias "s" conflicted with a PL/pgSQL record variable of the same name.
-- Unlike an unauthenticated list test, these calls exercise the actual read branch.
begin;
do $test$
declare
 customer_a uuid:=gen_random_uuid(); customer_b uuid:=gen_random_uuid();
 quote_a public.optyker_sheets%rowtype; job_a public.optyker_sheets%rowtype;
 result jsonb; converted jsonb; payload jsonb; before_hash text; after_hash text;
begin
 insert into public.optyker_clients values(customer_a),(customer_b);
 insert into public.optyker_sheets(client_id,sheet_type,title,operator,data,document_type,reference_code)
 values(customer_a,'eyewear_quote','Synthetic quote A','TEST','{"mode":"quote","sheetType":"eyewear_quote","frame":{"type":"Del cliente","price":0},"lens":{"lens_type_od":"Monofocale","lens_type_os":"Monofocale"},"pricing":{"total":200}}','Preventivo','PR-SYNTHETIC-A') returning * into quote_a;
 insert into public.optyker_sheets(client_id,sheet_type,title,data,document_type,reference_code)
 values(customer_a,'eyewear_quote','Synthetic quote B','{"mode":"quote","pricing":{"total":300}}','Preventivo','PR-SYNTHETIC-B');
 insert into public.optyker_sheets(client_id,sheet_type,title,data,document_type,reference_code)
 values(customer_a,'eyewear_job','Synthetic job','{"mode":"job","pricing":{"total":400}}','Busta','BU-SYNTHETIC-A') returning * into job_a;
 insert into public.optyker_sheets(client_id,sheet_type,title,data)
 select customer_a,'prescription','Synthetic clinical '||n,'{"elements":{}}'::jsonb from generate_series(1,4) n;
 insert into public.optyker_sheets(client_id,sheet_type,title,data,document_type)
 values(customer_a,'lac','Synthetic LAC','{"lacState":{"document":"Busta"}}','Busta');
 select md5(jsonb_agg(to_jsonb(sh) order by sh.id)::text) into before_hash from public.optyker_sheets sh;
 payload:=jsonb_build_object('client_id',customer_a);
 result:=public.optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','list',payload);
 assert result->>'ok'='true',result::text;
 assert result->>'client_id'=customer_a::text;
 assert jsonb_array_length(result->'data')=8,'All customer documents must be returned';
 assert (select count(*)=3 from jsonb_array_elements(result->'data') row_data where row_data->>'sheet_type' in ('eyewear_job','eyewear_quote')),'One job and two quotes must be visible';
 assert (select count(*)=2 from jsonb_array_elements(result->'data') row_data where row_data->'is_quote'='true'::jsonb),'Only the two quotes must be marked red';
 assert (select bool_and(row_data->>'client_id'=customer_a::text) from jsonb_array_elements(result->'data') row_data),'Never mix customer records';
 assert (select count(distinct row_data->>'id')=8 from jsonb_array_elements(result->'data') row_data),'No duplicate rows';
 result:=public.optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','list',jsonb_build_object('client_id',customer_b));
 assert result->>'ok'='true' and result->'data'='[]'::jsonb,'An empty customer is not a backend error';
 result:=public.optyker_client_sheet_actions('','','list',payload);assert result->>'ok'='false','Authentication must remain required';
 select md5(jsonb_agg(to_jsonb(sh) order by sh.id)::text) into after_hash from public.optyker_sheets sh;
 assert before_hash=after_hash,'Listing must not change any business record';
 converted:=public.optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','convert',payload||jsonb_build_object('sheet_id',quote_a.id,'confirm',true,'expected_updated_at',quote_a.updated_at));
 assert converted->>'ok'='true',converted::text;
 result:=public.optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','list',payload);
 assert result->>'ok'='true' and jsonb_array_length(result->'data')=9,result::text;
 assert (select row_data#>>'{converted_order,order_sheet_id}'=converted#>>'{data,id}' and row_data->'delete_blocked'='true'::jsonb from jsonb_array_elements(result->'data') row_data where row_data->>'id'=quote_a.id::text),'The quote must show its linked order';
 assert (select row_data#>>'{laboratory_order,status}'='da_fare' and row_data->'delete_blocked'='true'::jsonb from jsonb_array_elements(result->'data') row_data where row_data->>'id'=converted#>>'{data,id}'),'The order must show its laboratory status';
 insert into public.optyker_eyewear_warranty_instances(id,source_sheet_id) values(gen_random_uuid(),job_a.id);
 result:=public.optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','list',payload);
 assert result->>'ok'='true',result::text;
 assert (select row_data->'delete_blocked'='true'::jsonb from jsonb_array_elements(result->'data') row_data where row_data->>'id'=job_a.id::text),'Warranty protection must survive the read fix';
 raise notice 'PASS: authenticated listing, three eyewear documents, two quotes, empty customer, customer isolation, no read mutations, no duplicates, linked order, laboratory status and warranty protection';
end $test$;
rollback;
