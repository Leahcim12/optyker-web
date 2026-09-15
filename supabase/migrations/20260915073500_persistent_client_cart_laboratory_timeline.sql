-- Persistent customer cart + laboratory order timeline (48h work / 10d ready).

create table if not exists public.optyker_client_carts (
  client_id uuid primary key references public.optyker_clients(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  constraint optyker_client_carts_items_array check (jsonb_typeof(items)='array')
);
alter table public.optyker_client_carts enable row level security;
revoke all on table public.optyker_client_carts from public, anon, authenticated;

alter table public.optyker_work_orders
  add column if not exists auto_work_at timestamptz,
  add column if not exists auto_ready_at timestamptz,
  add column if not exists manual_status boolean not null default false,
  add column if not exists manual_status_by text not null default '',
  add column if not exists manual_status_at timestamptz;

update public.optyker_work_orders
set auto_work_at=coalesce(auto_work_at,created_at+interval '48 hours'),
    auto_ready_at=coalesce(auto_ready_at,created_at+interval '10 days'),
    manual_status=case when status='da_fare' then false else true end,
    manual_status_by=case when status='da_fare' then coalesce(manual_status_by,'') else coalesce(nullif(manual_status_by,''),created_by,'') end,
    manual_status_at=case when status='da_fare' then manual_status_at else coalesce(manual_status_at,status_since,updated_at) end
where auto_work_at is null or auto_ready_at is null or (status<>'da_fare' and manual_status=false);

create or replace function optyker_private.money_from_text(p_value text)
returns numeric
language plpgsql
immutable
set search_path='pg_catalog'
as $$
declare s text;
begin
  s:=replace(replace(coalesce(p_value,''),chr(160),''),',','.');
  s:=regexp_replace(s,'[^0-9.\-]','','g');
  if s='' or s='-' or s='.' then return 0; end if;
  begin return round(s::numeric,2); exception when others then return 0; end;
end;
$$;

create or replace function optyker_private.client_cart_add_work_order(p_order_id uuid,p_operator text default '')
returns void
language plpgsql
security invoker
set search_path='public','optyker_private','pg_temp'
as $$
declare
  w public.optyker_work_orders%rowtype;
  s public.optyker_sheets%rowtype;
  v_amount numeric:=0;
  v_title text;
  v_item jsonb;
begin
  select * into w from public.optyker_work_orders where id=p_order_id;
  if not found then return; end if;
  if w.source_sheet_id is not null then select * into s from public.optyker_sheets where id=w.source_sheet_id; end if;
  if w.order_type='eyewear_busta' then
    v_amount:=coalesce(optyker_private.money_from_text(s.data#>>'{pricing,total}'),0);
    v_title:='Occhiale · '||coalesce(nullif(w.reference_code,''),'Busta');
  else
    v_amount:=coalesce(optyker_private.money_from_text(s.data#>>'{lacState,odCost}'),0)+coalesce(optyker_private.money_from_text(s.data#>>'{lacState,osCost}'),0);
    v_title:='Lenti a contatto · '||coalesce(nullif(w.reference_code,''),'Busta');
  end if;
  v_item:=jsonb_build_object(
    'variant_id','client_cart:'||w.id::text,
    'title',v_title,
    'variant_title',coalesce(w.reference_code,''),
    'sku',coalesce(w.reference_code,''),
    'price',round(v_amount,2),
    'list_price',round(v_amount,2),
    'fiscal_vat_code','',
    'fiscal_item_type','goods',
    'quantity',1,
    'department',null,
    'source_work_order_id',w.id,
    'source_sheet_id',w.source_sheet_id,
    'source_type',w.order_type,
    'locked_price',true,
    'created_at',w.created_at
  );
  insert into public.optyker_client_carts(client_id,items,updated_by,updated_at)
  values(w.client_id,jsonb_build_array(v_item),coalesce(nullif(p_operator,''),w.created_by,''),now())
  on conflict(client_id) do update
  set items=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(public.optyker_client_carts.items) x where x->>'variant_id'<>('client_cart:'||w.id::text)) || jsonb_build_array(v_item),
      updated_by=coalesce(nullif(p_operator,''),w.created_by,''),
      updated_at=now();
end;
$$;

create or replace function optyker_private.work_order_insert_defaults()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
begin
  new.auto_work_at:=coalesce(new.auto_work_at,coalesce(new.created_at,now())+interval '48 hours');
  new.auto_ready_at:=coalesce(new.auto_ready_at,coalesce(new.created_at,now())+interval '10 days');
  new.manual_status:=coalesce(new.manual_status,false);
  return new;
end;
$$;

drop trigger if exists optyker_work_orders_insert_defaults on public.optyker_work_orders;
create trigger optyker_work_orders_insert_defaults
before insert on public.optyker_work_orders
for each row execute function optyker_private.work_order_insert_defaults();

create or replace function optyker_private.work_order_add_cart_after_insert()
returns trigger
language plpgsql
security invoker
set search_path='public','optyker_private','pg_temp'
as $$
begin
  perform optyker_private.client_cart_add_work_order(new.id,new.created_by);
  return new;
end;
$$;

drop trigger if exists optyker_work_orders_add_cart on public.optyker_work_orders;
create trigger optyker_work_orders_add_cart
after insert or update of payload,client_id,source_sheet_id on public.optyker_work_orders
for each row execute function optyker_private.work_order_add_cart_after_insert();

create or replace function public.optyker_work_orders_auto_advance()
returns integer
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare n1 integer:=0; n2 integer:=0;
begin
  update public.optyker_work_orders
  set status='costruzione',status_since=now(),updated_at=now()
  where coalesce(manual_status,false)=false
    and status in ('da_fare','in_preparazione')
    and auto_work_at is not null and auto_work_at<=now()
    and (auto_ready_at is null or auto_ready_at>now());
  get diagnostics n1=row_count;
  update public.optyker_work_orders
  set status='pronto_consegna',status_since=now(),updated_at=now()
  where coalesce(manual_status,false)=false
    and status not in ('pronto_consegna','completato','annullato')
    and auto_ready_at is not null and auto_ready_at<=now();
  get diagnostics n2=row_count;
  return n1+n2;
end;
$$;

create or replace function public.optyker_api(p_username text,p_password text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare v_id uuid; v_status text; v_rec public.optyker_work_orders%rowtype;
begin
  if not public.optyker_staff_allowed(p_username,p_password) then return jsonb_build_object('ok',false,'error','Operatore non autorizzato'); end if;
  if p_action='update_work_order_status' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    v_status:=trim(coalesce(p_payload->>'status',''));
    if v_status not in ('da_fare','in_preparazione','costruzione','in_spedizione','pronto_consegna','completato','annullato') then return jsonb_build_object('ok',false,'error','Stato ordine non valido'); end if;
    update public.optyker_work_orders set status=v_status,status_since=now(),updated_at=now(),manual_status=true,manual_status_by=trim(coalesce(p_username,'')),manual_status_at=now() where id=v_id returning * into v_rec;
    if not found then return jsonb_build_object('ok',false,'error','Ordine non trovato'); end if;
    return jsonb_build_object('ok',true,'data',to_jsonb(v_rec));
  end if;
  return public.optyker_api_legacy_passwordless(p_username,'',p_action,p_payload);
end;
$$;

create or replace function public.optyker_eyewear_order_api(p_username text,p_password text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare s public.optyker_sheets%rowtype; w public.optyker_work_orders%rowtype; cid uuid; sid uuid; summary text; snap jsonb;
begin
 if public.optyker_staff_allowed(p_username,p_password) is not true then return jsonb_build_object('ok',false,'error','Operatore non autorizzato'); end if;
 cid:=nullif(p_payload->>'client_id','')::uuid; sid:=nullif(p_payload->>'source_sheet_id','')::uuid;
 if cid is null then raise exception 'Seleziona un cliente prima di ordinare'; end if;
 select * into s from public.optyker_sheets where id=sid and client_id=cid for update;
 if not found then raise exception 'Busta non trovata per il cliente selezionato'; end if;
 if s.sheet_type<>'eyewear_job' or coalesce(s.data->>'mode','')<>'job' then raise exception 'Si possono ordinare solo Buste Occhiali, non preventivi'; end if;
 select * into w from public.optyker_work_orders where source_sheet_id=s.id;
 if p_action='state' then return jsonb_build_object('ok',true,'data',case when w.id is null then null else to_jsonb(w) end); end if;
 if p_action<>'submit' then raise exception 'Azione non riconosciuta'; end if;
 if w.id is not null then perform optyker_private.client_cart_add_work_order(w.id,p_username); return jsonb_build_object('ok',true,'data',to_jsonb(w),'already_sent',true); end if;
 if nullif(p_payload->>'updated_at','')::timestamptz is distinct from s.updated_at then raise exception 'La Busta è stata aggiornata: ricarica prima di inviarla'; end if;
 if nullif(s.reference_code,'') is null then raise exception 'Riferimento Busta mancante'; end if;
 if nullif(s.data#>>'{frame,type}','') is null or nullif(s.data#>>'{lens,lens_type_od}','') is null or nullif(s.data#>>'{lens,lens_type_os}','') is null then raise exception 'Completa montatura e lenti DX/SX nella Busta'; end if;
 snap:=s.data;
 summary:=concat('Montatura: ',concat_ws(' ',snap#>>'{frame,brand}',snap#>>'{frame,model}'),' · DX: ',snap#>>'{lens,lens_type_od}',' · SX: ',snap#>>'{lens,lens_type_os}', ' · Trattamenti: ', coalesce((select string_agg(v,', ') from jsonb_array_elements_text(coalesce(snap#>'{lens,treatments}','[]'::jsonb)) a(v)),'—'));
 insert into public.optyker_work_orders(reference_code,client_id,source_sheet_id,order_type,status,status_since,payload,created_by)
 values(s.reference_code,cid,s.id,'eyewear_busta','da_fare',now(),jsonb_build_object('snapshot',snap,'summary_text',summary,'document','Busta Occhiali','sent_at',now(),'source_updated_at',s.updated_at),p_username)
 returning * into w;
 return jsonb_build_object('ok',true,'data',to_jsonb(w),'already_sent',false);
exception when invalid_text_representation then return jsonb_build_object('ok',false,'error','Riferimenti non validi');
when others then return jsonb_build_object('ok',false,'error',sqlerrm);
end $$;
