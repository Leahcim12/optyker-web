-- Unassigned appointments are created only through the authenticated staff API.
-- Public/customer booking and named-operator availability keep their existing rules.
alter table public.optyker_appointments alter column operator_username drop not null;
alter table public.optyker_appointments add constraint optyker_unassigned_staff_only
  check (operator_username is not null or source='staff');

create or replace function public.optyker_unassigned_force_slots(p_service_id uuid,p_starts timestamptz)
returns jsonb language sql stable security invoker set search_path=public,extensions,pg_temp as $$
  with service as (
    select id,duration_minutes,requires_studio from public.optyker_appointment_services
    where id=p_service_id and active and p_starts>now()
  ), candidates as (
    select st.id studio_id,st.name studio_name,st.sort_order,s.duration_minutes
    from service s cross join public.optyker_appointment_studios st
    where s.requires_studio and st.active
    and (not exists(select 1 from public.optyker_appointment_service_studios ss where ss.service_id=s.id)
      or exists(select 1 from public.optyker_appointment_service_studios ss where ss.service_id=s.id and ss.studio_id=st.id))
    and not exists(select 1 from public.optyker_appointments a where a.studio_id=st.id and a.status<>'cancelled'
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts,p_starts+make_interval(mins=>s.duration_minutes),'[)'))
    union all select null::uuid,'Nessuno studio',0,s.duration_minutes from service s where not s.requires_studio
  )
  select coalesce(jsonb_agg(jsonb_build_object('studio_id',studio_id,'studio_name',studio_name,
    'operator_username',null,'starts_at',p_starts,'ends_at',p_starts+make_interval(mins=>duration_minutes),
    'forced',true) order by sort_order,studio_name),'[]'::jsonb) from candidates;
$$;
revoke all on function public.optyker_unassigned_force_slots(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.optyker_unassigned_force_slots(uuid,timestamptz) to service_role;

create or replace function public.optyker_book_unassigned_staff(p_username text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public,extensions,pg_temp as $$
declare
  v_service uuid:=nullif(p_payload->>'service_id','')::uuid;
  v_starts timestamptz:=nullif(p_payload->>'starts_at','')::timestamptz;
  v_studio uuid:=nullif(p_payload->>'studio_id','')::uuid;
  v_email text:=lower(btrim(coalesce(p_payload->>'email','')));
  v_phone text:=btrim(coalesce(p_payload->>'phone',''));
  v_client uuid; v_candidate record; v_appt public.optyker_appointments%rowtype;
begin
  if not public.optyker_staff_can_force_appointment(p_username)
    or not coalesce((p_payload->>'force_time')::boolean,false)
    or btrim(coalesce(p_payload->>'operator_username',''))<>'' then
    return jsonb_build_object('ok',false,'error','Forzatura non autorizzata.');
  end if;
  if v_starts is null or v_starts<=now() then return jsonb_build_object('ok',false,'error','Seleziona un orario futuro.'); end if;
  if btrim(coalesce(p_payload->>'first_name',''))='' or btrim(coalesce(p_payload->>'last_name',''))='' then
    return jsonb_build_object('ok',false,'error','Nome e cognome sono obbligatori.'); end if;
  if v_email='' and v_phone='' then return jsonb_build_object('ok',false,'error','Inserisci almeno email oppure telefono.'); end if;
  select x.* into v_candidate from jsonb_to_recordset(public.optyker_unassigned_force_slots(v_service,v_starts))
    as x(studio_id uuid,starts_at timestamptz,ends_at timestamptz)
    where v_studio is null or x.studio_id=v_studio limit 1;
  if not found then return jsonb_build_object('ok',false,'error','Nessuno studio libero per il servizio in questo orario.'); end if;
  begin v_client:=nullif(p_payload->>'client_id','')::uuid; exception when others then v_client:=null; end;
  if v_client is not null and not exists(select 1 from public.optyker_clients where id=v_client) then v_client:=null; end if;
  if v_client is null and v_email<>'' then select id into v_client from public.optyker_clients where lower(email)=v_email order by updated_at desc limit 1; end if;
  if v_client is null and v_phone<>'' then select id into v_client from public.optyker_clients where
    regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g')
    and regexp_replace(v_phone,'[^0-9]','','g')<>'' order by updated_at desc limit 1; end if;
  begin
    insert into public.optyker_appointments(service_id,studio_id,operator_username,client_id,
      first_name,last_name,email,phone,starts_at,ends_at,status,notes,private_notes,source,created_by)
    values(v_service,v_candidate.studio_id,null,v_client,btrim(p_payload->>'first_name'),btrim(p_payload->>'last_name'),
      v_email,v_phone,v_candidate.starts_at,v_candidate.ends_at,'confirmed',btrim(coalesce(p_payload->>'notes','')),
      btrim(coalesce(p_payload->>'private_notes','')),'staff',p_username) returning * into v_appt;
  exception when exclusion_violation then return jsonb_build_object('ok',false,'error','Lo studio scelto è già occupato in questo orario.'); end;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('id',v_appt.id,'manage_token',v_appt.manage_token,
    'starts_at',v_appt.starts_at,'ends_at',v_appt.ends_at,'studio_id',v_appt.studio_id,'operator_username',null,'forced',true));
end $$;
revoke all on function public.optyker_book_unassigned_staff(text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_book_unassigned_staff(text,jsonb) to service_role;

-- Retain the existing authentication gate and all unrelated agenda operations.
do $patch$
declare body text; old text; replacement text;
begin
  select pg_get_functiondef('public.optyker_appointments_api(text,text,text,jsonb)'::regprocedure) into body;
  old:='return public.optyker_force_available_studios(nullif(p_payload->>''service_id'','''')::uuid,nullif(p_payload->>''starts_at'','''')::timestamptz,nullif(p_payload->>''ignore_appointment_id'','''')::uuid);';
  replacement:='v_result:=public.optyker_force_available_studios(nullif(p_payload->>''service_id'','''')::uuid,nullif(p_payload->>''starts_at'','''')::timestamptz,nullif(p_payload->>''ignore_appointment_id'','''')::uuid);
  if not coalesce((v_result->>''ok'')::boolean,false) then return v_result; end if;
  return jsonb_set(v_result,''{data}'',coalesce(v_result->''data'',''[]''::jsonb)||public.optyker_unassigned_force_slots(nullif(p_payload->>''service_id'','''')::uuid,nullif(p_payload->>''starts_at'','''')::timestamptz));';
  if strpos(body,old)=0 then raise exception 'Expected force_studios contract missing'; end if;
  body:=replace(body,old,replacement);
  old:='elsif p_action=''appointment_create'' then';
  replacement:=old||'
  if coalesce((p_payload->>''force_time'')::boolean,false) and btrim(coalesce(p_payload->>''operator_username'',''''))='''' then
    return public.optyker_book_unassigned_staff(p_username,p_payload);
  end if;';
  if strpos(body,old)=0 then raise exception 'Expected appointment_create contract missing'; end if;
  execute replace(body,old,replacement);
end $patch$;
