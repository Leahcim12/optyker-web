-- A lost HTTP checkout response must not create a second Shopify order.
create unique index if not exists optyker_pos_sales_checkout_request_unique
on public.optyker_pos_sales ((data->>'checkout_request_id'))
where data->>'checkout_request_id' is not null;

-- Document dates use the Italian cashier timezone, including 00:00–02:00 local.
create or replace function public.optyker_confirm_fiscal_reference(p_job_id uuid,p_number text,p_date date,p_operator text,p_ts_document jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.optyker_fiscal_jobs;
begin
 select * into j from public.optyker_fiscal_jobs where id=p_job_id for update;
 if not found or j.state not in ('awaiting_reference','completed') then raise exception 'Stato documento non confermabile'; end if;
 if j.state='completed' and (j.document_number<>p_number or j.document_date<>p_date) then raise exception 'Riferimento già confermato'; end if;
 if p_number is null or p_number !~ '^[0-9]{4}-[0-9]{4}$' or right(p_number,4)='0000' or p_date is null or p_date>(now() at time zone 'Europe/Rome')::date then raise exception 'Riferimento non valido'; end if;
 if j.operation='void' and (p_date<(j.document#>>'{original,date}')::date or (p_number=j.document#>>'{original,number}' and p_date=(j.document#>>'{original,date}')::date)) then raise exception 'Riporta il nuovo documento di annullo, non lo scontrino originale'; end if;
 update public.optyker_fiscal_jobs set state='completed',document_number=p_number,document_date=p_date,reference_confirmed_by=p_operator,updated_at=now() where id=p_job_id returning * into j;
 if j.operation='void' then
  update public.optyker_ts_outbox set outcome=coalesce(outcome,'{}')||jsonb_build_object('void_document_number',p_number,'void_document_date',p_date),updated_at=now() where job_id=j.original_job_id and state='voided';
  return to_jsonb(j);
 end if;
 if (j.document->>'tsRequested')::boolean then
  if p_ts_document is null then raise exception 'Preparazione TS mancante'; end if;
  insert into public.optyker_ts_outbox(job_id,payment_id,document) values(j.id,j.payment_id,p_ts_document) on conflict(job_id) do nothing;
 end if;
 update public.optyker_ts_documents set status='linked_fiscal_review',provider='optyker_fiscal',document_number=p_number,document_date=p_date,updated_at=now(),
  provider_payload=jsonb_build_object('fiscal_job_id',j.id,'note','Preparazione originaria sostituita dalla revisione delle righe fiscali. Consultare la coda dei documenti RCH; nessun invio TS effettuato.')
 where payment_id=j.payment_id and status in ('awaiting_fiscal_document','opposition_recorded','ready_focus_ts');
 return to_jsonb(j);
end;
$$;
