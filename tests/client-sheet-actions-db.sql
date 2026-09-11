\set ON_ERROR_STOP on
-- Runs ONLY on the disposable PostgreSQL service in CI, never against Supabase.
create extension if not exists pgcrypto;
create role anon;create role authenticated;create role service_role;
create schema extensions;
create table public.optyker_clients(id uuid primary key);
create table public.optyker_sheets(id uuid primary key default gen_random_uuid(),client_id uuid references optyker_clients(id),sheet_type text,title text,operator text,data jsonb,reference_code text,reference_no text,document_type text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.optyker_work_orders(id uuid primary key default gen_random_uuid(),reference_code text unique,client_id uuid,source_sheet_id uuid unique references optyker_sheets(id) on delete set null,order_type text,status text,status_since timestamptz,payload jsonb,created_by text);
create table public.optyker_eyewear_warranty_instances(id uuid primary key,source_sheet_id uuid references optyker_sheets(id));
create sequence refs;
create function public.optyker_staff_allowed(u text,p text) returns boolean language sql as $$select u='TEST_OPERATOR' and p='SYNTHETIC_TEST_ONLY'$$;
create function public.optyker_next_eyewear_reference(k text) returns text language sql as $$select 'BU-OC-TEST-'||nextval('refs')$$;
create function public.optyker_next_reference(k text,t timestamptz) returns text language sql as $$select nextval('refs')||k||'26'$$;
\i client-sheet-actions.sql
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();s optyker_sheets%rowtype;clinical optyker_sheets%rowtype;lac optyker_sheets%rowtype;j jsonb;k jsonb;payload jsonb;original jsonb;before_s integer;before_w integer;
begin
 insert into optyker_clients values(a),(b);
 insert into optyker_sheets(client_id,sheet_type,title,operator,data,document_type,reference_code) values(a,'eyewear_quote','Test quote','TEST','{"mode":"quote","sheetType":"eyewear_quote","documentType":"Preventivo","frame":{"type":"Cerchiata","brand":"TEST"},"lens":{"lens_type_od":"Monofocale","lens_type_os":"Monofocale"},"pricing":{"total":222.55},"notes":"unchanged"}','Preventivo','PR-TEST') returning * into s;
 original:=s.data;payload:=jsonb_build_object('client_id',a,'sheet_id',s.id,'confirm',true,'expected_updated_at',s.updated_at);
 j:=optyker_client_sheet_actions('','', 'list',payload);assert j->>'ok'='false','Authentication required';
 j:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','get',payload||jsonb_build_object('client_id',b));assert j->>'ok'='false','Wrong customer blocked';
 j:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','convert',payload-'confirm');assert j->>'ok'='false','Confirmation required';
 j:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','convert',payload||jsonb_build_object('expected_updated_at','2000-01-01'));assert j->>'ok'='false','Stale snapshot blocked';
 j:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','convert',payload);assert j->>'ok'='true',j::text;assert j#>>'{order,status}'='da_fare';assert j#>>'{data,data,pricing,total}'='222.55';assert (select data=original from optyker_sheets where id=s.id),'Original preserved';
 k:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','convert',payload);assert k->>'already_converted'='true';assert k#>>'{order,id}'=j#>>'{order,id}','Idempotency';assert (select count(*)=1 from optyker_quote_order_links);
 k:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','delete',payload);assert k->>'ok'='false','Converted quote protected';
 begin delete from optyker_sheets where id=(j#>>'{data,id}')::uuid;raise exception 'Unexpected delete of linked order';exception when raise_exception then assert sqlerrm like 'Scheda collegata%';end;
 insert into optyker_sheets(client_id,sheet_type,title,data) values(a,'prescription','Test clinical','{"elements":{"test":{"value":"1"}}}') returning * into clinical;
 payload:=jsonb_build_object('client_id',a,'sheet_id',clinical.id,'confirm',true,'expected_updated_at',clinical.updated_at);
 j:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','delete',payload);assert j->>'ok'='true',j::text;assert not exists(select 1 from optyker_sheets where id=clinical.id);assert exists(select 1 from optyker_sheet_trash where sheet_id=clinical.id and snapshot->'data'=clinical.data and deleted_by='TEST_OPERATOR');
 k:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','delete',payload);assert k->>'already_deleted'='true';
 insert into optyker_sheets(client_id,sheet_type,title,data,document_type,reference_code) values(a,'lac','Test LAC','{"sheetType":"lac","lacState":{"document":"Preventivo","brand":"TEST","odProductName":"Ortok","odCost":700},"elements":{"lacReference":{"kind":"value","value":"1P26"}},"documentReference":"1P26"}','Preventivo','1P26') returning * into lac;
 payload:=jsonb_build_object('client_id',a,'sheet_id',lac.id,'confirm',true,'expected_updated_at',lac.updated_at);
 j:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','convert',payload);assert j->>'ok'='true',j::text;assert j#>>'{order,order_type}'='lac_busta';assert j#>>'{data,data,lacState,document}'='Busta';assert j#>>'{data,data,documentReference}'=j#>>'{order,reference_code}';assert j#>>'{data,data,elements,lacReference,value}'=j#>>'{order,reference_code}';assert j#>>'{data,data,lacState,odCost}'='700';
 select count(*) into before_s from optyker_sheets;select count(*) into before_w from optyker_work_orders;
 -- Invalid quotes create neither a busta nor a work order.
 update optyker_sheets set data=data-'lens' where id=s.id;
 delete from optyker_quote_order_links where quote_id=s.id;
 payload:=jsonb_build_object('client_id',a,'sheet_id',s.id,'confirm',true,'expected_updated_at',s.updated_at);
 j:=optyker_client_sheet_actions('TEST_OPERATOR','SYNTHETIC_TEST_ONLY','convert',payload);assert j->>'ok'='false';assert (select count(*)=before_s from optyker_sheets);assert (select count(*)=before_w from optyker_work_orders);
 assert not has_table_privilege('anon','optyker_sheet_trash','select');assert not has_table_privilege('anon','optyker_quote_order_links','insert');
 raise notice 'PASS: auth, customer scope, confirmations, stale-write checks, idempotency, immutable quotes, laboratory orders, protected deletes, recovery copy, LAC references, rollback and RLS';
end $$;
rollback;
