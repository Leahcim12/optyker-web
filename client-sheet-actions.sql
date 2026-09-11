-- Client sheet actions: no business rows are modified when this migration runs.
create table if not exists public.optyker_sheet_trash (
 sheet_id uuid primary key, client_id uuid not null,
 snapshot jsonb not null, deleted_by text not null, deleted_at timestamptz not null default now()
);
create index if not exists optyker_sheet_trash_client_idx on public.optyker_sheet_trash(client_id);
create table if not exists public.optyker_quote_order_links (
 quote_id uuid primary key references public.optyker_sheets(id),
 order_sheet_id uuid not null unique references public.optyker_sheets(id),
 work_order_id uuid not null unique references public.optyker_work_orders(id),
 client_id uuid not null references public.optyker_clients(id),
 created_by text not null, created_at timestamptz not null default now()
);
create index if not exists optyker_quote_order_client_idx on public.optyker_quote_order_links(client_id);
alter table public.optyker_sheet_trash enable row level security;
alter table public.optyker_quote_order_links enable row level security;
revoke all on public.optyker_sheet_trash,public.optyker_quote_order_links from public,anon,authenticated;
grant select,insert,update,delete on public.optyker_sheet_trash,public.optyker_quote_order_links to service_role;

create or replace function public.optyker_sheet_is_quote(s public.optyker_sheets)
returns boolean language sql immutable set search_path=pg_catalog as $$
 select coalesce(s.sheet_type in ('eyewear_quote','eyewear_quote_v1') or
 lower(coalesce(nullif(s.document_type,''),s.data->>'documentType',s.data#>>'{lacState,document}',''))='preventivo',false)
$$;
-- Guard also applies to old UI delete paths: preserve a recovery copy and linked orders.
create or replace function public.optyker_sheet_delete_guard()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin
 if exists(select 1 from public.optyker_work_orders where source_sheet_id=old.id)
  or exists(select 1 from public.optyker_quote_order_links where quote_id=old.id or order_sheet_id=old.id)
  or exists(select 1 from public.optyker_eyewear_warranty_instances where source_sheet_id=old.id) then
  raise exception 'Scheda collegata a un ordine o a una garanzia: eliminazione bloccata per preservare lo storico';
 end if;
 if old.client_id is not null then
  insert into public.optyker_sheet_trash(sheet_id,client_id,snapshot,deleted_by)
   values(old.id,old.client_id,to_jsonb(old),coalesce(nullif(current_setting('optyker.sheet_actor',true),''),'gestione precedente'))
   on conflict(sheet_id) do nothing;
 end if;
 return old;
end $$;
drop trigger if exists optyker_sheet_delete_guard on public.optyker_sheets;
create trigger optyker_sheet_delete_guard before delete on public.optyker_sheets for each row execute function public.optyker_sheet_delete_guard();
revoke all on function public.optyker_sheet_delete_guard() from public,anon,authenticated;

create or replace function public.optyker_client_sheet_actions(p_username text,p_password text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
 cid uuid; sid uuid; s public.optyker_sheets%rowtype; dest public.optyker_sheets%rowtype;
 w public.optyker_work_orders%rowtype; link public.optyker_quote_order_links%rowtype;
 rows jsonb; snap jsonb; ref text; typ text; summ text; is_eye boolean; amount numeric;
begin
 if public.optyker_staff_allowed(p_username,p_password) is not true then
  return jsonb_build_object('ok',false,'error','Operatore non autorizzato');
 end if;
 cid:=nullif(p_payload->>'client_id','')::uuid;
 if cid is null or not exists(select 1 from public.optyker_clients where id=cid) then raise exception 'Seleziona un cliente valido'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(x order by x.created_at desc,x.id),'[]'::jsonb) into rows from (
   select s.*,public.optyker_sheet_is_quote(s) as is_quote,
    case when l.quote_id is not null then jsonb_build_object('order_sheet_id',l.order_sheet_id,'work_order_id',l.work_order_id,'reference',ow.reference_code,'status',ow.status) else null end as converted_order,
    case when sw.id is not null then jsonb_build_object('id',sw.id,'reference',sw.reference_code,'status',sw.status) else null end as laboratory_order,
    (sw.id is not null or l.quote_id is not null or exists(select 1 from public.optyker_eyewear_warranty_instances wi where wi.source_sheet_id=s.id)) as delete_blocked
   from public.optyker_sheets s
   left join public.optyker_quote_order_links l on l.quote_id=s.id
   left join public.optyker_work_orders ow on ow.id=l.work_order_id
   left join public.optyker_work_orders sw on sw.source_sheet_id=s.id
   where s.client_id=cid order by s.created_at desc,s.id
  )x;
  return jsonb_build_object('ok',true,'client_id',cid,'data',rows);
 end if;
 sid:=nullif(p_payload->>'sheet_id','')::uuid;
 select * into s from public.optyker_sheets where id=sid and client_id=cid for update;
 if not found then
  if p_action='delete' and exists(select 1 from public.optyker_sheet_trash where sheet_id=sid and client_id=cid) then return jsonb_build_object('ok',true,'already_deleted',true); end if;
  raise exception 'Scheda non disponibile per il cliente selezionato';
 end if;
 if p_action='get' then return jsonb_build_object('ok',true,'client_id',cid,'data',to_jsonb(s)); end if;
 if p_action not in ('delete','convert') then raise exception 'Azione non riconosciuta'; end if;
 if p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Conferma esplicita richiesta'; end if;
 -- Repeated conversion requests return the same order, even after a later source update.
 if p_action='convert' then
  select * into link from public.optyker_quote_order_links where quote_id=s.id;
  if found then
   select * into dest from public.optyker_sheets where id=link.order_sheet_id;
   select * into w from public.optyker_work_orders where id=link.work_order_id;
   return jsonb_build_object('ok',true,'data',to_jsonb(dest),'order',to_jsonb(w),'already_converted',true);
  end if;
 end if;
 if nullif(p_payload->>'expected_updated_at','')::timestamptz is distinct from s.updated_at then raise exception 'La scheda è stata modificata: ricarica prima di continuare'; end if;
 if p_action='delete' then
  perform set_config('optyker.sheet_actor',p_username,true);
  delete from public.optyker_sheets where id=s.id;
  return jsonb_build_object('ok',true,'sheet_id',s.id,'recoverable_copy',true);
 end if;
 if not public.optyker_sheet_is_quote(s) then raise exception 'Solo un preventivo può essere trasformato in ordine'; end if;
 is_eye:=s.sheet_type in ('eyewear_quote','eyewear_quote_v1');
 if not is_eye and s.sheet_type<>'lac' then raise exception 'Conversione disponibile per preventivi Occhiali e LAC'; end if;
 snap:=s.data;
 if is_eye then
  if nullif(snap#>>'{frame,type}','') is null or nullif(snap#>>'{lens,lens_type_od}','') is null or nullif(snap#>>'{lens,lens_type_os}','') is null then raise exception 'Completa prima montatura e lenti DX/SX nel preventivo'; end if;
  amount:=nullif(snap#>>'{pricing,total}','')::numeric;
  if amount is null or amount<0 or amount='NaN'::numeric then raise exception 'Totale del preventivo non valido'; end if;
  ref:=public.optyker_next_eyewear_reference('job'); typ:='eyewear_job';
  snap:=snap||jsonb_build_object('mode','job','sheetType',typ,'documentType','Busta','reference_code',ref);
  summ:=concat('Montatura: ',concat_ws(' ',snap#>>'{frame,brand}',snap#>>'{frame,model}'),' · DX: ',snap#>>'{lens,lens_type_od}',' · SX: ',snap#>>'{lens,lens_type_os}');
 else
  if coalesce(nullif(snap#>>'{lacState,odProductName}',''),nullif(snap#>>'{lacState,osProductName}','')) is null then raise exception 'Completa almeno una lente nel preventivo LAC prima di ordinare'; end if;
  ref:=public.optyker_next_reference('B',now());typ:='lac';
  snap:=snap||jsonb_build_object('documentType','Busta','document','Busta','sheetLabel','Busta LAC','reference_code',ref,'referenceCode',ref,'documentReference',ref);
  snap:=jsonb_set(snap,'{lacState}',coalesce(snap->'lacState','{}'::jsonb)||jsonb_build_object('document','Busta'),true);
  snap:=jsonb_set(snap,'{elements}',coalesce(snap->'elements','{}'::jsonb)||jsonb_build_object('lacReference',jsonb_build_object('kind','value','value',ref)),true);
  summ:=concat('LAC · ',snap#>>'{lacState,brand}',' · OD: ',snap#>>'{lacState,odProductName}',' · OS: ',snap#>>'{lacState,osProductName}');
 end if;
 snap:=snap||jsonb_build_object('source_quote_id',s.id,'source_quote_reference',coalesce(s.reference_code,s.reference_no),'converted_at',now(),'savedAt',now(),'client_id',cid);
 insert into public.optyker_sheets(client_id,sheet_type,title,operator,data,reference_code,reference_no,document_type)
 values(cid,typ,case when is_eye then 'Busta occhiali' else 'Busta LAC' end||' · '||ref,p_username,snap,ref,ref,'Busta') returning * into dest;
 insert into public.optyker_work_orders(reference_code,client_id,source_sheet_id,order_type,status,status_since,payload,created_by)
 values(ref,cid,dest.id,case when is_eye then 'eyewear_busta' else 'lac_busta' end,'da_fare',now(),
 jsonb_build_object('snapshot',dest.data,'summary_text',summ,'document','Busta','source_quote_id',s.id,'source_quote_reference',coalesce(s.reference_code,s.reference_no),'sent_at',now(),'source_updated_at',dest.updated_at),p_username) returning * into w;
 insert into public.optyker_quote_order_links(quote_id,order_sheet_id,work_order_id,client_id,created_by) values(s.id,dest.id,w.id,cid,p_username);
 return jsonb_build_object('ok',true,'data',to_jsonb(dest),'order',to_jsonb(w),'already_converted',false);
exception when invalid_text_representation or invalid_datetime_format then return jsonb_build_object('ok',false,'error','Dati della richiesta non validi');
 when foreign_key_violation then return jsonb_build_object('ok',false,'error','Scheda collegata ad altri documenti: eliminazione non consentita');
 when others then return jsonb_build_object('ok',false,'error',sqlerrm);
end $$;
revoke all on function public.optyker_client_sheet_actions(text,text,text,jsonb) from public;
grant execute on function public.optyker_client_sheet_actions(text,text,text,jsonb) to anon,authenticated,service_role;
revoke all on function public.optyker_sheet_is_quote(public.optyker_sheets) from public,anon,authenticated;
grant execute on function public.optyker_sheet_is_quote(public.optyker_sheets) to service_role;
