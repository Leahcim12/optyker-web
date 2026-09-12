-- Shared OVC eyewear benefits across the website, customer app and staff UI.
-- No delivery dates, claims, prices or sales are created by this migration.
alter table public.optyker_eyewear_claims add column if not exists origin_channel text not null default 'app' check(origin_channel in ('app','shopify','optyker'));
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
  values(rid,p_client_id,case when p_operator is null then 'customer' else 'staff' end,coalesce(p_operator,cname),'Denuncia per smarrimento occhiale · Busta '||coalesce(doc.reference_code,doc.reference_no,sid::text),p_payload->>'attachment_data',left(coalesce(p_payload->>'attachment_name','Denuncia'),180),left(p_payload->>'attachment_type',100),p_operator is not null,p_operator is null);
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
  insert into public.optyker_eyewear_claims(id,client_id,sheet_id,reason,eye,tier,discount_percent,starts_on,evidence_message_id,origin_channel)
  values(rid,p_client_id,sid,v_reason,v_eye,cover->>'tier',(benefit->>'discount_percent')::integer,started,case when v_reason='loss' then evidence else null end,case when p_operator is not null then 'optyker' when p_payload->>'_channel'='shopify' then 'shopify' else 'app' end) returning * into req;
  insert into public.optyker_chat_messages(client_id,sender_type,sender_name,message,read_by_staff,read_by_customer)
  values(p_client_id,case when p_operator is null then 'customer' else 'staff' end,coalesce(p_operator,cname),'Richiesta garanzia '||(cover->>'name')||' · '||coalesce(doc.reference_code,doc.reference_no,sid::text)||E'\n'||(benefit->>'label')||case when v_eye<>'' then ' · '||v_eye else '' end||E'\n'||case when req.discount_percent=100 then 'Sostituzione in omaggio' else 'Sconto '||req.discount_percent||'%' end||' · da verificare con l’ottica. Richiesta: '||rid::text,p_operator is not null,p_operator is null) returning id into mid;
  update public.optyker_eyewear_claims set message_id=mid where id=rid returning * into req;
  insert into public.optyker_eyewear_claim_audit(claim_id,actor,new_status) values(rid,coalesce(p_operator,'customer'),'pending');
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
 return public.optyker_eyewear_cover_core(cid,p_action,p_payload||jsonb_build_object('_channel','app'),null);
end $$;
revoke all on function public.optyker_eyewear_cover_customer(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_eyewear_cover_customer(uuid,text,jsonb) to service_role;

create or replace function public.optyker_eyewear_cover_staff(p_username text,p_password text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.optyker_staff_allowed(p_username,p_password) is not true then return jsonb_build_object('ok',false,'error','Operatore non autorizzato'); end if;
 if p_action not in ('get','activate','resolve','request','report') then return jsonb_build_object('ok',false,'error','Azione non consentita'); end if;
 return public.optyker_eyewear_cover_core(nullif(p_payload->>'client_id','')::uuid,p_action,p_payload||jsonb_build_object('_channel','optyker'),p_username);
exception when invalid_text_representation then return jsonb_build_object('ok',false,'error','Cliente non valido');
end $$;
revoke all on function public.optyker_eyewear_cover_staff(text,text,text,jsonb) from public;
grant execute on function public.optyker_eyewear_cover_staff(text,text,text,jsonb) to anon,authenticated,service_role;


-- Shopify's existing customer page supplies the opaque per-customer portal credential.
-- It is not a customer id or an email. No direct anonymous execution is allowed.
create or replace function public.optyker_eyewear_cover_site(p_token text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid; matches integer; docs jsonb;
begin
 if p_token is null or length(p_token)<32 or length(p_token)>200 then return jsonb_build_object('ok',false,'error','Collegamento cliente non valido. Accedi nuovamente dal sito.'); end if;
 select count(*),(array_agg(c.id))[1] into matches,cid from public.optyker_clients c where c.customer_portal_token=p_token;
 if matches<>1 then return jsonb_build_object('ok',false,'error','Collegamento cliente non valido. Accedi nuovamente dal sito.'); end if;
 if p_action='list' then
  select coalesce(jsonb_agg(x order by x.created_at desc,x.id),'[]'::jsonb) into docs from (
   select sh.id,coalesce(sh.reference_code,sh.reference_no,sh.title) as reference,sh.created_at,
    jsonb_build_object('brand',sh.data#>>'{frame,brand}','model',sh.data#>>'{frame,model}','type',sh.data#>>'{frame,type}','color',sh.data#>>'{frame,color}') as frame,
    jsonb_build_object('od',coalesce(sh.data#>>'{lens,lens_od,lens_name}',sh.data#>>'{lens,lens_name}',sh.data#>>'{lens,lens_type_od}'),'os',coalesce(sh.data#>>'{lens,lens_os,lens_name}',sh.data#>>'{lens,lens_name}',sh.data#>>'{lens,lens_type_os}')) as lenses,
    public.optyker_eyewear_cover_rules(sh.data,null,(now() at time zone 'Europe/Rome')::date)->>'name' as warranty_name
   from public.optyker_sheets sh where sh.client_id=cid and sh.sheet_type in ('eyewear_job','eyewear_job_v1')
   order by sh.created_at desc,sh.id limit 100
  )x;
  return jsonb_build_object('ok',true,'data',docs);
 end if;
 if p_action not in ('get','request','report','certificate') then return jsonb_build_object('ok',false,'error','Azione non consentita'); end if;
 return public.optyker_eyewear_cover_core(cid,p_action,coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('_channel','shopify'),null);
end $$;
revoke all on function public.optyker_eyewear_cover_site(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_eyewear_cover_site(text,text,jsonb) to service_role;
comment on column public.optyker_eyewear_claims.origin_channel is 'Server-set source for the shared claim ledger; it never changes benefits, quota or delivery date.';
