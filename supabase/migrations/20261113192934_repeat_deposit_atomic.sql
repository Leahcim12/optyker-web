-- An additional deposit updates the existing sale and ledger together.
-- Only the authenticated Edge Function's service role may invoke this function.
create or replace function public.optyker_repeat_deposit(p_sale uuid,p_request uuid,p_operator text,p_amount numeric,p_expected_paid numeric,p_method text,p_snapshot jsonb,p_note text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s public.optyker_pos_sales%rowtype; p public.optyker_pos_payments%rowtype;
begin
 select * into s from public.optyker_pos_sales where id=p_sale for update;
 if not found then raise exception 'Vendita non trovata'; end if;
 select * into p from public.optyker_pos_payments where id=p_request;
 if found then
  if p.sale_id<>p_sale or p.amount<>p_amount or p.payment_method<>p_method then raise exception 'Richiesta acconto già usata con dati diversi: verifica gli incassi'; end if;
  return jsonb_build_object('sale',to_jsonb(s),'payment',to_jsonb(p),'recovered',true);
 end if;
 if p_request is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=s.due_amount then raise exception 'Acconto non valido: deve essere inferiore al residuo'; end if;
 if p_expected_paid is null or s.paid_amount<>p_expected_paid or s.paid_amount+s.due_amount<>s.total or s.delivered_at is not null or s.status<>'open_balance' then raise exception 'La vendita è cambiata: aggiorna gli acconti prima di procedere'; end if;
 if p_method not in ('cash','card','bank','alma','pagodil','pagolight') then raise exception 'Metodo di pagamento non valido'; end if;
 if p_snapshot is null or (p_snapshot->>'totalCents')::numeric<>p_amount*100 then raise exception 'Documento fiscale acconto non valido'; end if;
 insert into public.optyker_pos_payments(id,sale_id,client_id,operator_username,payment_stage,payment_method,amount,currency,invoice_requested,note,data)
 values(p_request,s.id,s.client_id,p_operator,'deposit',p_method,p_amount,'EUR',false,coalesce(p_note,''),jsonb_build_object('source','optyker_pos','shopify_order_id',coalesce(s.shopify_order_id,''),'shopify_order_name',coalesce(s.shopify_order_name,''),'fiscal_snapshot',p_snapshot,'repeat_deposit',true)) returning * into p;
 update public.optyker_pos_sales set paid_amount=paid_amount+p_amount,due_amount=due_amount-p_amount,payment_stage='deposit',payment_method=p_method,payment_status='partially_paid',status='open_balance',updated_at=now() where id=s.id returning * into s;
 return jsonb_build_object('sale',to_jsonb(s),'payment',to_jsonb(p),'recovered',false);
end $$;
revoke all on function public.optyker_repeat_deposit(uuid,uuid,text,numeric,numeric,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.optyker_repeat_deposit(uuid,uuid,text,numeric,numeric,text,jsonb,text) to service_role;
