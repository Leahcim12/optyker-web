\set ON_ERROR_STOP on
-- Only disposable CI PostgreSQL. Never run this fixture in production.
create extension if not exists pgcrypto;
create role anon;create role authenticated;create role service_role;create schema extensions;
create table optyker_clients(id uuid primary key,name text,surname text);
create table optyker_sheets(id uuid primary key default gen_random_uuid(),client_id uuid references optyker_clients(id),sheet_type text,document_type text,data jsonb,updated_at timestamptz default now());
create function optyker_staff_allowed(u text,p text) returns boolean language sql as $$select u='TEST' and p='SYNTHETIC_ONLY'$$;
\i materials-certificate.sql
begin;
do $$
declare cid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();sh optyker_sheets%rowtype;qid uuid:=gen_random_uuid();j jsonb;p jsonb;v jsonb:='{"frame_material":"Acetato","od_material":"Organico","os_material":"Organico","delivery_date":"2026-09-11"}'::jsonb;
begin
 insert into optyker_clients values(cid,'Cliente','TEST'),(other,'Altro','TEST');
 insert into optyker_sheets(client_id,sheet_type,document_type,data) values(cid,'eyewear_job','Busta','{"mode":"job","pricing":{"total":123.45}}') returning * into sh;
 insert into optyker_sheets(id,client_id,sheet_type,document_type,data) values(qid,cid,'eyewear_quote','Preventivo','{"mode":"quote"}');
 p:=jsonb_build_object('client_id',cid,'sheet_id',sh.id);
 j:=optyker_material_certificate_api('','','get',p);assert j->>'ok'='false';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','get',p||jsonb_build_object('client_id',other));assert j->>'ok'='false';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','get',p||jsonb_build_object('sheet_id',qid));assert j->>'ok'='false';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','get',p);assert j->>'ok'='true',j::text;assert j->'certificate'='null'::jsonb;assert (select count(*)=0 from optyker_eyewear_material_certificates),'Get must not insert';
 p:=p||jsonb_build_object('confirm',true,'revision',0,'source_updated_at',sh.updated_at,'values',v);
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p-'confirm');assert j->>'ok'='false';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p);assert j->>'ok'='true',j::text;assert j#>>'{certificate,data,frame_material}'='Acetato';assert j#>>'{certificate,revision}'='1';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p);assert j->>'ok'='false','Optimistic lock';
 p:=p||'{"revision":1}';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p||'{"values":{"od_material":{}}}');assert j->>'ok'='false';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p||'{"values":{"CE":"automatic"}}');assert j->>'ok'='false','Unknown attestations blocked';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p||'{"values":{"delivery_date":"2026-02-31"}}');assert j->>'ok'='false';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p||'{"source_updated_at":"2000-01-01"}');assert j->>'ok'='false';
 j:=optyker_material_certificate_api('TEST','SYNTHETIC_ONLY','save',p);assert j->>'ok'='true',j::text;assert j#>>'{certificate,revision}'='2';
 assert (select count(*)=2 from optyker_eyewear_material_certificate_history);
 assert (select data=sh.data and updated_at=sh.updated_at from optyker_sheets where id=sh.id),'Busta prices and data unchanged';
 assert not has_table_privilege('anon','optyker_eyewear_material_certificates','select');assert not has_table_privilege('authenticated','optyker_eyewear_material_certificates','insert');
 raise notice 'PASS: authentication, client scope, job-only, get/save/reopen, revisions, stale source, input validation, unchanged busta and restricted storage';
end $$;
rollback;
