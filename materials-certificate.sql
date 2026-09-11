-- Adds certificate storage only. Existing buste, prices and orders are not modified.
create table if not exists public.optyker_eyewear_material_certificates (
 sheet_id uuid primary key references public.optyker_sheets(id),
 client_id uuid not null references public.optyker_clients(id),
 data jsonb not null check(jsonb_typeof(data)='object'),
 source_updated_at timestamptz not null,
 revision bigint not null default 1,
 compiled_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.optyker_eyewear_material_certificate_history (
 sheet_id uuid not null references public.optyker_eyewear_material_certificates(sheet_id),
 revision bigint not null,
 snapshot jsonb not null,
 primary key(sheet_id,revision)
);
alter table public.optyker_eyewear_material_certificates enable row level security;
alter table public.optyker_eyewear_material_certificate_history enable row level security;
revoke all on public.optyker_eyewear_material_certificates,public.optyker_eyewear_material_certificate_history from public,anon,authenticated;
grant select,insert,update,delete on public.optyker_eyewear_material_certificates,public.optyker_eyewear_material_certificate_history to service_role;
create or replace function public.optyker_material_certificate_api(p_username text,p_password text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare cid uuid; sid uuid; sh public.optyker_sheets%rowtype; cert public.optyker_eyewear_material_certificates%rowtype; v jsonb; k text; item jsonb; cname text;
allowed constant text[]:=array['frame_brand','frame_model','frame_material','frame_color','frame_code','od_brand','od_name','od_material','od_index','od_treatments','od_color','od_code','od_lot','os_brand','os_name','os_material','os_index','os_treatments','os_color','os_code','os_lot','delivery_date','public_notes'];
begin
 if public.optyker_staff_allowed(p_username,p_password) is not true then return jsonb_build_object('ok',false,'error','Operatore non autorizzato'); end if;
 cid:=nullif(p_payload->>'client_id','')::uuid;sid:=nullif(p_payload->>'sheet_id','')::uuid;
 if p_action is null or p_action not in ('get','save') then raise exception 'Azione non riconosciuta'; end if;
 select * into sh from public.optyker_sheets where id=sid and client_id=cid for share;
 if not found then raise exception 'Busta non disponibile per il cliente selezionato'; end if;
 if sh.sheet_type<>'eyewear_job' or coalesce(sh.data->>'mode','')<>'job' or lower(coalesce(sh.document_type,''))='preventivo' then raise exception 'Il certificato dei materiali è disponibile soltanto nelle Buste Occhiali'; end if;
 select trim(concat_ws(' ',c.name,c.surname)) into cname from public.optyker_clients c where c.id=cid;
 perform pg_advisory_xact_lock(hashtextextended('material-certificate:'||sid::text,0));
 select * into cert from public.optyker_eyewear_material_certificates where sheet_id=sid;
 if p_action='save' then
  if p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Conferma il salvataggio del certificato'; end if;
  if nullif(p_payload->>'source_updated_at','')::timestamptz is distinct from sh.updated_at then raise exception 'La busta è stata modificata. Riapri il certificato per verificare i dati aggiornati'; end if;
  if (p_payload->>'revision')::bigint is distinct from coalesce(cert.revision,0) then raise exception 'Il certificato è stato modificato da un altro operatore. Riaprilo prima di salvare'; end if;
  v:=p_payload->'values';
  if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>20000 then raise exception 'Dati del certificato non validi'; end if;
  for k,item in select key,value from jsonb_each(v) loop
   if not (k=any(allowed)) or jsonb_typeof(item)<>'string' or length(item#>>'{}')>(case when k='public_notes' then 1500 else 300 end) then raise exception 'Campo del certificato non valido: %',k; end if;
  end loop;
  if coalesce(v->>'delivery_date','')<>'' then
   if (v->>'delivery_date') !~ '^\d{4}-\d{2}-\d{2}$' or to_char((v->>'delivery_date')::date,'YYYY-MM-DD')<>(v->>'delivery_date') then raise exception 'Data di consegna non valida'; end if;
  end if;
  insert into public.optyker_eyewear_material_certificates(sheet_id,client_id,data,source_updated_at,compiled_by) values(sid,cid,v,sh.updated_at,p_username)
  on conflict(sheet_id) do update set data=excluded.data,source_updated_at=excluded.source_updated_at,revision=optyker_eyewear_material_certificates.revision+1,compiled_by=excluded.compiled_by,updated_at=now()
  returning * into cert;
  insert into public.optyker_eyewear_material_certificate_history(sheet_id,revision,snapshot) values(sid,cert.revision,to_jsonb(cert));
 end if;
 return jsonb_build_object('ok',true,'sheet',to_jsonb(sh),'client_name',cname,'certificate',case when cert.sheet_id is null then null else to_jsonb(cert) end);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('ok',false,'error','Riferimenti, data o revisione non validi');
 when others then return jsonb_build_object('ok',false,'error',sqlerrm);
end $$;
revoke all on function public.optyker_material_certificate_api(text,text,text,jsonb) from public;
grant execute on function public.optyker_material_certificate_api(text,text,text,jsonb) to anon,authenticated,service_role;
comment on table public.optyker_eyewear_material_certificates is 'Descriptive materials certificate attached to a saved eyewear busta. No CE/manufacturer attestation is inferred. Sources and revisions preserved; no prices or fiscal documents altered.';
