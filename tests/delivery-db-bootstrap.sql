create extension pgcrypto;
create role anon;
create role authenticated;
create role service_role;
create table public.optyker_clients(id uuid primary key,name text,surname text,fiscal text,street text,street_number text,postal_code text,city text,province text);
create table public.optyker_sheets(id uuid primary key,client_id uuid references optyker_clients(id),sheet_type text,document_type text,data jsonb,reference_code text,reference_no text,updated_at timestamptz default now());
create table public.optyker_eyewear_material_certificates(sheet_id uuid primary key,client_id uuid,data jsonb,revision bigint);
-- Synthetic authentication exclusively inside disposable CI PostgreSQL.
create function public.optyker_staff_allowed(text,text) returns boolean language sql immutable as $$select $1='Michael Mologni' and $2='SYNTHETIC_PASSWORD_NOT_REAL'$$;
\i eyewear-delivery.sql
insert into optyker_clients values('11111111-1111-4111-8111-111111111111','Cliente','Dimostrativo','IDENTIFICATIVO DI PROVA','Via Esempio','1','00000','Città','XX');
insert into optyker_clients values('22222222-2222-4222-8222-222222222222','Altro','Cliente','ALTRO',null,null,null,null,null);
insert into optyker_sheets(id,client_id,sheet_type,document_type,data,reference_code) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','eyewear_job','Busta','{"mode":"job","frame":{"type":"Cerchiata","brand":"Marca esempio","model":"Modello esempio"},"lens":{"lens_type_od":"Monofocale","lens_type_os":"Monofocale","lens_od":{"material":"Organico","lens_name":"Lente esempio"},"lens_os":{"material":"Organico","lens_name":"Lente esempio"}},"pricing":{"total":987.65},"notes":"NOTA INTERNA RISERVATA"}','BU-OC-ESEMPIO');
insert into optyker_sheets(id,client_id,sheet_type,document_type,data,reference_code) values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','eyewear_quote','Preventivo','{"mode":"quote"}','PR-OC-ESEMPIO');
