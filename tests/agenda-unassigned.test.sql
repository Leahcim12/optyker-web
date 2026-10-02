-- Transactional regression: every synthetic appointment is rolled back.
begin;
do $$
declare actor text; service uuid; no_studio uuid; starts timestamptz;
  payload jsonb; result jsonb; second_result jsonb; selected_studio uuid; appointment uuid;
begin
  select username into actor from public.optyker_operator_profiles where public.optyker_staff_can_force_appointment(username) order by username limit 1;
  select id into service from public.optyker_appointment_services where active and requires_studio order by name limit 1;
  select id into no_studio from public.optyker_appointment_services where active and not requires_studio order by name limit 1;
  assert actor is not null and service is not null and no_studio is not null;
  starts:=((current_date+60)::text||' 03:00 Europe/Rome')::timestamptz;
  selected_studio:=(public.optyker_unassigned_force_slots(service,starts)->0->>'studio_id')::uuid;
  payload:=jsonb_build_object('service_id',service,'studio_id',selected_studio,'starts_at',starts,'force_time',true,
    'first_name','SYNTHETIC','last_name','ROLLBACK TEST','email','agenda-rollback@example.invalid','phone','','private_notes','private test');
  assert selected_studio is not null;
  result:=public.optyker_book_unassigned_staff(actor,payload);
  assert result->>'ok'='true', result::text;
  assert result#>'{data,operator_username}'='null'::jsonb;
  appointment:=(result#>>'{data,id}')::uuid;
  assert exists(select 1 from public.optyker_appointments where id=appointment and operator_username is null and source='staff' and created_by=actor and private_notes='private test');
  second_result:=public.optyker_book_unassigned_staff(actor,payload);
  assert second_result->>'ok'='false','Occupied studio must remain blocked';
  assert public.optyker_book_unassigned_staff(actor,payload||'{"force_time":false}'::jsonb)->>'ok'='false';
  assert public.optyker_book_unassigned_staff('__NOT_A_STAFF_ACCOUNT__',payload)->>'ok'='false';
  assert public.optyker_appointments_api('__NOT_A_STAFF_ACCOUNT__','invalid','appointment_create',payload)->>'ok'='false';
  assert public.optyker_book_appointment(payload)->>'ok'='false','Public booking must not obtain staff override';
  assert not has_function_privilege('anon','public.optyker_book_unassigned_staff(text,jsonb)','execute');
  assert not has_function_privilege('authenticated','public.optyker_book_unassigned_staff(text,jsonb)','execute');
  payload:=payload||jsonb_build_object('service_id',no_studio,'studio_id',null);
  result:=public.optyker_book_unassigned_staff(actor,payload);
  assert result->>'ok'='true',result::text;
  second_result:=public.optyker_book_unassigned_staff(actor,payload);
  assert second_result->>'ok'='true','Unassigned appointments must not conflict on a dummy operator';
end $$;
rollback;
select 'PASS: unassigned staff booking, studio collision, no-studio service and access guards; all fixtures rolled back' as result;
