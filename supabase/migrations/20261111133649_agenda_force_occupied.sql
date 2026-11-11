-- Agenda 20261111: «Forza appuntamento» books even when the studio or the operator is already busy.
--
-- Forcing is available only to Optyker staff accounts with a linked email (password checked by
-- optyker_appointments_api). It overrides opening hours, shifts and overlaps with other appointments.
-- It keeps the studios enabled for the service and never assigns an operator recorded as absent that
-- day (malattia, ferie, riposo, permesso, fiera, altro): the operator can always be left unassigned.
-- Ordinary and public booking are unchanged, and the exclusion constraints still protect every
-- appointment that is not an explicit forced overlap.

-- Forced options: every operator not absent (or none) x every studio enabled for the service,
-- busy ones included and marked, free combinations first.
create or replace function public.optyker_force_booking_candidates(
  p_service_id uuid,
  p_starts timestamptz,
  p_ignore_appointment_id uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path=public,extensions,pg_temp
as $$
declare
  v_duration int;
  v_requires_studio boolean;
  v_ends timestamptz;
  v_date date;
  v_data jsonb;
begin
  if p_starts is null then return jsonb_build_object('ok',false,'error','Data e orario obbligatori'); end if;
  if p_starts<=now() then return jsonb_build_object('ok',false,'error','Seleziona un orario futuro'); end if;
  select duration_minutes,requires_studio into v_duration,v_requires_studio
  from public.optyker_appointment_services where id=p_service_id and active;
  if v_duration is null then return jsonb_build_object('ok',false,'error','Servizio non disponibile'); end if;
  v_ends:=p_starts+make_interval(mins=>v_duration);
  v_date:=(p_starts at time zone 'Europe/Rome')::date;

  with operators as (
    select p.username
    from public.optyker_operator_profiles p
    where (
        not exists(select 1 from public.optyker_appointment_service_operators so0 where so0.service_id=p_service_id)
        or exists(select 1 from public.optyker_appointment_service_operators so
                  where so.service_id=p_service_id and upper(so.operator_username)=upper(p.username))
      )
      and not exists(select 1 from public.optyker_staff_day_schedule s
                     where s.schedule_date=v_date and upper(s.operator_username)=upper(p.username) and s.status<>'work')
    union all
    select null::text
  ), studios as (
    select st.id,st.name,st.sort_order
    from public.optyker_appointment_studios st
    where v_requires_studio and st.active
      and (
        not exists(select 1 from public.optyker_appointment_service_studios ss0 where ss0.service_id=p_service_id)
        or exists(select 1 from public.optyker_appointment_service_studios ss where ss.service_id=p_service_id and ss.studio_id=st.id)
      )
    union all
    select null::uuid,'Nessuno studio'::text,0 where not v_requires_studio
  ), candidates as (
    select o.username operator_username,s.id studio_id,s.name studio_name,s.sort_order,
      (s.id is not null and exists(
        select 1 from public.optyker_appointments a
        where a.status<>'cancelled' and a.studio_id=s.id
          and (p_ignore_appointment_id is null or a.id<>p_ignore_appointment_id)
          and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts,v_ends,'[)'))) studio_busy,
      (o.username is not null and exists(
        select 1 from public.optyker_appointments a
        where a.status<>'cancelled' and upper(a.operator_username)=upper(o.username)
          and (p_ignore_appointment_id is null or a.id<>p_ignore_appointment_id)
          and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts,v_ends,'[)'))) operator_busy
    from operators o cross join studios s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'operator_username',c.operator_username,'studio_id',c.studio_id,'studio_name',c.studio_name,
    'starts_at',p_starts,'ends_at',v_ends,'forced',true,
    'studio_busy',c.studio_busy,'operator_busy',c.operator_busy,'overlap',c.studio_busy or c.operator_busy
  ) order by c.operator_username nulls first,(c.studio_busy or c.operator_busy),c.sort_order,c.studio_name),'[]'::jsonb)
  into v_data from candidates c;
  return jsonb_build_object('ok',true,'data',v_data);
end $$;

-- Forced creation, with or without operator. A free studio is preferred when none is chosen; an
-- appointment that overlaps another one is stored as an explicit staff forced overlap.
create or replace function public.optyker_book_forced_staff(p_username text,p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,extensions,pg_temp
as $$
declare
  v_actor text;
  v_service uuid;
  v_starts timestamptz;
  v_studio uuid;
  v_operator text:=nullif(btrim(coalesce(p_payload->>'operator_username','')),'');
  v_email text:=lower(btrim(coalesce(p_payload->>'email','')));
  v_phone text:=btrim(coalesce(p_payload->>'phone',''));
  v_rows jsonb;
  v_candidate record;
  v_overlap boolean;
  v_client uuid;
  v_appt public.optyker_appointments%rowtype;
begin
  select p.username into v_actor from public.optyker_operator_profiles p
  where upper(p.username)=upper(btrim(coalesce(p_username,''))) limit 1;
  if v_actor is null or not public.optyker_staff_can_force_appointment(v_actor)
     or not coalesce((p_payload->>'force_time')::boolean,false) then
    return jsonb_build_object('ok',false,'error','Forzatura non autorizzata.');
  end if;
  begin
    v_service:=nullif(p_payload->>'service_id','')::uuid;
    v_starts:=nullif(p_payload->>'starts_at','')::timestamptz;
    v_studio:=nullif(p_payload->>'studio_id','')::uuid;
  exception when others then
    return jsonb_build_object('ok',false,'error','Dati appuntamento non validi.');
  end;
  if v_starts is null or v_starts<=now() then return jsonb_build_object('ok',false,'error','Seleziona un orario futuro.'); end if;
  if btrim(coalesce(p_payload->>'first_name',''))='' or btrim(coalesce(p_payload->>'last_name',''))='' then
    return jsonb_build_object('ok',false,'error','Nome e cognome sono obbligatori.');
  end if;
  if v_email='' and v_phone='' then return jsonb_build_object('ok',false,'error','Inserisci almeno email oppure telefono.'); end if;

  v_rows:=public.optyker_force_booking_candidates(v_service,v_starts,null);
  if not coalesce((v_rows->>'ok')::boolean,false) then return v_rows; end if;
  select e.value->>'operator_username' operator_username,
         nullif(e.value->>'studio_id','')::uuid studio_id,
         (e.value->>'starts_at')::timestamptz starts_at,
         (e.value->>'ends_at')::timestamptz ends_at,
         coalesce((e.value->>'overlap')::boolean,false) overlap
    into v_candidate
  from jsonb_array_elements(coalesce(v_rows->'data','[]'::jsonb)) with ordinality e(value,ord)
  where ((v_operator is null and e.value->>'operator_username' is null)
         or upper(e.value->>'operator_username')=upper(v_operator))
    and (v_studio is null or nullif(e.value->>'studio_id','')::uuid=v_studio)
  order by e.ord
  limit 1;
  if not found then
    return jsonb_build_object('ok',false,'error',case
      when v_operator is not null and not exists(
        select 1 from jsonb_array_elements(coalesce(v_rows->'data','[]'::jsonb)) e
        where upper(e.value->>'operator_username')=upper(v_operator))
        then 'L’operatore scelto è segnato assente in quel giorno o non è abilitato per questo servizio.'
      when v_studio is not null then 'Lo studio scelto non è attivo o non è abilitato per questo servizio.'
      else 'Nessuno studio attivo è collegato a questo servizio.' end);
  end if;

  begin v_client:=nullif(p_payload->>'client_id','')::uuid; exception when others then v_client:=null; end;
  if v_client is not null and not exists(select 1 from public.optyker_clients where id=v_client) then v_client:=null; end if;
  if v_client is null and v_email<>'' then
    select id into v_client from public.optyker_clients where lower(email)=v_email order by updated_at desc limit 1;
  end if;
  if v_client is null and v_phone<>'' then
    select id into v_client from public.optyker_clients
    where regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g')
      and regexp_replace(v_phone,'[^0-9]','','g')<>''
    order by updated_at desc limit 1;
  end if;

  v_overlap:=v_candidate.overlap;
  loop
    begin
      insert into public.optyker_appointments(service_id,studio_id,operator_username,client_id,first_name,last_name,
        email,phone,starts_at,ends_at,status,notes,private_notes,source,created_by,
        staff_forced_overlap,staff_forced_overlap_by,staff_forced_overlap_at)
      values(v_service,v_candidate.studio_id,v_candidate.operator_username,v_client,
        btrim(p_payload->>'first_name'),btrim(p_payload->>'last_name'),v_email,v_phone,
        v_candidate.starts_at,v_candidate.ends_at,'confirmed',btrim(coalesce(p_payload->>'notes','')),
        btrim(coalesce(p_payload->>'private_notes','')),'staff',v_actor,
        v_overlap,case when v_overlap then v_actor else '' end,case when v_overlap then now() end)
      returning * into v_appt;
      exit;
    exception when exclusion_violation then
      -- Booked meanwhile by someone else: the forced appointment is kept as an overlap.
      if v_overlap then raise; end if;
      v_overlap:=true;
    end;
  end loop;

  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'id',v_appt.id,'manage_token',v_appt.manage_token,'starts_at',v_appt.starts_at,'ends_at',v_appt.ends_at,
    'studio_id',v_appt.studio_id,'operator_username',v_appt.operator_username,
    'forced',true,'forced_overlap',v_appt.staff_forced_overlap));
end $$;

-- Same rule for the previous unassigned-only entry point.
create or replace function public.optyker_book_unassigned_staff(p_username text,p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,extensions,pg_temp
as $$
begin
  if btrim(coalesce(p_payload->>'operator_username',''))<>'' then
    return jsonb_build_object('ok',false,'error','Forzatura non autorizzata.');
  end if;
  return public.optyker_book_forced_staff(p_username,p_payload);
end $$;

revoke all on function public.optyker_force_booking_candidates(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.optyker_force_booking_candidates(uuid,timestamptz,uuid) to service_role;
revoke all on function public.optyker_book_forced_staff(text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_book_forced_staff(text,jsonb) to service_role;
revoke all on function public.optyker_book_unassigned_staff(text,jsonb) from public,anon,authenticated;
grant execute on function public.optyker_book_unassigned_staff(text,jsonb) to service_role;

-- Route the authenticated staff API: forced options and every forced creation (operator or not).
-- All other agenda actions, including ordinary and public booking, stay as they are.
do $patch$
declare
  body text;
  pair text[];
  pairs text[][]:=array[
    array[$o$v_result:=public.optyker_force_available_studios(nullif(p_payload->>'service_id','')::uuid,nullif(p_payload->>'starts_at','')::timestamptz,nullif(p_payload->>'ignore_appointment_id','')::uuid);$o$,
          $n$return public.optyker_force_booking_candidates(nullif(p_payload->>'service_id','')::uuid,nullif(p_payload->>'starts_at','')::timestamptz,nullif(p_payload->>'ignore_appointment_id','')::uuid);$n$],
    array[$o$if not coalesce((v_result->>'ok')::boolean,false) then return v_result; end if;$o$,
          $n$$n$],
    array[$o$return jsonb_set(v_result,'{data}',coalesce(v_result->'data','[]'::jsonb)||public.optyker_unassigned_force_slots(nullif(p_payload->>'service_id','')::uuid,nullif(p_payload->>'starts_at','')::timestamptz));$o$,
          $n$$n$],
    array[$o$if coalesce((p_payload->>'force_time')::boolean,false) and btrim(coalesce(p_payload->>'operator_username',''))='' then$o$,
          $n$if coalesce((p_payload->>'force_time')::boolean,false) then$n$],
    array[$o$return public.optyker_book_unassigned_staff(p_username,p_payload);$o$,
          $n$return public.optyker_book_forced_staff(p_username,p_payload);$n$]
  ];
begin
  select pg_get_functiondef('public.optyker_appointments_api(text,text,text,jsonb)'::regprocedure) into body;
  foreach pair slice 1 in array pairs loop
    if (length(body)-length(replace(body,pair[1],'')))/length(pair[1])<>1 then
      raise exception 'optyker_appointments_api changed, expected once: %',pair[1];
    end if;
    body:=replace(body,pair[1],pair[2]);
  end loop;
  if strpos(body,'optyker_unassigned_force_slots')>0 or strpos(body,'optyker_force_available_studios')>0
     or strpos(body,'optyker_book_unassigned_staff')>0 then
    raise exception 'optyker_appointments_api still uses the previous force rules';
  end if;
  execute body;
end $patch$;

-- Self-check on the real configuration, entirely rolled back (subtransaction): the migration fails
-- if the new rules do not hold. Skipped on a database without staff accounts or services (new branch).
do $check$
declare
  actor text; plain_op text; absent_op text;
  service uuid; no_studio uuid; studio uuid; starts timestamptz; day date;
  payload jsonb; r jsonb; rows jsonb; first_id uuid; blocked boolean:=false;
begin
  select username into actor from public.optyker_operator_profiles
  where public.optyker_staff_can_force_appointment(username) order by username limit 1;
  if actor is null then return; end if;
  select s.id into service from public.optyker_appointment_services s
  where s.active and s.requires_studio
    and (not exists(select 1 from public.optyker_appointment_service_operators so where so.service_id=s.id)
      or exists(select 1 from public.optyker_appointment_service_operators so where so.service_id=s.id and upper(so.operator_username)=upper(actor)))
    and exists(select 1 from public.optyker_appointment_studios st where st.active
      and (not exists(select 1 from public.optyker_appointment_service_studios ss where ss.service_id=s.id)
        or exists(select 1 from public.optyker_appointment_service_studios ss where ss.service_id=s.id and ss.studio_id=st.id)))
  order by s.name limit 1;
  if service is null then return; end if;
  select username into plain_op from public.optyker_operator_profiles
  where not public.optyker_staff_can_force_appointment(username) order by username limit 1;
  select id into no_studio from public.optyker_appointment_services where active and not requires_studio order by name limit 1;
  select p.username into absent_op from public.optyker_operator_profiles p
  where upper(p.username)<>upper(actor)
    and (not exists(select 1 from public.optyker_appointment_service_operators so where so.service_id=service)
      or exists(select 1 from public.optyker_appointment_service_operators so
                where so.service_id=service and upper(so.operator_username)=upper(p.username)))
  order by p.username limit 1;

  begin
    starts:=((current_date+60)::text||' 03:00 Europe/Rome')::timestamptz; -- outside opening hours
    day:=(starts at time zone 'Europe/Rome')::date;
    delete from public.optyker_staff_day_schedule where schedule_date=day
      and upper(operator_username) in (upper(actor),upper(coalesce(absent_op,actor)));
    if absent_op is not null then
      insert into public.optyker_staff_day_schedule(schedule_date,operator_username,status) values(day,absent_op,'vacation');
    end if;
    payload:=jsonb_build_object('service_id',service,'starts_at',starts,'force_time',true,
      'first_name','SYNTHETIC','last_name','FORCE OCCUPIED CHECK','email','agenda-force-rollback@example.invalid','phone','',
      'private_notes','private test');

    -- Free studio first, ordinary row.
    r:=public.optyker_book_forced_staff(actor,payload);
    assert r->>'ok'='true',r::text;
    first_id:=(r#>>'{data,id}')::uuid;
    studio:=(r#>>'{data,studio_id}')::uuid;
    assert studio is not null and r#>>'{data,forced_overlap}'='false',r::text;
    assert exists(select 1 from public.optyker_appointments where id=first_id and operator_username is null and source='staff'
      and upper(created_by)=upper(actor) and private_notes='private test' and not staff_forced_overlap);

    -- Busy studio still offered and marked; absent operator not offered.
    rows:=public.optyker_force_booking_candidates(service,starts,null);
    assert rows->>'ok'='true',rows::text;
    assert exists(select 1 from jsonb_array_elements(rows->'data') e where e.value->>'operator_username' is null
      and (e.value->>'studio_id')::uuid=studio and (e.value->>'studio_busy')::boolean and (e.value->>'overlap')::boolean),rows::text;
    assert exists(select 1 from jsonb_array_elements(rows->'data') e where upper(e.value->>'operator_username')=upper(actor)),rows::text;
    if absent_op is not null then
      assert not exists(select 1 from jsonb_array_elements(rows->'data') e where upper(e.value->>'operator_username')=upper(absent_op)),rows::text;
      r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('operator_username',absent_op));
      assert r->>'ok'='false' and r->>'error' like '%assente%',r::text;
    end if;

    -- Same studio and same operator at the same time: booked as explicit forced overlaps.
    r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('studio_id',studio));
    assert r->>'ok'='true' and (r#>>'{data,studio_id}')::uuid=studio and r#>>'{data,forced_overlap}'='true',r::text;
    assert exists(select 1 from public.optyker_appointments where id=(r#>>'{data,id}')::uuid and staff_forced_overlap
      and upper(staff_forced_overlap_by)=upper(actor) and staff_forced_overlap_at is not null);
    r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('studio_id',studio,'operator_username',lower(actor)));
    assert r->>'ok'='true' and upper(r#>>'{data,operator_username}')=upper(actor) and r#>>'{data,forced_overlap}'='true',r::text;
    r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('operator_username',actor));
    assert r->>'ok'='true' and r#>>'{data,forced_overlap}'='true',r::text;
    rows:=public.optyker_force_booking_candidates(service,starts,null);
    assert exists(select 1 from jsonb_array_elements(rows->'data') e
      where upper(e.value->>'operator_username')=upper(actor) and (e.value->>'operator_busy')::boolean),rows::text;
    assert public.optyker_book_forced_staff(actor,payload||jsonb_build_object('studio_id',gen_random_uuid()))->>'ok'='false';

    -- Staff-only; public and ordinary booking unchanged.
    assert public.optyker_book_forced_staff(actor,payload||'{"force_time":false}'::jsonb)->>'ok'='false';
    assert public.optyker_book_forced_staff('__NOT_A_STAFF_ACCOUNT__',payload)->>'ok'='false';
    if plain_op is not null then assert public.optyker_book_forced_staff(plain_op,payload)->>'ok'='false'; end if;
    assert public.optyker_book_unassigned_staff(actor,payload||jsonb_build_object('operator_username',actor))->>'ok'='false';
    assert public.optyker_book_unassigned_staff(actor,payload||jsonb_build_object('studio_id',studio))->>'ok'='true';
    assert public.optyker_appointments_api('__NOT_A_STAFF_ACCOUNT__','invalid','appointment_create',payload)->>'ok'='false';
    assert public.optyker_appointments_api('__NOT_A_STAFF_ACCOUNT__','invalid','force_studios',payload)->>'ok'='false';
    assert public.optyker_book_appointment(payload)->>'ok'='false','Public booking must not obtain staff override';
    assert public.optyker_book_appointment(payload||'{"force_time":false}'::jsonb)->>'ok'='false','Public booking keeps opening hours';
    assert not has_function_privilege('anon','public.optyker_book_forced_staff(text,jsonb)','execute');
    assert not has_function_privilege('authenticated','public.optyker_book_forced_staff(text,jsonb)','execute');
    assert not has_function_privilege('anon','public.optyker_force_booking_candidates(uuid,timestamptz,uuid)','execute');
    assert not has_function_privilege('authenticated','public.optyker_force_booking_candidates(uuid,timestamptz,uuid)','execute');
    assert not has_function_privilege('anon','public.optyker_book_unassigned_staff(text,jsonb)','execute');
    begin
      insert into public.optyker_appointments(service_id,studio_id,first_name,last_name,email,phone,starts_at,ends_at,source)
      select service_id,studio_id,'SYNTHETIC','ORDINARY',email,phone,starts_at,ends_at,'staff'
      from public.optyker_appointments where id=first_id;
    exception when exclusion_violation then blocked:=true;
    end;
    assert blocked,'An ordinary overlap must still be rejected';
    if no_studio is not null then
      assert public.optyker_book_forced_staff(actor,payload||jsonb_build_object('service_id',no_studio))->>'ok'='true';
      assert public.optyker_book_forced_staff(actor,payload||jsonb_build_object('service_id',no_studio))->>'ok'='true';
    end if;

    raise exception 'OPTYKER_FORCE_OCCUPIED_CHECK_OK';
  exception when others then
    -- Rolls back every synthetic row; failed assertions are not caught here and abort the migration.
    if sqlerrm<>'OPTYKER_FORCE_OCCUPIED_CHECK_OK' then raise; end if;
  end;
end $check$;
