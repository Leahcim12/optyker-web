-- Optyker · annotazioni aggiuntive su fatture già create.
-- Le annotazioni sono locali a Optyker: non alterano XML, importi o stato SDI del documento fiscale.

create table if not exists public.optyker_billing_invoice_annotations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.optyker_billing_invoices(id) on delete cascade,
  kind text not null default 'note' check (kind in ('line','note')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by text not null default 'Ottica Visual Care',
  created_at timestamptz not null default now()
);

create index if not exists optyker_billing_invoice_annotations_invoice_idx
  on public.optyker_billing_invoice_annotations (invoice_id, created_at, id);

alter table public.optyker_billing_invoice_annotations enable row level security;
revoke all on table public.optyker_billing_invoice_annotations from anon, authenticated;
