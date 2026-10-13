-- Ufficio: file dei cedolini nel database.
-- Il progetto ha raggiunto il numero massimo di Edge Functions, quindi i cedolini non passano dallo
-- Storage ma da una RPC (optyker_office_api): il file è in una tabella separata, mai letta dagli elenchi.

-- storage_path resta per compatibilità ma non è più usato (sempre NULL).
alter table public.optyker_payslips alter column storage_path drop not null;
comment on column public.optyker_payslips.storage_path is 'Non usato: il file è in optyker_payslip_files.';
comment on table public.optyker_payslips is
  'Cedolini degli operatori (metadati). Il file è in optyker_payslip_files; accesso solo tramite optyker_office_api.';

create table if not exists public.optyker_payslip_files (
  payslip_id uuid primary key references public.optyker_payslips(id) on delete cascade,
  content bytea not null
);
alter table public.optyker_payslip_files enable row level security;
revoke all on table public.optyker_payslip_files from anon, authenticated;
grant select, insert, update, delete on table public.optyker_payslip_files to service_role;

create or replace function optyker_private.office_payslips_json(p_username text)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'year', p.period_year,
           'month', p.period_month,
           'title', p.title,
           'file_name', p.file_name,
           'mime_type', p.mime_type,
           'size_bytes', p.size_bytes,
           'created_at', p.created_at)
         order by p.period_year desc, p.period_month desc, p.created_at desc), '[]'::jsonb)
    from public.optyker_payslips p
   where upper(regexp_replace(btrim(p.operator_username), '\s+', ' ', 'g'))
       = upper(regexp_replace(btrim(coalesce(p_username, '')), '\s+', ' ', 'g'))
$$;

revoke all on function optyker_private.office_payslips_json(text) from public, anon, authenticated;
