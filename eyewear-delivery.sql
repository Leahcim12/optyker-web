-- Immutable signed PDF archives. No existing client, busta, price or order is changed.
create table if not exists public.optyker_eyewear_delivery_drafts(
 id uuid primary key,
 sheet_id uuid not null references public.optyker_sheets(id),
 client_id uuid not null references public.optyker_clients(id),
 source_hash text not null,
 previous_archive_id uuid,
 document_values jsonb not null,
 layout jsonb not null,
 pdf bytea not null,
 pdf_sha256 text not null,
 prepared_by text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '2 hours',
 check(octet_length(pdf) between 100 and 3000000)
);
create table if not exists public.optyker_eyewear_delivery_archive(
 id uuid primary key references public.optyker_eyewear_delivery_drafts(id),
 sheet_id uuid not null references public.optyker_sheets(id),
 client_id uuid not null references public.optyker_clients(id),
 revision integer not null,
 reference text not null,
 delivery_date date not null,
 declaration_date date not null,
 signed_at timestamptz not null,
 archived_at timestamptz not null default now(),
 archived_by text not null,
 snapshot jsonb not null,
 signature_digest text not null,
 pdf bytea not null,
 pdf_sha256 text not null,
 retain_until date not null,
 unique(sheet_id,revision),
 check(octet_length(pdf) between 100 and 3000000)
);
create index if not exists eyewear_delivery_archive_client on public.optyker_eyewear_delivery_archive(client_id,sheet_id,revision desc);
alter table public.optyker_eyewear_delivery_drafts enable row level security;
alter table public.optyker_eyewear_delivery_archive enable row level security;
revoke all on public.optyker_eyewear_delivery_drafts,public.optyker_eyewear_delivery_archive from public,anon,authenticated,service_role;
grant select,insert on public.optyker_eyewear_delivery_drafts,public.optyker_eyewear_delivery_archive to service_role;
create or replace function public.optyker_delivery_immutable() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Documento di consegna non modificabile: crea una nuova revisione senza sovrascrivere la precedente'; end $$;
drop trigger if exists delivery_archive_immutable on public.optyker_eyewear_delivery_archive;
create trigger delivery_archive_immutable before update or delete on public.optyker_eyewear_delivery_archive for each row execute function public.optyker_delivery_immutable();
drop trigger if exists delivery_draft_immutable on public.optyker_eyewear_delivery_drafts;
create trigger delivery_draft_immutable before update on public.optyker_eyewear_delivery_drafts for each row execute function public.optyker_delivery_immutable();
create or replace function public.optyker_delivery_internal(p_username text,p_password text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare cid uuid; sid uuid; did uuid; sh public.optyker_sheets%rowtype; c jsonb; m jsonb; fingerprint text; previous uuid; d public.optyker_eyewear_delivery_drafts%rowtype; a public.optyker_eyewear_delivery_archive%rowtype; bytes bytea; rev integer; t timestamptz; result jsonb;
begin
 if public.optyker_staff_allowed(p_username,p_password) is not true then return jsonb_build_object('ok',false,'error','Operatore non autorizzato'); end if;
 cid:=nullif(p_payload->>'client_id','')::uuid; sid:=nullif(p_payload->>'sheet_id','')::uuid;did:=nullif(p_payload->>'document_id','')::uuid;
 select * into sh from public.optyker_sheets where id=sid and client_id=cid for share;
 if not found or sh.sheet_type<>'eyewear_job' or coalesce(sh.data->>'mode','')<>'job' then raise exception 'Seleziona una Busta Occhiali salvata del cliente corretto'; end if;
 select jsonb_build_object('id',id,'name',name,'surname',surname,'fiscal',fiscal,'street',street,'street_number',street_number,'postal_code',postal_code,'city',city,'province',province) into c from public.optyker_clients where id=cid;
 select jsonb_build_object('data',data,'revision',revision) into m from public.optyker_eyewear_material_certificates where sheet_id=sid and client_id=cid;
 fingerprint:=encode(digest(convert_to(jsonb_build_object('sheet',sh.data,'updated_at',sh.updated_at,'client',c,'material',m)::text,'UTF8'),'sha256'),'hex');
 select id into previous from public.optyker_eyewear_delivery_archive where sheet_id=sid order by revision desc limit 1;
 if p_action='get' then
  select coalesce(jsonb_agg(jsonb_build_object('id',ar.id,'revision',ar.revision,'delivery_date',ar.delivery_date,'signed_at',ar.signed_at,'pdf_sha256',ar.pdf_sha256,'reference',ar.reference) order by ar.revision desc),'[]'::jsonb) into result from public.optyker_eyewear_delivery_archive ar where ar.sheet_id=sid and ar.client_id=cid;
  return jsonb_build_object('ok',true,'sheet',to_jsonb(sh),'client',c,'material',m,'source_hash',fingerprint,'server_time',now(),'operator',p_username,'previous_archive_id',previous,'archives',result,'previous_values',(select snapshot->'values' from public.optyker_eyewear_delivery_archive where id=previous),'previous_issuer',(select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(coalesce((select snapshot->'values' from public.optyker_eyewear_delivery_archive order by archived_at desc limit 1),'{}'::jsonb)) where key like 'issuer_%'));
 elsif p_action='archive' then
  select * into a from public.optyker_eyewear_delivery_archive where id=did and sheet_id=sid and client_id=cid;
  if not found then raise exception 'Copia archiviata non trovata'; end if;
  return jsonb_build_object('ok',true,'id',a.id,'revision',a.revision,'delivery_date',a.delivery_date,'signed_at',a.signed_at,'pdf_base64',encode(a.pdf,'base64'),'pdf_sha256',a.pdf_sha256,'signature_digest',a.signature_digest);
 elsif p_action='prepare' then
  if p_payload->>'source_hash' is distinct from fingerprint then raise exception 'Busta, anagrafica o materiali modificati. Riapri il documento'; end if;
  if nullif(p_payload->>'previous_archive_id','')::uuid is distinct from previous then raise exception 'È presente una nuova revisione. Riapri la dichiarazione'; end if;
  if jsonb_typeof(p_payload->'values')<>'object' or octet_length((p_payload->'values')::text)>35000 then raise exception 'Dati documento non validi'; end if;
  if p_payload#>'{values,technical_verified}' is distinct from 'true'::jsonb or p_payload#>'{values,conformity_confirmed}' is distinct from 'true'::jsonb then raise exception 'Verifiche del responsabile mancanti'; end if;
  bytes:=decode(p_payload->>'pdf_base64','base64');
  if substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then raise exception 'PDF non valido'; end if;
  insert into public.optyker_eyewear_delivery_drafts(id,sheet_id,client_id,source_hash,previous_archive_id,document_values,layout,pdf,pdf_sha256,prepared_by)
  values(did,sid,cid,fingerprint,previous,p_payload->'values',p_payload->'layout',bytes,encode(digest(bytes,'sha256'),'hex'),p_username) returning * into d;
  return jsonb_build_object('ok',true,'id',d.id,'pdf_sha256',d.pdf_sha256);
 elsif p_action in ('sign_context','finalize') then
  select * into d from public.optyker_eyewear_delivery_drafts where id=did and sheet_id=sid and client_id=cid;
  if not found or d.prepared_by<>p_username then raise exception 'Anteprima non disponibile per questo operatore'; end if;
  select * into a from public.optyker_eyewear_delivery_archive where id=did;
  if found then return jsonb_build_object('ok',true,'already_archived',true,'id',a.id,'revision',a.revision,'delivery_date',a.delivery_date,'signed_at',a.signed_at,'pdf_base64',encode(a.pdf,'base64'),'pdf_sha256',a.pdf_sha256,'signature_digest',a.signature_digest); end if;
  if d.expires_at<now() then raise exception 'Anteprima scaduta. Riapri, verifica e firma nuovamente'; end if;
  if d.source_hash<>fingerprint then raise exception 'I dati della busta sono cambiati: crea una nuova anteprima e firma nuovamente'; end if;
  if p_action='sign_context' then return jsonb_build_object('ok',true,'id',d.id,'values',d.document_values,'layout',d.layout,'pdf_base64',encode(d.pdf,'base64'),'pdf_sha256',d.pdf_sha256,'server_time',now()); end if;
  if p_payload->'confirm' is distinct from 'true'::jsonb or p_payload->'identity_checked' is distinct from 'true'::jsonb or p_payload->'client_accepts' is distinct from 'true'::jsonb or p_payload->'instructions_delivered' is distinct from 'true'::jsonb then raise exception 'Conferme di firma e ricezione mancanti'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eyewear-delivery:'||sid::text,0));
  select * into a from public.optyker_eyewear_delivery_archive where id=did;
  if found then return public.optyker_delivery_internal(p_username,p_password,'archive',p_payload); end if;
  select id into previous from public.optyker_eyewear_delivery_archive where sheet_id=sid order by revision desc limit 1;
  if d.previous_archive_id is distinct from previous then raise exception 'Un altro documento è stato archiviato: verifica la nuova revisione prima di firmare'; end if;
  select coalesce(max(revision),0)+1 into rev from public.optyker_eyewear_delivery_archive where sheet_id=sid;
  bytes:=decode(p_payload->>'pdf_base64','base64');if substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then raise exception 'PDF firmato non valido'; end if;
  if coalesce(p_payload->>'signature_digest','')!~'^[0-9a-f]{64}$' then raise exception 'Impronta firme mancante'; end if;
  t:=(p_payload->>'signed_at')::timestamptz;if t is null or t>now()+interval '15 seconds' or t<now()-interval '5 minutes' then raise exception 'Data di acquisizione non valida'; end if;
  insert into public.optyker_eyewear_delivery_archive(id,sheet_id,client_id,revision,reference,delivery_date,declaration_date,signed_at,archived_by,snapshot,signature_digest,pdf,pdf_sha256,retain_until)
  values(d.id,sid,cid,rev,coalesce(sh.reference_code,sh.reference_no,sid::text),(d.document_values->>'delivery_date')::date,(d.document_values->>'declaration_date')::date,t,p_username,jsonb_build_object('values',d.document_values,'source_hash',d.source_hash,'preview_sha256',d.pdf_sha256,'previous_archive_id',d.previous_archive_id,'identity_checked',true,'client_accepts',true,'instructions_delivered',true,'signature_type','drawn_electronic_not_qualified'),p_payload->>'signature_digest',bytes,encode(digest(bytes,'sha256'),'hex'),(greatest((d.document_values->>'delivery_date')::date,(now() at time zone 'Europe/Rome')::date)+interval '10 years')::date);
  return public.optyker_delivery_internal(p_username,p_password,'archive',p_payload);
 end if;
 raise exception 'Azione non riconosciuta';
exception when invalid_text_representation or invalid_datetime_format then return jsonb_build_object('ok',false,'error','Riferimenti o dati non validi');
 when others then return jsonb_build_object('ok',false,'error',sqlerrm);
end $$;
revoke all on function public.optyker_delivery_internal(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_delivery_internal(text,text,text,jsonb) to service_role;
comment on table public.optyker_eyewear_delivery_archive is 'Same signed PDF bytes for server archive and printing; SHA-256, server acquisition time and declared delivery date. App-level immutable, not a qualified signature or a certified preservation service. No biometric dynamics collected.';
