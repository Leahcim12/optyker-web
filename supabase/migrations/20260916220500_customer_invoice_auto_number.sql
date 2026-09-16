create or replace function optyker_private.customer_invoice_number_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, optyker_private
as $$
declare
  v_year integer;
  v_series public.optyker_fic_series%rowtype;
  v_next integer;
begin
  if new.direction <> 'outgoing' or lower(coalesce(new.supplier_type,'')) <> 'cliente' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and nullif(btrim(coalesce(old.invoice_number,'')),'') is not null
     and new.invoice_number is distinct from old.invoice_number then
    raise exception 'Il numero di una fattura cliente gia assegnato non puo essere modificato';
  end if;

  if new.issue_date is null then
    new.issue_date := current_date;
  end if;

  if nullif(btrim(coalesce(new.invoice_number,'')),'') is null then
    v_year := extract(year from new.issue_date)::integer;

    select * into v_series
    from public.optyker_fic_series
    where code = 'retail' and year = v_year
    for update;

    if not found then
      raise exception 'Serie fatture clienti non configurata per l anno %', v_year;
    end if;

    v_next := coalesce(v_series.last_number,0) + 1;

    update public.optyker_fic_series
       set last_number = v_next,
           last_date = case
             when last_date is null then new.issue_date
             when new.issue_date > last_date then new.issue_date
             else last_date
           end
     where code = 'retail' and year = v_year;

    new.invoice_number := v_next::text || coalesce(v_series.suffix, '/' || right(v_year::text,2));
  end if;

  new.sdi_status := 'not_applicable';
  if coalesce(new.provider_status,'') in ('', 'pending_fic_review') then
    new.provider_status := 'customer_invoice_internal';
  end if;
  new.provider_payload := coalesce(new.provider_payload,'{}'::jsonb)
    || jsonb_build_object(
      'document_scope','customer_no_sdi',
      'electronic_invoice',false,
      'invoice_series','retail'
    );

  return new;
end;
$$;

drop trigger if exists optyker_customer_invoice_auto_number on public.optyker_billing_invoices;
create trigger optyker_customer_invoice_auto_number
before insert or update on public.optyker_billing_invoices
for each row
execute function optyker_private.customer_invoice_number_before_write();

do $$
declare
  r record;
begin
  for r in
    select id
    from public.optyker_billing_invoices
    where direction='outgoing'
      and lower(coalesce(supplier_type,''))='cliente'
      and nullif(btrim(coalesce(invoice_number,'')),'') is null
    order by issue_date nulls last, created_at, id
  loop
    update public.optyker_billing_invoices
       set invoice_number = invoice_number
     where id = r.id;
  end loop;
end;
$$;
