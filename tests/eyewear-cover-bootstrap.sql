-- Disposable test database only; contains no real customer data or credentials.
create extension pgcrypto;
create schema auth;
create role anon;create role authenticated;create role service_role;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table public.optyker_clients(id uuid primary key,name text,surname text,email text);
create table public.optyker_sheets(id uuid primary key,client_id uuid references optyker_clients(id),sheet_type text,data jsonb,reference_code text,reference_no text);
create table public.optyker_chat_messages(id uuid primary key default gen_random_uuid(),client_id uuid references optyker_clients(id),sender_type text,sender_name text,message text,read_by_staff boolean,read_by_customer boolean,created_at timestamptz default now(),attachment_data text,attachment_name text,attachment_type text);
create table public.optyker_eyewear_warranty_instances(id uuid primary key default gen_random_uuid(),source_sheet_id uuid unique references optyker_sheets(id),client_id uuid references optyker_clients(id),starts_on date,created_by text,created_at timestamptz default now());
create table public.optyker_eyewear_warranty_replacements(request_id uuid primary key default gen_random_uuid(),warranty_id uuid references optyker_eyewear_warranty_instances(id),replaced_on date,lens_list_price numeric,discount_percent integer,payable numeric,created_by text,created_at timestamptz default now());
create table public.optyker_eyewear_delivery_archive(id uuid primary key default gen_random_uuid(),sheet_id uuid references optyker_sheets(id),client_id uuid,revision int,reference text,delivery_date date,pdf bytea,pdf_sha256 text);
create function public.optyker_staff_allowed(text,text) returns boolean language sql immutable as $$select $1='Test operator' and $2='synthetic_password_only'$$;
insert into public.optyker_clients values('11111111-1111-4111-8111-111111111111','Cliente','Dimostrativo','test@example.invalid'),('22222222-2222-4222-8222-222222222222','Altro','Cliente','other@example.invalid');
insert into auth.users values('11111111-1111-4111-8111-111111111111','test@example.invalid',now()),('22222222-2222-4222-8222-222222222222','other@example.invalid',now());
insert into public.optyker_sheets(id,client_id,sheet_type,reference_code,data)
select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=6 then '22222222-2222-4222-8222-222222222222' else '11111111-1111-4111-8111-111111111111' end::uuid,'eyewear_job','BU-TEST-'||n,jsonb_build_object('frame',jsonb_build_object('type',case when n in (1,7) then 'Del cliente' else 'Cerchiata' end),'warranty',case when n=3 then 'Silver' when n=4 then 'Gold' else 'Base' end,'notes','PRIVATE NOTE NEVER RETURNED','pricing',jsonb_build_object('confidential_cost',9876)) from generate_series(1,9)n;
insert into public.optyker_eyewear_warranty_instances(source_sheet_id,client_id,starts_on,created_by) select id,client_id,(now() at time zone 'Europe/Rome')::date-interval '3 months','Test operator' from optyker_sheets where reference_code not in ('BU-TEST-5','BU-TEST-9');
insert into public.optyker_eyewear_delivery_archive(sheet_id,client_id,revision,reference,delivery_date,pdf,pdf_sha256) values('10000000-0000-4000-8000-000000000009','11111111-1111-4111-8111-111111111111',1,'BU-TEST-9',(now() at time zone 'Europe/Rome')::date,convert_to('%PDF-1.4 synthetic signed archive used by tests only','utf8'),encode(digest(convert_to('%PDF-1.4 synthetic signed archive used by tests only','utf8'),'sha256'),'hex'));
\i eyewear-cover.sql
