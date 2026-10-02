-- Staff may explicitly leave a forced appointment unassigned, including one
-- originally booked on the public website. Preserve its original source.
alter table public.optyker_appointments drop constraint optyker_unassigned_staff_only;
alter table public.optyker_appointments add constraint optyker_unassigned_staff_only
  check (operator_username is not null or source='staff' or staff_forced_overlap);

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
    union all select null::text where coalesce(trim(p_operator),'')=''
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
  v_operator:=case when p_payload ? 'operator_username' then nullif(btrim(p_payload->>'operator_username'),'') else v_old.operator_username end;
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
  where x.starts_at=v_starts and (v_studio is null or x.studio_id=v_studio) and ((v_operator is null and x.operator_username is null) or upper(x.operator_username)=upper(v_operator))
  order by x.operator_username,x.studio_name nulls last limit 1;
  if not found then
    -- Keep an existing appointment editable without selecting a new ordinary slot.
    if v_service_id=v_old.service_id and v_starts=v_old.starts_at
      and v_operator is not distinct from v_old.operator_username
      and v_studio is not distinct from v_old.studio_id
      and v_force_overlap=coalesce(v_old.staff_forced_overlap,false) then
      select null::uuid rule_id,v_old.operator_username operator_username,v_old.studio_id studio_id,
        ''::text studio_name,v_old.starts_at starts_at,v_old.ends_at ends_at,false forced,v_force_overlap forced_overlap
        into v_candidate;
    else return jsonb_build_object('ok',false,'error','Operatore non in turno/assente, fascia o studio non valido.'); end if;
  end if;
  -- A manually edited duration belongs to the appointment, not the service default.
  if v_service_id=v_old.service_id then v_candidate.ends_at:=v_starts+(v_old.ends_at-v_old.starts_at); end if;
  if not v_force_overlap and exists(select 1 from public.optyker_appointments a
    where a.id<>p_appointment_id and a.status<>'cancelled'
    and ((v_candidate.studio_id is not null and a.studio_id=v_candidate.studio_id)
      or (v_candidate.operator_username is not null and upper(a.operator_username)=upper(v_candidate.operator_username)))
    and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_candidate.starts_at,v_candidate.ends_at,'[)')) then
    return jsonb_build_object('ok',false,'error','La durata dell’appuntamento si sovrappone a un altro appuntamento.');
  end if;

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


-- Called only after the caller has authenticated staff credentials, verified
-- a linked email session, or resolved an existing private staff access token.
create or replace function public.optyker_appointment_set_duration(
  p_username text,p_appointment_id uuid,p_minutes integer,p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security invoker set search_path=public,extensions,pg_temp as $$
declare a public.optyker_appointments%rowtype; v_end timestamptz;
begin
  if not public.optyker_staff_can_force_appointment(p_username) then
    return jsonb_build_object('ok',false,'error','Accedi con un account operatore Optyker con email collegata.'); end if;
  if p_minutes is null or p_minutes<1 or p_minutes>1440 then
    return jsonb_build_object('ok',false,'error','Inserisci una durata tra 1 e 1440 minuti.'); end if;
  select * into a from public.optyker_appointments where id=p_appointment_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Appuntamento non trovato.'); end if;
  if a.starts_at<=now() or a.status not in ('pending','confirmed') then
    return jsonb_build_object('ok',false,'error','Puoi modificare la durata degli appuntamenti futuri attivi.'); end if;
  if p_expected_updated_at is not null and a.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok',false,'error','L’appuntamento è stato modificato. Riaprilo prima di salvare.'); end if;
  v_end:=a.starts_at+make_interval(mins=>p_minutes);
  if not a.staff_forced_overlap and exists(select 1 from public.optyker_appointments b
    where b.id<>a.id and b.status<>'cancelled'
    and ((a.studio_id is not null and b.studio_id=a.studio_id)
      or (a.operator_username is not null and upper(b.operator_username)=upper(a.operator_username)))
    and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(a.starts_at,v_end,'[)')) then
    return jsonb_build_object('ok',false,'error','La nuova durata si sovrappone a un altro appuntamento dello stesso operatore o studio.'); end if;
  begin
    update public.optyker_appointments set ends_at=v_end,updated_at=clock_timestamp()
      where id=a.id returning * into a;
  exception when exclusion_violation then
    return jsonb_build_object('ok',false,'error','La nuova durata si sovrappone a un altro appuntamento.');
  end;
  return jsonb_build_object('ok',true,'data',to_jsonb(a));
end $$;
revoke all on function public.optyker_appointment_set_duration(text,uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.optyker_appointment_set_duration(text,uuid,integer,timestamptz) to service_role;
revoke all on function public.optyker_appointment_reschedule_internal(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_appointment_reschedule_internal(uuid,jsonb) to service_role;
revoke all on function public.optyker_force_overlap_candidates(uuid,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.optyker_force_overlap_candidates(uuid,timestamptz,text,uuid) to service_role;
