-- All synthetic writes roll back, including when an assertion fails.
begin;
do $$
declare actor text; service uuid; studio uuid; starts timestamptz;
  result jsonb; rows jsonb; appointment uuid; other uuid; payload jsonb; stamp timestamptz;
begin
  select username into actor from public.optyker_operator_profiles where public.optyker_staff_can_force_appointment(username) order by username limit 1;
  select id into service from public.optyker_appointment_services where active and requires_studio order by name limit 1;
  starts:=((current_date+70)::text||' 03:00 Europe/Rome')::timestamptz;
  rows:=public.optyker_force_overlap_candidates(service,starts,null,null)->'data';
  select (r->>'studio_id')::uuid into studio from jsonb_array_elements(rows) r where r->>'operator_username' is null limit 1;
  assert studio is not null,'Forced rescheduling must offer an unassigned operator outside shifts';
  insert into public.optyker_appointments(service_id,studio_id,operator_username,first_name,last_name,email,phone,starts_at,ends_at,status,source)
    values(service,studio,actor,'SYNTHETIC','ROLLBACK','duration-rollback@example.invalid','',starts,starts+interval '30 minutes','confirmed','web') returning id into appointment;
  payload:=jsonb_build_object('service_id',service,'starts_at',starts+interval '1 hour','studio_id',studio,'operator_username',null,'force_overlap',true,'forced_by',actor);
  result:=public.optyker_appointment_reschedule_internal(appointment,payload);
  assert result->>'ok'='true',result::text;
  assert result#>'{data,operator_username}'='null'::jsonb,'Explicitly unassigned must not fall back to the previous operator';
  assert result#>>'{data,source}'='web','Keep booking provenance';
  assert result#>>'{data,staff_forced_overlap_by}'=actor;
  result:=public.optyker_appointment_set_duration(actor,appointment,75,null);
  assert result->>'ok'='true',result::text;
  assert (result#>>'{data,ends_at}')::timestamptz-(result#>>'{data,starts_at}')::timestamptz=interval '75 minutes';
  result:=public.optyker_appointment_reschedule_internal(appointment,payload||jsonb_build_object('notes','Keep custom duration'));
  assert result->>'ok'='true',result::text;
  assert (result#>>'{data,ends_at}')::timestamptz-(result#>>'{data,starts_at}')::timestamptz=interval '75 minutes','Saving again must preserve edited duration';
  result:=public.optyker_appointment_reschedule_internal(appointment,payload||jsonb_build_object('operator_username','__NOT_SCHEDULED__'));
  assert result->>'ok'='false','Explicit invalid operators must remain unavailable';
  assert public.optyker_appointment_set_duration('__NOT_STAFF__',appointment,20,null)->>'ok'='false';
  assert public.optyker_appointment_set_duration(actor,appointment,0,null)->>'ok'='false';
  assert public.optyker_appointment_set_duration(actor,appointment,1441,null)->>'ok'='false';
  assert public.optyker_appointment_set_duration(actor,appointment,20,'2000-01-01'::timestamptz)->>'ok'='false';
  assert not has_function_privilege('anon','public.optyker_appointment_set_duration(text,uuid,integer,timestamptz)','execute');
  assert not has_function_privilege('authenticated','public.optyker_appointment_set_duration(text,uuid,integer,timestamptz)','execute');
  -- No forced overlap: growing into a second appointment is rejected atomically.
  starts:=starts+interval '1 day';
  insert into public.optyker_appointments(service_id,studio_id,operator_username,first_name,last_name,email,phone,starts_at,ends_at,status,source)
    values(service,studio,null,'SYNTHETIC','ROLLBACK','duration-rollback@example.invalid','',starts,starts+interval '30 minutes','confirmed','staff') returning id,updated_at into appointment,stamp;
  insert into public.optyker_appointments(service_id,studio_id,operator_username,first_name,last_name,email,phone,starts_at,ends_at,status,source)
    values(service,studio,null,'SYNTHETIC','ROLLBACK','duration-rollback@example.invalid','',starts+interval '45 minutes',starts+interval '75 minutes','confirmed','staff') returning id into other;
  result:=public.optyker_appointment_set_duration(actor,appointment,60,stamp);
  assert result->>'ok'='false','Conflicting duration must be blocked';
  assert exists(select 1 from public.optyker_appointments where id=appointment and ends_at=starts+interval '30 minutes');
  result:=public.optyker_appointment_set_duration(actor,appointment,40,stamp);
  assert result->>'ok'='true',result::text;
  result:=public.optyker_appointment_reschedule_internal(appointment,jsonb_build_object('notes','Keep unassigned appointment editable','operator_username',null,'forced_by',actor));
  assert result->>'ok'='true',result::text;
  assert (result#>>'{data,ends_at}')::timestamptz-starts=interval '40 minutes';
end $$;
rollback;
select 'PASS: forced unassigned rescheduling, duration persistence, access and collision guards; fixtures rolled back' result;
