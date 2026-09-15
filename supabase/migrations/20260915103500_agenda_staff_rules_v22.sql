-- Agenda staff rules V22: absences, private notes, optional contact and Optyker-only overlap override.

alter table public.optyker_staff_day_schedule drop constraint if exists optyker_staff_day_schedule_status_check;
alter table public.optyker_staff_day_schedule add constraint optyker_staff_day_schedule_status_check
  check (status = any(array['work','sick','vacation','rest','permission','fair','other']::text[]));

alter table public.optyker_appointments
  add column if not exists staff_forced_overlap boolean not null default false,
  add column if not exists staff_forced_overlap_by text not null default '',
  add column if not exists staff_forced_overlap_at timestamptz;

alter table public.optyker_appointments drop constraint if exists optyker_appointments_no_operator_overlap;
alter table public.optyker_appointments drop constraint if exists optyker_appointments_no_studio_overlap;
alter table public.optyker_appointments add constraint optyker_appointments_no_operator_overlap
  exclude using gist (operator_username with =, tstzrange(starts_at,ends_at,'[)') with &&)
  where (status <> 'cancelled' and legacy_imported=false and staff_forced_overlap=false);
alter table public.optyker_appointments add constraint optyker_appointments_no_studio_overlap
  exclude using gist (studio_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
  where (status <> 'cancelled' and legacy_imported=false and staff_forced_overlap=false);

create or replace function public.optyker_operator_scheduled_for_interval(
  p_operator text,
  p_starts timestamptz,
  p_ends timestamptz
) returns boolean
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_user text;
  v_date date;
  v_start_local time;
  v_end_local time;
  v_status text;
  v_s1 time; v_e1 time; v_s2 time; v_e2 time;
  v_active boolean;
begin
  v_user:=upper(regexp_replace(trim(coalesce(p_operator,'')),'\s+',' ','g'));
  if v_user='' or p_starts is null or p_ends is null or p_ends<=p_starts then return false; end if;
  if not exists(select 1 from public.optyker_operator_profiles p where upper(p.username)=v_user) then return false; end if;
  v_date:=(p_starts at time zone 'Europe/Rome')::date;
  if (p_ends at time zone 'Europe/Rome')::date<>v_date then return false; end if;
  v_start_local:=(p_starts at time zone 'Europe/Rome')::time;
  v_end_local:=(p_ends at time zone 'Europe/Rome')::time;

  select s.status,s.start_time,s.end_time,s.start_time_2,s.end_time_2
    into v_status,v_s1,v_e1,v_s2,v_e2
  from public.optyker_staff_day_schedule s
  where s.schedule_date=v_date and upper(s.operator_username)=v_user
  limit 1;
  if found then
    if v_status<>'work' then return false; end if;
    return (
      (v_s1 is not null and v_e1 is not null and v_start_local>=v_s1 and v_end_local<=v_e1)
      or
      (v_s2 is not null and v_e2 is not null and v_start_local>=v_s2 and v_end_local<=v_e2)
    );
  end if;

  select coalesce(o.active,h.active,false),
         case when o.schedule_date is not null then o.start_time else h.start_time end,
         case when o.schedule_date is not null then o.end_time else h.end_time end,
         case when o.schedule_date is not null then o.start_time_2 else h.start_time_2 end,
         case when o.schedule_date is not null then o.end_time_2 else h.end_time_2 end
    into v_active,v_s1,v_e1,v_s2,v_e2
  from (select extract(isodow from v_date)::int wd) q
  left join public.optyker_store_hours h on h.weekday=q.wd
  left join public.optyker_store_day_schedule o on o.schedule_date=v_date;
  if coalesce(v_active,false)=false then return false; end if;
  return (
    (v_s1 is not null and v_e1 is not null and v_start_local>=v_s1 and v_end_local<=v_e1)
    or
    (v_s2 is not null and v_e2 is not null and v_start_local>=v_s2 and v_end_local<=v_e2)
  );
end $$;

create or replace function public.optyker_force_overlap_candidates(
  p_service_id uuid,
  p_starts timestamptz,
  p_operator text default null,
  p_studio_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_duration int;
  v_requires_studio boolean;
  v_ends timestamptz;
  v_data jsonb;
begin
  if p_starts is null or p_starts<=now() then return jsonb_build_object('ok',false,'error','Seleziona un orario futuro'); end if;
  select duration_minutes,requires_studio into v_duration,v_requires_studio
  from public.optyker_appointment_services where id=p_service_id and active=true;
  if v_duration is null then return jsonb_build_object('ok',false,'error','Servizio non disponibile'); end if;
  v_ends:=p_starts+make_interval(mins=>v_duration);

  with operators as (
    select p.username
    from public.optyker_operator_profiles p
    where (coalesce(trim(p_operator),'')='' or upper(p.username)=upper(trim(p_operator)))
      and (
        not exists(select 1 from public.optyker_appointment_service_operators so0 where so0.service_id=p_service_id)
        or exists(select 1 from public.optyker_appointment_service_operators so where so.service_id=p_service_id and upper(so.operator_username)=upper(p.username))
      )
      and public.optyker_operator_scheduled_for_interval(p.username,p_starts,v_ends)
  ), candidates as (
    select o.username operator_username,st.id studio_id,st.name studio_name,st.sort_order
    from operators o cross join public.optyker_appointment_studios st
    where v_requires_studio and st.active=true
      and (p_studio_id is null or st.id=p_studio_id)
      and (
        not exists(select 1 from public.optyker_appointment_service_studios ss0 where ss0.service_id=p_service_id)
        or exists(select 1 from public.optyker_appointment_service_studios ss where ss.service_id=p_service_id and ss.studio_id=st.id)
      )
    union all
    select o.username,null::uuid,'Nessuno studio'::text,0 from operators o where not v_requires_studio
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'operator_username',c.operator_username,'studio_id',c.studio_id,'studio_name',c.studio_name,
    'starts_at',p_starts,'ends_at',v_ends,'forced_overlap',true
  ) order by c.operator_username,c.sort_order,c.studio_name),'[]'::jsonb)
  into v_data from candidates c;
  return jsonb_build_object('ok',true,'data',v_data);
end $$;

create or replace function public.optyker_book_appointment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_service public.optyker_appointment_services%rowtype;
  v_starts timestamptz;
  v_requested_studio uuid;
  v_requested_operator text;
  v_client uuid;
  v_appt public.optyker_appointments%rowtype;
  v_source text;
  v_candidates jsonb;
  v_candidate record;
  v_force_time boolean:=coalesce((p_payload->>'force_time')::boolean,false);
  v_created_by text:=btrim(coalesce(p_payload->>'created_by',''));
  v_email text:=lower(btrim(coalesce(p_payload->>'email','')));
  v_phone text:=btrim(coalesce(p_payload->>'phone',''));
begin
  select * into v_service from public.optyker_appointment_services where id=nullif(p_payload->>'service_id','')::uuid and active=true;
  if v_service.id is null then return jsonb_build_object('ok',false,'error','Servizio non disponibile'); end if;
  v_starts:=nullif(p_payload->>'starts_at','')::timestamptz;
  v_requested_studio:=nullif(p_payload->>'studio_id','')::uuid;
  v_requested_operator:=btrim(coalesce(p_payload->>'operator_username',''));
  if v_starts is null then return jsonb_build_object('ok',false,'error','Data e orario obbligatori'); end if;
  if v_starts<=now() then return jsonb_build_object('ok',false,'error','Seleziona un orario futuro'); end if;
  if btrim(coalesce(p_payload->>'first_name',''))='' or btrim(coalesce(p_payload->>'last_name',''))='' then
    return jsonb_build_object('ok',false,'error','Nome e cognome sono obbligatori');
  end if;
  if v_email='' and v_phone='' then return jsonb_build_object('ok',false,'error','Inserisci almeno email oppure telefono'); end if;
  if v_force_time and not public.optyker_staff_can_force_appointment(v_created_by) then
    return jsonb_build_object('ok',false,'error','La forzatura è disponibile solo per gli account Optyker con email associata.');
  end if;
  if v_force_time then
    v_candidates:=public.optyker_force_available_studios(v_service.id,v_starts,null);
  else
    v_candidates:=public.optyker_appointment_slots(v_service.id,(v_starts at time zone 'Europe/Rome')::date,nullif(v_requested_operator,''),v_requested_studio,null);
  end if;
  select x.* into v_candidate
  from jsonb_to_recordset(coalesce(v_candidates->'data','[]'::jsonb)) as x(rule_id uuid,operator_username text,studio_id uuid,studio_name text,starts_at timestamptz,ends_at timestamptz,forced boolean)
  where x.starts_at=v_starts and (v_requested_studio is null or x.studio_id=v_requested_studio) and (v_requested_operator='' or upper(x.operator_username)=upper(v_requested_operator))
  order by x.operator_username,x.studio_name nulls last limit 1;
  if not found then return jsonb_build_object('ok',false,'error',case when v_requested_operator<>'' then 'L’operatore scelto non è disponibile in questo orario o non è in turno.' else 'Questo orario non è disponibile. Scegli un’altra fascia.' end); end if;

  begin v_client:=nullif(p_payload->>'client_id','')::uuid; exception when others then v_client:=null; end;
  if v_client is not null and not exists(select 1 from public.optyker_clients where id=v_client) then v_client:=null; end if;
  if v_client is null and v_email<>'' then select id into v_client from public.optyker_clients where lower(email)=v_email order by updated_at desc limit 1; end if;
  if v_client is null and v_phone<>'' then
    select id into v_client from public.optyker_clients
    where regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g') and regexp_replace(v_phone,'[^0-9]','','g')<>''
    order by updated_at desc limit 1;
  end if;
  v_source:=case when coalesce(p_payload->>'source','') in ('staff','shopify','mobile','web','app') then p_payload->>'source' else 'web' end;
  begin
    insert into public.optyker_appointments(service_id,studio_id,operator_username,client_id,first_name,last_name,email,phone,starts_at,ends_at,status,notes,private_notes,source,created_by)
    values(v_service.id,v_candidate.studio_id,v_candidate.operator_username,v_client,btrim(coalesce(p_payload->>'first_name','')),btrim(coalesce(p_payload->>'last_name','')),v_email,v_phone,v_candidate.starts_at,v_candidate.ends_at,'confirmed',btrim(coalesce(p_payload->>'notes','')),case when v_source='staff' then btrim(coalesce(p_payload->>'private_notes','')) else '' end,v_source,v_created_by)
    returning * into v_appt;
  exception when exclusion_violation then return jsonb_build_object('ok',false,'error','L’operatore o lo studio scelto è già occupato in questo orario.'); end;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('id',v_appt.id,'manage_token',v_appt.manage_token,'starts_at',v_appt.starts_at,'ends_at',v_appt.ends_at,'studio_id',v_appt.studio_id,'operator_username',v_appt.operator_username,'forced',v_force_time));
end $$;

create or replace function public.optyker_appointment_reschedule_internal(p_appointment_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_old public.optyker_appointments%rowtype;
  v_service_id uuid;
  v_starts timestamptz;
  v_studio uuid;
  v_operator text;
  v_candidates jsonb;
  v_candidate record;
  v_updated public.optyker_appointments%rowtype;
  v_status text;
  v_force_time boolean:=coalesce((p_payload->>'force_time')::boolean,false);
  v_force_overlap boolean;
  v_forced_by text:=btrim(coalesce(p_payload->>'forced_by',''));
  v_email text;
  v_phone text;
begin
  select * into v_old from public.optyker_appointments where id=p_appointment_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Appuntamento non trovato'); end if;
  v_service_id:=coalesce(nullif(p_payload->>'service_id','')::uuid,v_old.service_id);
  v_starts:=coalesce(nullif(p_payload->>'starts_at','')::timestamptz,v_old.starts_at);
  v_operator:=coalesce(nullif(btrim(p_payload->>'operator_username'),''),v_old.operator_username);
  if p_payload ? 'studio_id' then v_studio:=nullif(p_payload->>'studio_id','')::uuid; elsif v_force_time then v_studio:=null; else v_studio:=v_old.studio_id; end if;
  v_force_overlap:=case when p_payload ? 'force_overlap' then coalesce((p_payload->>'force_overlap')::boolean,false) else coalesce(v_old.staff_forced_overlap,false) end;
  if v_starts<=now() then return jsonb_build_object('ok',false,'error','Seleziona un orario futuro'); end if;
  if (v_force_time or v_force_overlap) and not public.optyker_staff_can_force_appointment(v_forced_by) then return jsonb_build_object('ok',false,'error','La forzatura è disponibile solo negli account Optyker autorizzati.'); end if;

  if v_force_overlap then
    v_candidates:=public.optyker_force_overlap_candidates(v_service_id,v_starts,v_operator,v_studio);
  elsif v_force_time then
    v_candidates:=public.optyker_force_available_studios(v_service_id,v_starts,p_appointment_id);
  else
    v_candidates:=public.optyker_appointment_slots(v_service_id,(v_starts at time zone 'Europe/Rome')::date,v_operator,v_studio,p_appointment_id);
  end if;
  select x.* into v_candidate
  from jsonb_to_recordset(coalesce(v_candidates->'data','[]'::jsonb)) as x(rule_id uuid,operator_username text,studio_id uuid,studio_name text,starts_at timestamptz,ends_at timestamptz,forced boolean,forced_overlap boolean)
  where x.starts_at=v_starts and (v_studio is null or x.studio_id=v_studio) and (coalesce(v_operator,'')='' or upper(x.operator_username)=upper(v_operator))
  order by x.operator_username,x.studio_name nulls last limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Operatore non in turno/assente, fascia o studio non valido.'); end if;

  v_status:=case when p_payload ? 'status' and p_payload->>'status' in ('confirmed','pending','completed','cancelled','no_show') then p_payload->>'status' else v_old.status end;
  v_email:=case when p_payload ? 'email' then lower(btrim(coalesce(p_payload->>'email',''))) else v_old.email end;
  v_phone:=case when p_payload ? 'phone' then btrim(coalesce(p_payload->>'phone','')) else v_old.phone end;
  if v_email='' and v_phone='' then return jsonb_build_object('ok',false,'error','Inserisci almeno email oppure telefono'); end if;
  begin
    update public.optyker_appointments set
      service_id=v_service_id,studio_id=v_candidate.studio_id,operator_username=v_candidate.operator_username,
      starts_at=v_candidate.starts_at,ends_at=v_candidate.ends_at,
      first_name=case when p_payload ? 'first_name' then btrim(coalesce(p_payload->>'first_name','')) else first_name end,
      last_name=case when p_payload ? 'last_name' then btrim(coalesce(p_payload->>'last_name','')) else last_name end,
      email=v_email,phone=v_phone,
      notes=case when p_payload ? 'notes' then coalesce(p_payload->>'notes','') else notes end,
      private_notes=case when p_payload ? 'private_notes' then coalesce(p_payload->>'private_notes','') else private_notes end,
      status=v_status,
      staff_forced_overlap=v_force_overlap,
      staff_forced_overlap_by=case when v_force_overlap then v_forced_by else '' end,
      staff_forced_overlap_at=case when v_force_overlap then now() else null end,
      updated_at=now()
    where id=p_appointment_id returning * into v_updated;
  exception when exclusion_violation then return jsonb_build_object('ok',false,'error','L’operatore o lo studio scelto è già occupato. Attiva “Forza orario occupato” se vuoi sovrapporre da Optyker.'); end;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_updated)||jsonb_build_object('forced',v_force_time,'forced_overlap',v_force_overlap));
end $$;

-- Add the explicit fair/transfer status to the existing authenticated shifts API.
do $$
declare d text; patched text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='optyker_staff_schedule_api' limit 1;
  if d is null then raise exception 'optyker_staff_schedule_api missing'; end if;
  if position($needle$'fair'$needle$ in d)=0 then
    patched:=replace(d,$old$('work','sick','vacation','rest','permission','other')$old$,$new$('work','sick','vacation','rest','permission','fair','other')$new$);
    if patched=d then raise exception 'Unable to patch fair status into optyker_staff_schedule_api'; end if;
    execute patched;
  end if;
end $$;

revoke all on function public.optyker_appointment_reschedule_internal(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_appointment_reschedule_internal(uuid,jsonb) to service_role;
revoke all on function public.optyker_force_overlap_candidates(uuid,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.optyker_force_overlap_candidates(uuid,timestamptz,text,uuid) to service_role;
revoke all on function public.optyker_operator_scheduled_for_interval(text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.optyker_operator_scheduled_for_interval(text,timestamptz,timestamptz) to service_role;
