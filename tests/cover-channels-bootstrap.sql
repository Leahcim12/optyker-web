-- CI ONLY. Separate disposable database; no real credentials or customer records.
\i tests/eyewear-cover-bootstrap.sql
alter table public.optyker_clients add customer_portal_token text;
alter table public.optyker_sheets add title text;
alter table public.optyker_sheets add created_at timestamptz default now();
alter table public.optyker_sheets add updated_at timestamptz default now();
update public.optyker_clients set customer_portal_token=case when email='test@example.invalid' then repeat('a',48) else repeat('b',48) end;
create or replace function public.optyker_staff_allowed(text,text) returns boolean language sql immutable as $$select $1 in ('Test operator','Michael Mologni') and $2='synthetic_password_only'$$;
insert into public.optyker_sheets(id,client_id,sheet_type,reference_code,data)
select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111','eyewear_job','BU-TEST-'||n,jsonb_build_object('frame',jsonb_build_object('type',case when n=10 then 'Del cliente' else 'Cerchiata' end,'brand','Montatura dimostrativa'),'lens',jsonb_build_object('lens_type_od','Monofocale','lens_type_os','Monofocale'),'warranty',case when n in (13,16) then 'Silver' else 'Base' end,'notes','PRIVATE NOTE NEVER RETURNED','pricing',jsonb_build_object('confidential_cost',9876)) from generate_series(10,20)n;
insert into public.optyker_eyewear_warranty_instances(source_sheet_id,client_id,starts_on,created_by) select id,client_id,(now() at time zone 'Europe/Rome')::date-interval '3 months','Test operator' from optyker_sheets where reference_code in ('BU-TEST-10','BU-TEST-11','BU-TEST-12','BU-TEST-13','BU-TEST-14','BU-TEST-15','BU-TEST-16','BU-TEST-17','BU-TEST-18','BU-TEST-19','BU-TEST-20');
\i eyewear-cover-channels.sql
