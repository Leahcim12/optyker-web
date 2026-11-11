-- Transactional regression: every synthetic appointment and absence is rolled back.
begin;
do $$
declare
  actor text; plain_op text; absent_op text;
  service uuid; no_studio uuid; studio uuid; starts timestamptz; day date;
  payload jsonb; r jsonb; rows jsonb; first_id uuid; api_src text; blocked boolean:=false;
begin
  select username into actor from public.optyker_operator_profiles
  where public.optyker_staff_can_force_appointment(username) order by username limit 1;
  select username into plain_op from public.optyker_operator_profiles
  where not public.optyker_staff_can_force_appointment(username) order by username limit 1;
  select id into service from public.optyker_appointment_services where active and requires_studio order by name limit 1;
  select id into no_studio from public.optyker_appointment_services where active and not requires_studio order by name limit 1;
  select p.username into absent_op from public.optyker_operator_profiles p
  where upper(p.username)<>upper(actor)
    and (not exists(select 1 from public.optyker_appointment_service_operators so where so.service_id=service)
      or exists(select 1 from public.optyker_appointment_service_operators so
                where so.service_id=service and upper(so.operator_username)=upper(p.username)))
  order by p.username limit 1;
  assert actor is not null and service is not null and no_studio is not null and absent_op is not null;

  starts:=((current_date+60)::text||' 03:00 Europe/Rome')::timestamptz; -- outside opening hours
  day:=(starts at time zone 'Europe/Rome')::date;
  delete from public.optyker_staff_day_schedule where schedule_date=day and upper(operator_username) in (upper(actor),upper(absent_op));
  insert into public.optyker_staff_day_schedule(schedule_date,operator_username,status) values(day,absent_op,'vacation');
  payload:=jsonb_build_object('service_id',service,'starts_at',starts,'force_time',true,
    'first_name','SYNTHETIC','last_name','FORCE OCCUPIED TEST','email','agenda-force-rollback@example.invalid','phone','',
    'private_notes','private test');

  -- 1. First forced appointment, no operator: free studio, ordinary row.
  r:=public.optyker_book_forced_staff(actor,payload);
  assert r->>'ok'='true',r::text;
  first_id:=(r#>>'{data,id}')::uuid;
  studio:=(r#>>'{data,studio_id}')::uuid;
  assert studio is not null and r#>>'{data,forced_overlap}'='false',r::text;
  assert exists(select 1 from public.optyker_appointments where id=first_id and operator_username is null and source='staff'
    and upper(created_by)=upper(actor) and private_notes='private test' and not staff_forced_overlap);

  -- 2. Forced options keep that studio, marked busy; absent operators are not offered.
  rows:=public.optyker_force_booking_candidates(service,starts,null);
  assert rows->>'ok'='true',rows::text;
  assert exists(select 1 from jsonb_array_elements(rows->'data') e where e.value->>'operator_username' is null
    and (e.value->>'studio_id')::uuid=studio and (e.value->>'studio_busy')::boolean and (e.value->>'overlap')::boolean),rows::text;
  assert exists(select 1 from jsonb_array_elements(rows->'data') e where upper(e.value->>'operator_username')=upper(actor)),rows::text;
  assert not exists(select 1 from jsonb_array_elements(rows->'data') e where upper(e.value->>'operator_username')=upper(absent_op)),rows::text;

  -- 3. Same studio, same time: booked as an explicit forced overlap.
  r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('studio_id',studio));
  assert r->>'ok'='true' and (r#>>'{data,studio_id}')::uuid=studio and r#>>'{data,forced_overlap}'='true',r::text;
  assert exists(select 1 from public.optyker_appointments where id=(r#>>'{data,id}')::uuid and staff_forced_overlap
    and upper(staff_forced_overlap_by)=upper(actor) and staff_forced_overlap_at is not null);

  -- 4. Named operator on a busy studio, then the same operator again at the same time.
  r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('studio_id',studio,'operator_username',lower(actor)));
  assert r->>'ok'='true' and upper(r#>>'{data,operator_username}')=upper(actor) and r#>>'{data,forced_overlap}'='true',r::text;
  r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('operator_username',actor));
  assert r->>'ok'='true' and r#>>'{data,forced_overlap}'='true',r::text;
  rows:=public.optyker_force_booking_candidates(service,starts,null);
  assert exists(select 1 from jsonb_array_elements(rows->'data') e
    where upper(e.value->>'operator_username')=upper(actor) and (e.value->>'operator_busy')::boolean),rows::text;

  -- 5. Absent operator and a studio not enabled for the service are refused.
  r:=public.optyker_book_forced_staff(actor,payload||jsonb_build_object('operator_username',absent_op));
  assert r->>'ok'='false' and r->>'error' like '%assente%',r::text;
  assert public.optyker_book_forced_staff(actor,payload||jsonb_build_object('studio_id',gen_random_uuid()))->>'ok'='false';

  -- 6. Forcing stays staff-only; public booking is unchanged.
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

  -- 7. Appointments that are not forced overlaps are still protected by the exclusion constraint.
  begin
    insert into public.optyker_appointments(service_id,studio_id,first_name,last_name,email,phone,starts_at,ends_at,source)
    select service_id,studio_id,'SYNTHETIC','ORDINARY',email,phone,starts_at,ends_at,'staff'
    from public.optyker_appointments where id=first_id;
  exception when exclusion_violation then blocked:=true;
  end;
  assert blocked,'An ordinary overlap must still be rejected';

  -- 8. The authenticated staff API uses the new rules for options and creation.
  select pg_get_functiondef('public.optyker_appointments_api(text,text,text,jsonb)'::regprocedure) into api_src;
  assert strpos(api_src,'optyker_force_booking_candidates')>0 and strpos(api_src,'optyker_book_forced_staff')>0;
  assert strpos(api_src,'optyker_unassigned_force_slots')=0 and strpos(api_src,'optyker_book_unassigned_staff')=0;

  -- 9. Services without studio: forced appointments without operator never conflict.
  assert public.optyker_book_forced_staff(actor,payload||jsonb_build_object('service_id',no_studio))->>'ok'='true';
  assert public.optyker_book_forced_staff(actor,payload||jsonb_build_object('service_id',no_studio))->>'ok'='true';
end $$;
rollback;
select 'PASS: forced booking with busy studio/operator, absences, access guards and ordinary overlap protection; all fixtures rolled back' as result;
