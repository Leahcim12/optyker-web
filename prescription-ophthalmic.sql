-- Oculists are available only through the existing staff authentication.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create table if not exists public.optyker_oculists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 240),
  name_key text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored unique,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  province text not null default '',
  focus_code text unique,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.optyker_oculists enable row level security;
revoke all on public.optyker_oculists from public, anon, authenticated;
grant all on public.optyker_oculists to service_role;

create or replace function private.optyker_oculists_staff(p_username text, p_password text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare d public.optyker_oculists%rowtype; n text;
begin
  if public.optyker_staff_allowed(p_username,p_password) is not true then
    return jsonb_build_object('ok',false,'error','Operatore non autorizzato');
  end if;
  if p_action='list' then
    return jsonb_build_object('ok',true,'data',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone,'email',email,'city',city) order by lower(name)) from public.optyker_oculists),'[]'::jsonb));
  elsif p_action='create' then
    n:=regexp_replace(btrim(coalesce(p_payload->>'name','')), '\s+', ' ', 'g');
    if length(n) not between 2 and 240 or length(coalesce(p_payload->>'phone',''))>80 or length(coalesce(p_payload->>'email',''))>254 or length(coalesce(p_payload->>'city',''))>160 then
      return jsonb_build_object('ok',false,'error','Controlla nome e recapiti dell’oculista');
    end if;
    insert into public.optyker_oculists(name,phone,email,city)
      values(n,btrim(coalesce(p_payload->>'phone','')),btrim(coalesce(p_payload->>'email','')),btrim(coalesce(p_payload->>'city','')))
      on conflict(name_key) do nothing returning * into d;
    if d.id is null then
      select * into d from public.optyker_oculists where name_key=lower(n);
      return jsonb_build_object('ok',true,'already_exists',true,'data',jsonb_build_object('id',d.id,'name',d.name,'phone',d.phone,'email',d.email,'city',d.city));
    end if;
    return jsonb_build_object('ok',true,'data',jsonb_build_object('id',d.id,'name',d.name,'phone',d.phone,'email',d.email,'city',d.city));
  end if;
  return jsonb_build_object('ok',false,'error','Operazione non disponibile');
end $$;
revoke all on function private.optyker_oculists_staff(text,text,text,jsonb) from public;
grant execute on function private.optyker_oculists_staff(text,text,text,jsonb) to anon,authenticated,service_role;
create or replace function public.optyker_oculists_staff(p_username text,p_password text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$
  select private.optyker_oculists_staff(p_username,p_password,p_action,p_payload)
$$;
revoke all on function public.optyker_oculists_staff(text,text,text,jsonb) from public;
grant execute on function public.optyker_oculists_staff(text,text,text,jsonb) to anon,authenticated,service_role;

create or replace function private.optyker_prescription_update(p_username text,p_password text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare s public.optyker_sheets%rowtype; snap jsonb; d public.optyker_oculists%rowtype; enabled boolean;
begin
  if public.optyker_staff_allowed(p_username,p_password) is not true then
    return jsonb_build_object('ok',false,'error','Operatore non autorizzato');
  end if;
  select * into s from public.optyker_sheets where id=(p_payload->>'sheet_id')::uuid and client_id=(p_payload->>'client_id')::uuid and sheet_type='prescription' for update;
  if not found then return jsonb_build_object('ok',false,'error','Prescrizione non disponibile per questo cliente'); end if;
  if nullif(p_payload->>'expected_updated_at','')::timestamptz is distinct from s.updated_at then
    return jsonb_build_object('ok',false,'error','La prescrizione è stata modificata: riaprila prima di salvare');
  end if;
  snap:=p_payload->'data';
  if jsonb_typeof(snap) is distinct from 'object' or jsonb_typeof(snap->'elements') is distinct from 'object' or octet_length(snap::text)>700000 then
    return jsonb_build_object('ok',false,'error','Dati della prescrizione non validi');
  end if;
  enabled:=coalesce((snap->>'ophthalmicPrescription')::boolean,false);
  if enabled then
    select * into d from public.optyker_oculists where id=nullif(snap#>>'{ophthalmologist,id}','')::uuid;
    if not found then return jsonb_build_object('ok',false,'error','Seleziona l’oculista'); end if;
    snap:=snap||jsonb_build_object('ophthalmologist',jsonb_build_object('id',d.id,'name',d.name));
  else
    snap:=snap||jsonb_build_object('ophthalmologist',null,'ophthalmicDate','');
  end if;
  -- Original migration evidence remains immutable when the operator edits values.
  snap:=(snap-'focusImport')||case when s.data ? 'focusImport' then jsonb_build_object('focusImport',s.data->'focusImport') else '{}'::jsonb end;
  snap:=snap||jsonb_build_object('sheetType','prescription','sheetLabel',case when enabled then 'Prescrizione oculistica' else 'Prescrizione optometrica' end);
  update public.optyker_sheets set data=snap,title=snap->>'sheetLabel',operator=p_username,updated_at=now() where id=s.id returning * into s;
  return jsonb_build_object('ok',true,'data',to_jsonb(s));
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
  return jsonb_build_object('ok',false,'error','Dati della prescrizione non validi');
end $$;
revoke all on function private.optyker_prescription_update(text,text,jsonb) from public;
grant execute on function private.optyker_prescription_update(text,text,jsonb) to anon,authenticated,service_role;
create or replace function public.optyker_prescription_update(p_username text,p_password text,p_payload jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$
  select private.optyker_prescription_update(p_username,p_password,p_payload)
$$;
revoke all on function public.optyker_prescription_update(text,text,jsonb) from public;
grant execute on function public.optyker_prescription_update(text,text,jsonb) to anon,authenticated,service_role;

-- Source rows stay private and support repeatable imports without duplicate sheets.
create table if not exists private.optyker_focus_prescriptions (
  source_id text primary key,
  source_file text not null,
  source_hash text not null,
  source_row jsonb not null,
  client_id uuid references public.optyker_clients(id),
  sheet_id uuid unique references public.optyker_sheets(id) on delete set null,
  match_method text not null,
  imported_at timestamptz not null default now()
);
alter table private.optyker_focus_prescriptions enable row level security;
revoke all on private.optyker_focus_prescriptions from public,anon,authenticated;
grant all on private.optyker_focus_prescriptions to service_role;

-- Management-only importer; never exposed as an anonymous import endpoint.
create or replace function private.optyker_focus_rx_import(p_file text,p_hash text,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private,pg_temp as $$
declare
  item jsonb; r jsonb; c public.optyker_clients%rowtype; d public.optyker_oculists%rowtype;
  old private.optyker_focus_prescriptions%rowtype; elems jsonb; snap jsonb;
  eye text; side text; distance text; row_no integer; pair text[]; field text[];
  source_date timestamptz; date_text text; doc_date text; doc_name text; notes text;
  sid uuid; inserted integer:=0; skipped integer:=0; enabled boolean; op text;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>100 then raise exception 'Invalid import batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('optyker-focus-prescriptions',0));
  for item in select value from jsonb_array_elements(p_rows) loop
    r:=item->'row';
    if nullif(r->>'id','') is null or nullif(r->>'codiceCliente','') is null then raise exception 'Missing source identity'; end if;
    select * into old from private.optyker_focus_prescriptions where source_id=r->>'id';
    if found then
      if old.source_row<>r or old.client_id<>(item->>'client_id')::uuid then raise exception 'Previously imported row differs: %',r->>'id'; end if;
      skipped:=skipped+1;continue;
    end if;
    select * into c from public.optyker_clients where id=(item->>'client_id')::uuid;
    if not found then raise exception 'Client not found'; end if;
    if nullif(item->>'expected_fiscal','') is not null and lower(btrim(c.fiscal))<>lower(btrim(item->>'expected_fiscal')) then raise exception 'Client fiscal identity changed'; end if;
    if nullif(item->>'match_method','') is null then raise exception 'Missing matching evidence'; end if;
    source_date:=to_timestamp(r->>'data','MM/DD/YYYY HH24:MI:SS') at time zone 'UTC' at time zone 'Europe/Rome';
    date_text:=to_char(to_timestamp(r->>'data','MM/DD/YYYY HH24:MI:SS'),'DD/MM/YYYY');
    doc_name:=btrim(coalesce(r->>'prescrizione',''));enabled:=doc_name<>'';
    doc_date:=case when nullif(r->>'dataPrescrizione','') is null then '' else to_char(to_timestamp(r->>'dataPrescrizione','MM/DD/YYYY HH24:MI:SS'),'YYYY-MM-DD') end;
    d:=null;
    if enabled then
      select * into d from public.optyker_oculists where name_key=lower(regexp_replace(doc_name,'\s+',' ','g'));
      if not found then raise exception 'Oculist missing: %',doc_name; end if;
    end if;
    op:=coalesce(nullif(r->>'controllatoDa',''),case r->>'operatore' when 'MIC' then 'Michael Mologni' when 'GIO' then 'Giorgia' when 'DIE' then 'Diego' else r->>'operatore' end,'');
    elems:=jsonb_build_object('clientName',jsonb_build_object('kind','value','value',c.name),'clientSurname',jsonb_build_object('kind','value','value',c.surname),'examDate',jsonb_build_object('kind','value','value',date_text),'specialistName',jsonb_build_object('kind','value','value',op));
    foreach eye in array array['od','os'] loop
      side:=case eye when 'od' then 'Dx' else 'Sx' end;
      foreach pair slice 1 in array array[['L','1'],['V','2'],['M','3']] loop
        distance:=pair[1];row_no:=pair[2]::integer;
        foreach field slice 1 in array array[['sfera','sf'],['cilindro','cil'],['asse1','asse'],['add','add']] loop
          elems:=elems||jsonb_build_object('rx_'||eye||'_'||field[2]||'_'||row_no,jsonb_build_object('kind','value','value',coalesce(r->>(field[1]||distance||side),'')));
        end loop;
        elems:=elems||jsonb_build_object('rx_'||eye||'_distan_'||row_no,jsonb_build_object('kind','value','value',case when distance='L' then '∞' when distance='M' and (nullif(r->>('sferaM'||side),'') is not null or nullif(r->>('addM'||side),'') is not null) and nullif(r->>'distanzaMedio','') is not null then (r->>'distanzaMedio')||' cm' else '' end));
      end loop;
      elems:=elems||jsonb_build_object(
        'rx_'||eye||'_visus_1',jsonb_build_object('kind','value','value',coalesce(r->>('visus'||side||'Corr'),'')),
        'rx_'||eye||'_visus_4',jsonb_build_object('kind','value','value',coalesce(r->>('visus'||side||'Nat'),'')),
        case eye when 'od' then 'rxOdPrism' else 'rxOsPrism' end,jsonb_build_object('kind','value','value',coalesce(r->>('prismaL'||side),'')),
        case eye when 'od' then 'rxOdBase' else 'rxOsBase' end,jsonb_build_object('kind','value','value',coalesce(r->>('baseL'||side),'')),
        'rxPd'||upper(eye),jsonb_build_object('kind','value','value',coalesce(r->>('dIL'||side),'')),
        'rxPdNear'||upper(eye),jsonb_build_object('kind','value','value',coalesce(r->>('dIV'||side),''))
      );
    end loop;
    elems:=elems||jsonb_build_object('rxPdOO',jsonb_build_object('kind','value','value',coalesce(r->>'dIL','')),'rxPdNearOO',jsonb_build_object('kind','value','value',coalesce(r->>'dIV','')),'rx_od_voo_1',jsonb_build_object('kind','value','value',coalesce(r->>'visusBinCorr','')),'rx_od_voo_4',jsonb_build_object('kind','value','value',coalesce(r->>'visusBinNat','')),'rxNotationOS',jsonb_build_object('kind','value','value',case when r->>'sistema'='Internazionale' then 'international' else 'tabo' end));
    notes:='Importazione Focus · scheda '||(r->>'codiceOptometria')||E'\nRighe: lontano, vicino, medio; visus naturale nell’ultima riga.';
    if lower(coalesce(r->>'occhialeInUso',''))='true' then notes:=notes||E'\nOcchiale in uso.';end if;
    if doc_date<>'' and not enabled then notes:=notes||E'\nData prescrizione di origine: '||to_char(doc_date::date,'DD/MM/YYYY')||' (oculista non indicato).';end if;
    if coalesce(r->>'occhioDominanteL','Non Definito')<>'Non Definito' then notes:=notes||E'\nOcchio dominante lontano: '||(r->>'occhioDominanteL');end if;
    if coalesce(r->>'occhioDominanteV','Non Definito')<>'Non Definito' then notes:=notes||E'\nOcchio dominante vicino: '||(r->>'occhioDominanteV');end if;
    foreach field slice 1 in array array[['dIM','DI medio OO'],['dIMDx','DI medio OD'],['dIMSx','DI medio OS'],['prismaVerticaleDx','Prisma verticale OD'],['baseVerticaleDx','Base verticale OD'],['prismaOrizzontaleDx','Prisma orizzontale OD'],['baseOrizzontaleDx','Base orizzontale OD'],['prismaVerticaleSx','Prisma verticale OS'],['baseVerticaleSx','Base verticale OS'],['prismaOrizzontaleSx','Prisma orizzontale OS'],['baseOrizzontaleSx','Base orizzontale OS'],['forieVNat','Forie vicino naturali'],['forieLNat','Forie lontano naturali'],['forieVCorr','Forie vicino corrette'],['forieLCorr','Forie lontano corrette']] loop
      if coalesce(r->>field[1],'') not in ('','Non Definito') then notes:=notes||E'\n'||field[2]||': '||(r->>field[1]);end if;
    end loop;
    for row_no in 1..2 loop
      if nullif(r->>('richiamoData'||row_no),'') is not null then notes:=notes||E'\nRichiamo '||row_no||': '||to_char(to_timestamp(r->>('richiamoData'||row_no),'MM/DD/YYYY HH24:MI:SS'),'DD/MM/YYYY')||' · '||coalesce(r->>('richiamoMotivo'||row_no),'');end if;
    end loop;
    elems:=elems||jsonb_build_object('rxNotes',jsonb_build_object('kind','value','value',notes),'rxOphthalmic',jsonb_build_object('kind','check','checked',enabled),'rxOphthalmologistId',jsonb_build_object('kind','value','value',coalesce(d.id::text,'')),'rxOphthalmologistName',jsonb_build_object('kind','value','value',doc_name),'rxOphthalmicDate',jsonb_build_object('kind','value','value',doc_date));
    snap:=jsonb_build_object('version',1,'sheetType','prescription','sheetLabel',case when enabled then 'Prescrizione oculistica' else 'Prescrizione optometrica' end,'savedAt',source_date,'examDate',date_text,'specialist',op,'elements',elems,'ophthalmicPrescription',enabled,'ophthalmologist',case when enabled then jsonb_build_object('id',d.id,'name',d.name) else null end,'ophthalmicDate',doc_date,'focusImport',jsonb_build_object('source','focus_bludata','file',p_file,'sha256',p_hash,'sourceId',r->>'id','customerCode',r->>'codiceCliente','matchMethod',item->>'match_method','importedAt',now(),'record',r));
    insert into public.optyker_sheets(client_id,sheet_type,title,operator,data,created_at) values(c.id,'prescription',snap->>'sheetLabel',op,snap,source_date) returning id into sid;
    insert into private.optyker_focus_prescriptions(source_id,source_file,source_hash,source_row,client_id,sheet_id,match_method) values(r->>'id',p_file,p_hash,r,c.id,sid,item->>'match_method');
    inserted:=inserted+1;
  end loop;
  return jsonb_build_object('inserted',inserted,'already_imported',skipped);
end $$;
revoke all on function private.optyker_focus_rx_import(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.optyker_focus_rx_import(text,text,jsonb) to service_role;
