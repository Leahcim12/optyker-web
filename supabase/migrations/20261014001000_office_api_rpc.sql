-- Ufficio, accesso dal sito: una sola RPC con le stesse credenziali delle altre API Optyker.
--   * operatore (username + password): il proprio fatturato e i propri cedolini;
--   * Amministrazione ("Ottica Visual Care" + password, la stessa dell'accesso Amministrazione):
--     tutti gli account, fatturato di ciascuno, caricamento e rimozione dei cedolini.
-- La password viene verificata da optyker_staff_login_internal (blocco dopo 5 tentativi errati).
-- "Rimuovi" archivia il cedolino: sparisce subito per l'operatore e dagli elenchi, il file resta
-- in archivio (documento del personale).

alter table public.optyker_payslips
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by text;

create or replace function optyker_private.office_payslips_json(p_username text)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'year', p.period_year,
           'month', p.period_month,
           'title', p.title,
           'file_name', p.file_name,
           'mime_type', p.mime_type,
           'size_bytes', p.size_bytes,
           'created_at', p.created_at)
         order by p.period_year desc, p.period_month desc, p.created_at desc), '[]'::jsonb)
    from public.optyker_payslips p
   where p.removed_at is null
     and upper(regexp_replace(btrim(p.operator_username), '\s+', ' ', 'g'))
       = upper(regexp_replace(btrim(coalesce(p_username, '')), '\s+', ' ', 'g'))
$$;

revoke all on function optyker_private.office_payslips_json(text) from public, anon, authenticated;

create or replace function public.optyker_office_accounts(p_year integer, p_month integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, optyker_private, pg_temp
as $$
declare
  r record;
  rev jsonb;
  v_accounts jsonb := '[]'::jsonb;
begin
  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Mese non valido';
  end if;
  for r in
    select username, display_name, email, photo_data
      from public.optyker_operator_profiles
     where btrim(coalesce(username, '')) <> ''
     order by lower(coalesce(nullif(btrim(display_name), ''), username))
  loop
    rev := public.optyker_office_revenue(r.username, p_year);
    v_accounts := v_accounts || jsonb_build_array(jsonb_build_object(
      'username', r.username,
      'display_name', coalesce(nullif(btrim(r.display_name), ''), r.username),
      'email', coalesce(r.email, ''),
      'photo', case when coalesce(r.photo_data, '') like 'data:image/%' and length(r.photo_data) < 400000 then r.photo_data else '' end,
      'month_total', coalesce((rev->'months'->(p_month - 1)->>'total')::numeric, 0),
      'year_total', coalesce((rev->'totals'->>'total')::numeric, 0),
      'payslips_count', (select count(*) from public.optyker_payslips p
                          where p.removed_at is null and upper(p.operator_username) = upper(r.username)),
      'last_payslip', (select jsonb_build_object('year', p.period_year, 'month', p.period_month)
                         from public.optyker_payslips p
                        where p.removed_at is null and upper(p.operator_username) = upper(r.username)
                        order by p.period_year desc, p.period_month desc, p.created_at desc
                        limit 1)
    ));
  end loop;
  return jsonb_build_object('year', p_year, 'month', p_month, 'accounts', v_accounts);
end
$$;

revoke all on function public.optyker_office_accounts(integer, integer) from public, anon, authenticated;
grant execute on function public.optyker_office_accounts(integer, integer) to service_role;

create or replace function public.optyker_office_api(
  p_username text,
  p_password text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, optyker_private, pg_temp
as $$
declare
  v_login jsonb;
  v_user text;
  v_admin boolean;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_today_year int := extract(year from (now() at time zone 'Europe/Rome'))::int;
  v_today_month int := extract(month from (now() at time zone 'Europe/Rome'))::int;
  v_year int;
  v_month int;
  v_profile record;
  v_row record;
  v_bytes bytea;
  v_mime text;
  v_ext text;
  v_name text;
  v_title text;
  v_id uuid;
  v_months text[] := array['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
begin
  v_login := public.optyker_staff_login_internal(p_username, p_password);
  if coalesce((v_login->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'auth', false, 'error', coalesce(v_login->>'error', 'Operatore non autorizzato'));
  end if;
  v_user := v_login->>'username';
  v_admin := upper(regexp_replace(btrim(v_user), '\s+', ' ', 'g')) = 'OTTICA VISUAL CARE';

  begin
    if p_action in ('me', 'account') then
      if p_action = 'account' then
        if not v_admin then
          return jsonb_build_object('ok', false, 'error', 'Solo l''Amministrazione può vedere gli altri account');
        end if;
        select username, display_name, email, photo_data into v_profile
          from public.optyker_operator_profiles
         where upper(regexp_replace(btrim(username), '\s+', ' ', 'g'))
             = upper(regexp_replace(btrim(coalesce(v_payload->>'username', '')), '\s+', ' ', 'g'))
         limit 1;
      else
        select username, display_name, email, photo_data into v_profile
          from public.optyker_operator_profiles
         where upper(regexp_replace(btrim(username), '\s+', ' ', 'g'))
             = upper(regexp_replace(btrim(v_user), '\s+', ' ', 'g'))
         limit 1;
      end if;
      if v_profile.username is null then
        return jsonb_build_object('ok', false, 'error', 'Account non trovato');
      end if;
      v_year := coalesce(nullif(v_payload->>'year', '')::int, v_today_year);
      if v_year < 2000 or v_year > 2100 then
        return jsonb_build_object('ok', false, 'error', 'Anno non valido');
      end if;
      return jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'profile', jsonb_build_object(
          'username', v_profile.username,
          'display_name', coalesce(nullif(btrim(v_profile.display_name), ''), v_profile.username),
          'email', coalesce(v_profile.email, ''),
          'photo', case when coalesce(v_profile.photo_data, '') like 'data:image/%' and length(v_profile.photo_data) < 400000
                        then v_profile.photo_data else '' end),
        'is_admin', v_admin,
        'year', v_year,
        'today', jsonb_build_object('year', v_today_year, 'month', v_today_month),
        'revenue', public.optyker_office_revenue(v_profile.username, v_year),
        'payslips', optyker_private.office_payslips_json(v_profile.username)));

    elsif p_action = 'payslip_file' then
      v_id := nullif(v_payload->>'id', '')::uuid;
      select p.id, p.operator_username, p.file_name, p.mime_type, p.size_bytes, f.content into v_row
        from public.optyker_payslips p
        join public.optyker_payslip_files f on f.payslip_id = p.id
       where p.id = v_id and p.removed_at is null;
      if v_row.id is null or (not v_admin and upper(regexp_replace(btrim(v_row.operator_username), '\s+', ' ', 'g'))
                                            <> upper(regexp_replace(btrim(v_user), '\s+', ' ', 'g'))) then
        return jsonb_build_object('ok', false, 'error', 'Cedolino non trovato');
      end if;
      return jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'id', v_row.id,
        'file_name', v_row.file_name,
        'mime_type', v_row.mime_type,
        'size_bytes', v_row.size_bytes,
        'data_base64', replace(encode(v_row.content, 'base64'), E'\n', '')));

    elsif not v_admin then
      return jsonb_build_object('ok', false, 'error', 'Accedi come Amministrazione per gestire l''Ufficio');

    elsif p_action = 'accounts' then
      v_year := coalesce(nullif(v_payload->>'year', '')::int, v_today_year);
      v_month := coalesce(nullif(v_payload->>'month', '')::int, v_today_month);
      if v_year < 2000 or v_year > 2100 or v_month < 1 or v_month > 12 then
        return jsonb_build_object('ok', false, 'error', 'Periodo non valido');
      end if;
      return jsonb_build_object('ok', true, 'data',
        public.optyker_office_accounts(v_year, v_month)
        || jsonb_build_object('today', jsonb_build_object('year', v_today_year, 'month', v_today_month)));

    elsif p_action = 'upload_payslip' then
      select username into v_profile
        from public.optyker_operator_profiles
       where upper(regexp_replace(btrim(username), '\s+', ' ', 'g'))
           = upper(regexp_replace(btrim(coalesce(v_payload->>'username', '')), '\s+', ' ', 'g'))
       limit 1;
      if v_profile.username is null then
        return jsonb_build_object('ok', false, 'error', 'Account non trovato');
      end if;
      v_year := nullif(v_payload->>'year', '')::int;
      v_month := nullif(v_payload->>'month', '')::int;
      if v_year is null or v_year < 2000 or v_year > 2100 then
        return jsonb_build_object('ok', false, 'error', 'Anno non valido');
      end if;
      if v_month is null or v_month < 1 or v_month > 12 then
        return jsonb_build_object('ok', false, 'error', 'Mese non valido');
      end if;
      if btrim(coalesce(v_payload->>'data_base64', '')) = '' then
        return jsonb_build_object('ok', false, 'error', 'Seleziona il file del cedolino');
      end if;
      begin
        v_bytes := decode(regexp_replace(v_payload->>'data_base64', '^data:[^,]*,', ''), 'base64');
      exception when others then
        return jsonb_build_object('ok', false, 'error', 'File non leggibile');
      end;
      if octet_length(v_bytes) = 0 then
        return jsonb_build_object('ok', false, 'error', 'Il file è vuoto');
      end if;
      if octet_length(v_bytes) > 5 * 1024 * 1024 then
        return jsonb_build_object('ok', false, 'error', 'File troppo grande: massimo 5 MB');
      end if;
      if substring(v_bytes from 1 for 4) = '\x25504446'::bytea then
        v_mime := 'application/pdf'; v_ext := 'pdf';
      elsif substring(v_bytes from 1 for 3) = '\xffd8ff'::bytea then
        v_mime := 'image/jpeg'; v_ext := 'jpg';
      elsif substring(v_bytes from 1 for 8) = '\x89504e470d0a1a0a'::bytea then
        v_mime := 'image/png'; v_ext := 'png';
      else
        return jsonb_build_object('ok', false, 'error', 'Formato non supportato: carica un PDF, JPG o PNG');
      end if;
      v_title := left(btrim(regexp_replace(coalesce(v_payload->>'title', ''), '[[:cntrl:]]+', ' ', 'g')), 80);
      if v_title = '' then v_title := 'Cedolino'; end if;
      v_name := left(btrim(regexp_replace(regexp_replace(coalesce(v_payload->>'file_name', ''), '[[:cntrl:]]+', ' ', 'g'), '[\\/:*?"<>|]+', '_', 'g')), 120);
      if v_name = '' then v_name := 'Cedolino ' || v_months[v_month] || ' ' || v_year; end if;
      if lower(v_name) not like '%.' || v_ext then
        v_name := regexp_replace(v_name, '\.[A-Za-z0-9]{1,5}$', '') || '.' || v_ext;
      end if;
      insert into public.optyker_payslips(operator_username, period_year, period_month, title, file_name, mime_type, size_bytes, uploaded_by)
      values (v_profile.username, v_year, v_month, v_title, v_name, v_mime, octet_length(v_bytes), v_user)
      returning id into v_id;
      insert into public.optyker_payslip_files(payslip_id, content) values (v_id, v_bytes);
      return jsonb_build_object('ok', true, 'data', (
        select jsonb_build_object('id', p.id, 'username', p.operator_username, 'year', p.period_year, 'month', p.period_month,
                                  'title', p.title, 'file_name', p.file_name, 'mime_type', p.mime_type,
                                  'size_bytes', p.size_bytes, 'created_at', p.created_at)
          from public.optyker_payslips p where p.id = v_id));

    elsif p_action = 'remove_payslip' then
      if coalesce((v_payload->>'confirm')::boolean, false) is not true then
        return jsonb_build_object('ok', false, 'error', 'Conferma esplicita richiesta');
      end if;
      v_id := nullif(v_payload->>'id', '')::uuid;
      update public.optyker_payslips
         set removed_at = now(), removed_by = v_user
       where id = v_id and removed_at is null
      returning id into v_id;
      if v_id is null then
        return jsonb_build_object('ok', false, 'error', 'Cedolino non trovato');
      end if;
      return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id));
    end if;

    return jsonb_build_object('ok', false, 'error', 'Azione non riconosciuta');
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
end
$$;

revoke all on function public.optyker_office_api(text, text, text, jsonb) from public;
grant execute on function public.optyker_office_api(text, text, text, jsonb) to anon, authenticated, service_role;
