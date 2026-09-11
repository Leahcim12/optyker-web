-- Commercial eyewear cover requested by OVC. No existing sales or warranties are rewritten.
create table if not exists public.optyker_eyewear_claims(
 id uuid primary key, client_id uuid not null references public.optyker_clients(id),
 sheet_id uuid not null references public.optyker_sheets(id),
 reason text not null check(reason in ('scratched_lens','broken_frame','right_temple','left_temple','loss')),
 eye text not null default '' check(eye in ('','OD','OS','entrambi')),
 tier text not null, discount_percent integer not null check(discount_percent in (25,50,100)),
 starts_on date not null, status text not null default 'pending' check(status in ('pending','fulfilled','rejected')),
 evidence_message_id uuid references public.optyker_chat_messages(id),
 message_id uuid references public.optyker_chat_messages(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), changed_by text
);
create index if not exists optyker_eyewear_claims_sheet_idx on public.optyker_eyewear_claims(sheet_id,status,reason);
create index if not exists optyker_eyewear_claims_client_idx on public.optyker_eyewear_claims(client_id,created_at desc);
create table if not exists public.optyker_eyewear_claim_reports(
 id uuid primary key references public.optyker_chat_messages(id),
 client_id uuid not null references public.optyker_clients(id),
 sheet_id uuid not null references public.optyker_sheets(id), created_at timestamptz not null default now()
);
create index if not exists optyker_eyewear_claim_reports_sheet_idx on public.optyker_eyewear_claim_reports(sheet_id,created_at desc);
create table if not exists public.optyker_eyewear_claim_audit(
 id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.optyker_eyewear_claims(id),
 actor text not null, old_status text, new_status text not null, created_at timestamptz not null default now()
);
alter table public.optyker_eyewear_claims enable row level security;
alter table public.optyker_eyewear_claim_reports enable row level security;
alter table public.optyker_eyewear_claim_audit enable row level security;
revoke all on public.optyker_eyewear_claims,public.optyker_eyewear_claim_reports,public.optyker_eyewear_claim_audit from public,anon,authenticated;
grant select,insert,update on public.optyker_eyewear_claims to service_role;
grant select,insert on public.optyker_eyewear_claim_reports,public.optyker_eyewear_claim_audit to service_role;

create or replace function public.optyker_eyewear_cover_rules(p_data jsonb,p_start date,p_on date)
returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare tier text; names text; rules jsonb; arr jsonb:='[]'; item jsonb; yr integer; pct integer;
begin
 tier:=lower(trim(coalesce(nullif(p_data->>'warranty',''),p_data#>>'{warranty_pricing,name}','Base')));
 if lower(replace(trim(coalesce(p_data#>>'{frame,type}','')),'_',' '))='del cliente' or tier in ('base solo lenti','base_solo_lenti') then tier:='base_solo_lenti'; end if;
 if tier in ('base','base_solo_lenti') then
  rules:='[{"reason":"scratched_lens","label":"Lente graffiata","year1":50,"year2":25,"max_total":2,"terms":"Sconto del 50% nel primo anno e del 25% nel secondo. Massimo 2 ricambi complessivi in 24 mesi."}]';
  if tier='base' then rules:=rules||'[{"reason":"broken_frame","label":"Montatura rotta","year1":50,"year2":null,"terms":"Sconto del 50% nel primo anno."},{"reason":"right_temple","label":"Asta DX rotta","year1":100,"year2":100,"terms":"Sostituzione in omaggio entro 24 mesi."},{"reason":"left_temple","label":"Asta SX rotta","year1":100,"year2":100,"terms":"Sostituzione in omaggio entro 24 mesi."}]'::jsonb; end if;
 elsif tier in ('silver','gold') then
  rules:='[{"reason":"broken_frame","label":"Montatura rotta","year1":100,"year2":50,"terms":"Sostituzione in omaggio nel primo anno; sconto del 50% nel secondo."},{"reason":"right_temple","label":"Asta DX rotta","year1":100,"year2":100,"terms":"Sostituzione in omaggio entro 24 mesi."},{"reason":"left_temple","label":"Asta SX rotta","year1":100,"year2":100,"terms":"Sostituzione in omaggio entro 24 mesi."},{"reason":"loss","label":"Smarrimento occhiale","year1":50,"year2":50,"requires_report":true,"terms":"Sostituzione dell’occhiale con sconto del 50% entro 24 mesi. Inoltra la denuncia in chat; il documento deve essere verificato dall’ottica."}]';
 else rules:='[]'; tier:='da_verificare'; end if;
 names:=case tier when 'base_solo_lenti' then 'Base solo lenti' when 'base' then 'Base' when 'silver' then 'Silver' when 'gold' then 'Gold' else 'Da verificare' end;
 yr:=case when p_start is null or p_on<p_start then 0 when p_on<(p_start+interval '1 year')::date then 1 when p_on<(p_start+interval '2 years')::date then 2 else 3 end;
 for item in select value from jsonb_array_elements(rules) loop
  pct:=case yr when 1 then (item->>'year1')::integer when 2 then (item->>'year2')::integer else null end;
  arr:=arr||jsonb_build_array(item||jsonb_build_object('discount_percent',pct,'eligible',pct is not null));
 end loop;
 return jsonb_build_object('tier',tier,'name',names,'version','20260912-eyewear-cover1','starts_on',p_start,'ends_before',(p_start+interval '2 years')::date,'year',yr,
  'state',case when p_start is null then 'pending_activation' when yr=0 then 'not_started' when yr=3 then 'expired' else 'active' end,'benefits',arr);
end $$;
revoke all on function public.optyker_eyewear_cover_rules(jsonb,date,date) from public,anon,authenticated;
grant execute on function public.optyker_eyewear_cover_rules(jsonb,date,date) to service_role;

create or replace function public.optyker_eyewear_cover_core(p_client_id uuid,p_action text,p_payload jsonb,p_operator text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare doc public.optyker_sheets%rowtype; req public.optyker_eyewear_claims%rowtype;
 sid uuid; rid uuid; evidence uuid; mid uuid; started date; asof date:=(now() at time zone 'Europe/Rome')::date;
 cover jsonb; benefit jsonb; v_reason text; v_eye text; used integer; pending integer; old_used integer; cname text; result jsonb; target text;
begin
 sid:=nullif(p_payload->>'sheet_id','')::uuid;
 select * into doc from public.optyker_sheets sh where sh.id=sid and sh.client_id=p_client_id and sh.sheet_type in ('eyewear_job','eyewear_job_v1');
 if not found then raise exception 'Busta Occhiali non disponibile per questo cliente'; end if;
 -- Same lock as the pre-existing Base solo lenti replacement API; no parallel quota bypass.
 if p_action<>'get' and p_action<>'certificate' then
  perform pg_advisory_xact_lock(hashtextextended('own-frame-warranty:'||sid::text,0));
 end if;
 select wi.starts_on into started from public.optyker_eyewear_warranty_instances wi where wi.source_sheet_id=sid and wi.client_id=p_client_id;
 if started is null then select min(da.delivery_date) into started from public.optyker_eyewear_delivery_archive da where da.sheet_id=sid and da.client_id=p_client_id; end if;
 if p_action='activate' then
  if p_operator is null or p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Conferma dell’operatore richiesta'; end if;
  if started is not null then raise exception 'Garanzia già attiva: la decorrenza non può essere spostata'; end if;
  started:=nullif(p_payload->>'starts_on','')::date;
  if started is null or started>asof or started<date '2000-01-01' then raise exception 'Inserisci la data effettiva di consegna, non futura'; end if;
  insert into public.optyker_eyewear_warranty_instances(source_sheet_id,client_id,starts_on,created_by) values(sid,p_client_id,started,p_operator);
 end if;
 cover:=public.optyker_eyewear_cover_rules(doc.data,started,asof);
 select count(*) into old_used from public.optyker_eyewear_warranty_replacements r join public.optyker_eyewear_warranty_instances wi on wi.id=r.warranty_id where wi.source_sheet_id=sid;
 select count(*) filter(where cl.status='fulfilled'),count(*) filter(where cl.status='pending') into used,pending from public.optyker_eyewear_claims cl where cl.sheet_id=sid and cl.reason='scratched_lens';
 cover:=cover||jsonb_build_object('replacements_used',used+old_used,'replacements_pending',pending,'replacements_remaining',greatest(0,2-used-old_used-pending));
 select trim(concat_ws(' ',c.name,c.surname)) into cname from public.optyker_clients c where c.id=p_client_id;
 if p_action='certificate' then
  select jsonb_build_object('id',da.id,'reference',da.reference,'delivery_date',da.delivery_date,'pdf_base64',encode(da.pdf,'base64'),'pdf_sha256',da.pdf_sha256) into result
   from public.optyker_eyewear_delivery_archive da where da.sheet_id=sid and da.client_id=p_client_id order by da.revision desc limit 1;
  if result is null then return jsonb_build_object('ok',true,'data',null,'message','Il certificato firmato di questa busta non è ancora disponibile. Richiedilo all’ottica in chat.'); end if;
  return jsonb_build_object('ok',true,'data',result);
 elsif p_action='report' then
  if p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Conferma l’invio della denuncia in chat'; end if;
  if cover->>'tier' not in ('silver','gold') then raise exception 'Smarrimento previsto per Silver e Gold'; end if;
  if cover->>'state'='expired' then raise exception 'Copertura di 24 mesi scaduta'; end if;
  rid:=nullif(p_payload->>'request_id','')::uuid;
  if rid is null then raise exception 'Identificativo invio mancante'; end if;
  if exists(select 1 from public.optyker_eyewear_claim_reports re where re.id=rid) then
   if not exists(select 1 from public.optyker_eyewear_claim_reports re where re.id=rid and re.client_id=p_client_id and re.sheet_id=sid) then raise exception 'Identificativo invio non valido'; end if;
   if not exists(select 1 from public.optyker_chat_messages cm where cm.id=rid and cm.attachment_data=p_payload->>'attachment_data') then raise exception 'Invio già utilizzato per un altro allegato'; end if;
   return jsonb_build_object('ok',true,'evidence_message_id',rid,'already_sent',true);
  end if;
  if (select count(*) from public.optyker_eyewear_claim_reports re where re.client_id=p_client_id and re.created_at>now()-interval '1 day')>=20 then raise exception 'Troppi allegati inviati: contatta l’ottica'; end if;
  if coalesce(length(p_payload->>'attachment_data'),0)<30 or length(p_payload->>'attachment_data')>4200000 or (p_payload->>'attachment_data')!~'^data:(application/pdf|image/(jpeg|png|webp));base64,[A-Za-z0-9+/=]+$' then raise exception 'Allega un PDF o una foto della denuncia, massimo 3 MB'; end if;
  insert into public.optyker_chat_messages(id,client_id,sender_type,sender_name,message,attachment_data,attachment_name,attachment_type,read_by_staff,read_by_customer)
  values(rid,p_client_id,'customer',cname,'Denuncia per smarrimento occhiale · Busta '||coalesce(doc.reference_code,doc.reference_no,sid::text),p_payload->>'attachment_data',left(coalesce(p_payload->>'attachment_name','Denuncia'),180),left(p_payload->>'attachment_type',100),false,true);
  insert into public.optyker_eyewear_claim_reports(id,client_id,sheet_id) values(rid,p_client_id,sid);
  return jsonb_build_object('ok',true,'evidence_message_id',rid,'already_sent',false);
 elsif p_action='request' then
  if p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Conferma la richiesta prima di inviarla'; end if;
  rid:=nullif(p_payload->>'request_id','')::uuid; v_reason:=p_payload->>'reason'; v_eye:=coalesce(p_payload->>'eye','');
  if rid is null then raise exception 'Identificativo richiesta mancante'; end if;
  select * into req from public.optyker_eyewear_claims cl where cl.id=rid;
  if found then
   if req.client_id<>p_client_id or req.sheet_id<>sid or req.reason is distinct from v_reason or req.eye<>v_eye then raise exception 'Identificativo già utilizzato con dati diversi'; end if;
   return jsonb_build_object('ok',true,'data',to_jsonb(req),'already_requested',true);
  end if;
  select value into benefit from jsonb_array_elements(cover->'benefits') where value->>'reason'=v_reason;
  if benefit is null then raise exception 'Questa copertura non è prevista dalla garanzia'; end if;
  if started is null then raise exception 'L’ottica deve prima confermare la data effettiva di consegna'; end if;
  if benefit->'eligible' is distinct from 'true'::jsonb then raise exception 'Copertura non disponibile in questo periodo'; end if;
  if v_reason='scratched_lens' and v_eye not in ('OD','OS','entrambi') then raise exception 'Seleziona la lente destra, sinistra o entrambe'; end if;
  if v_reason<>'scratched_lens' and v_eye<>'' then raise exception 'Selezione lente non prevista'; end if;
  select * into req from public.optyker_eyewear_claims cl where cl.sheet_id=sid and cl.reason=v_reason and cl.eye=v_eye and cl.status='pending' order by cl.created_at desc limit 1;
  if found then return jsonb_build_object('ok',true,'data',to_jsonb(req),'already_requested',true); end if;
  if v_reason='scratched_lens' and used+old_used+pending>=2 then raise exception 'Sono già utilizzati o prenotati i due ricambi complessivi'; end if;
  evidence:=nullif(p_payload->>'evidence_message_id','')::uuid;
  if v_reason='loss' and not exists(select 1 from public.optyker_eyewear_claim_reports re where re.id=evidence and re.client_id=p_client_id and re.sheet_id=sid) then raise exception 'Prima inoltra la denuncia in chat per questa busta'; end if;
  insert into public.optyker_eyewear_claims(id,client_id,sheet_id,reason,eye,tier,discount_percent,starts_on,evidence_message_id)
  values(rid,p_client_id,sid,v_reason,v_eye,cover->>'tier',(benefit->>'discount_percent')::integer,started,case when v_reason='loss' then evidence else null end) returning * into req;
  insert into public.optyker_chat_messages(client_id,sender_type,sender_name,message,read_by_staff,read_by_customer)
  values(p_client_id,'customer',cname,'Richiesta garanzia '||(cover->>'name')||' · '||coalesce(doc.reference_code,doc.reference_no,sid::text)||E'\n'||(benefit->>'label')||case when v_eye<>'' then ' · '||v_eye else '' end||E'\n'||case when req.discount_percent=100 then 'Sostituzione in omaggio' else 'Sconto '||req.discount_percent||'%' end||' · da verificare con l’ottica. Richiesta: '||rid::text,false,true) returning id into mid;
  update public.optyker_eyewear_claims set message_id=mid where id=rid returning * into req;
  insert into public.optyker_eyewear_claim_audit(claim_id,actor,new_status) values(rid,'customer','pending');
  return jsonb_build_object('ok',true,'data',to_jsonb(req),'already_requested',false);
 elsif p_action='resolve' then
  if p_operator is null or p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Conferma dell’operatore richiesta'; end if;
  rid:=nullif(p_payload->>'request_id','')::uuid;target:=p_payload->>'status';
  if target not in ('fulfilled','rejected') or target is null then raise exception 'Stato non valido'; end if;
  select * into req from public.optyker_eyewear_claims cl where cl.id=rid and cl.client_id=p_client_id and cl.sheet_id=sid for update;
  if not found then raise exception 'Richiesta non trovata'; end if;
  if req.status=target then return jsonb_build_object('ok',true,'data',to_jsonb(req)); end if;
  if req.status<>'pending' then raise exception 'Richiesta già chiusa'; end if;
  if req.reason='loss' and target='fulfilled' and p_payload->'report_verified' is distinct from 'true'::jsonb then raise exception 'Conferma la verifica della denuncia ricevuta in chat'; end if;
  update public.optyker_eyewear_claims set status=target,updated_at=now(),changed_by=p_operator where id=rid returning * into req;
  insert into public.optyker_eyewear_claim_audit(claim_id,actor,old_status,new_status) values(rid,p_operator,'pending',target);
  insert into public.optyker_chat_messages(client_id,sender_type,sender_name,message,read_by_staff,read_by_customer)
  values(p_client_id,'staff',p_operator,'Garanzia occhiale · '||coalesce(doc.reference_code,doc.reference_no,sid::text)||' · richiesta '||rid::text||case target when 'fulfilled' then ' · ricambio consegnato.' else ' · richiesta non accolta / annullata. Contatta l’ottica per i dettagli.' end,true,false);
  return jsonb_build_object('ok',true,'data',to_jsonb(req));
 elsif p_action not in ('get','activate') then raise exception 'Azione non riconosciuta';
 end if;
 return jsonb_build_object('ok',true,'sheet_id',sid,'reference',coalesce(doc.reference_code,doc.reference_no), 'coverage',cover,
 'claims',(select coalesce(jsonb_agg(to_jsonb(cl) order by cl.created_at desc),'[]'::jsonb) from public.optyker_eyewear_claims cl where cl.sheet_id=sid and cl.client_id=p_client_id),
 'reports',(select coalesce(jsonb_agg(jsonb_build_object('id',re.id,'name',m.attachment_name,'created_at',re.created_at) order by re.created_at desc),'[]'::jsonb) from public.optyker_eyewear_claim_reports re join public.optyker_chat_messages m on m.id=re.id where re.sheet_id=sid and re.client_id=p_client_id));
exception when invalid_text_representation or invalid_datetime_format then return jsonb_build_object('ok',false,'error','Dati della richiesta non validi');
 when others then return jsonb_build_object('ok',false,'error',sqlerrm);
end $$;
revoke all on function public.optyker_eyewear_cover_core(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.optyker_eyewear_cover_core(uuid,text,jsonb,text) to service_role;

create or replace function public.optyker_eyewear_cover_customer(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid; matches integer;
begin
 if p_action not in ('get','request','report','certificate') then return jsonb_build_object('ok',false,'error','Azione non consentita'); end if;
 select count(*),(array_agg(c.id))[1] into matches,cid from public.optyker_clients c join auth.users au on lower(trim(c.email))=lower(trim(au.email)) where au.id=p_user_id and au.email_confirmed_at is not null;
 if matches<>1 then return jsonb_build_object('ok',false,'error','Account non collegato in modo univoco: contatta l’ottica'); end if;
 return public.optyker_eyewear_cover_core(cid,p_action,p_payload,null);
end $$;
revoke all on function public.optyker_eyewear_cover_customer(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_eyewear_cover_customer(uuid,text,jsonb) to service_role;

create or replace function public.optyker_eyewear_cover_staff(p_username text,p_password text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.optyker_staff_allowed(p_username,p_password) is not true then return jsonb_build_object('ok',false,'error','Operatore non autorizzato'); end if;
 if p_action not in ('get','activate','resolve') then return jsonb_build_object('ok',false,'error','Azione non consentita'); end if;
 return public.optyker_eyewear_cover_core(nullif(p_payload->>'client_id','')::uuid,p_action,p_payload,p_username);
exception when invalid_text_representation then return jsonb_build_object('ok',false,'error','Cliente non valido');
end $$;
revoke all on function public.optyker_eyewear_cover_staff(text,text,text,jsonb) from public;
grant execute on function public.optyker_eyewear_cover_staff(text,text,text,jsonb) to anon,authenticated,service_role;

-- Existing manual lens replacement flow shares the same quota, including pending app requests.
create or replace function public.optyker_eyewear_shared_quota_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; total integer;
begin
 select wi.source_sheet_id into sid from public.optyker_eyewear_warranty_instances wi where wi.id=new.warranty_id;
 if sid is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('own-frame-warranty:'||sid::text,0));
 select (select count(*) from public.optyker_eyewear_warranty_replacements r where r.warranty_id=new.warranty_id)+(select count(*) from public.optyker_eyewear_claims cl where cl.sheet_id=sid and cl.reason='scratched_lens' and cl.status in ('pending','fulfilled')) into total;
 if total>=2 then raise exception 'Due ricambi già utilizzati o prenotati. Gestisci la richiesta app in Garanzia occhiale'; end if;
 return new;
end $$;
drop trigger if exists optyker_eyewear_shared_quota_guard on public.optyker_eyewear_warranty_replacements;
create trigger optyker_eyewear_shared_quota_guard before insert on public.optyker_eyewear_warranty_replacements for each row execute function public.optyker_eyewear_shared_quota_guard();
comment on table public.optyker_eyewear_claims is 'OVC commercial benefits. Request is not a fiscal transaction or an order. Pending scratch claims reserve one of two replacements. Loss is Silver/Gold only and requires a report delivered in chat and staff verification.';
