-- Configuration only: no worker, transmission or queue state changes.
create table public.optyker_ts_connection (
  id boolean primary key default true check (id),
  username text not null default '', owner_code text not null default '',
  owner_fiscal_code text not null default '', business_vat text not null default '',
  password_secret_id uuid references vault.secrets(id),
  pin_secret_id uuid references vault.secrets(id),
  revision bigint not null default 0, updated_at timestamptz not null default now()
);
insert into public.optyker_ts_connection (id) values (true);
alter table public.optyker_ts_connection enable row level security;
revoke all on public.optyker_ts_connection from public, anon, authenticated;
grant select, update on public.optyker_ts_connection to service_role;

create table public.optyker_ts_technical_files (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (length(filename) between 1 and 180),
  object_path text not null unique, sha256 text not null unique check (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  review_state text not null default 'pending_review' check (review_state = 'pending_review'),
  uploaded_at timestamptz not null default now()
);
alter table public.optyker_ts_technical_files enable row level security;
revoke all on public.optyker_ts_technical_files from public, anon, authenticated;
grant select, insert, delete on public.optyker_ts_technical_files to service_role;
insert into storage.buckets (id, name, public, file_size_limit)
values ('optyker-ts-kit', 'optyker-ts-kit', false, 10485760);
-- Future broad Storage policies must not accidentally expose the technical kit.
create policy optyker_ts_kit_private on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'optyker-ts-kit') with check (bucket_id <> 'optyker-ts-kit');

create function public.optyker_ts_connection_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username', username, 'owner_code', owner_code,
    'owner_fiscal_code', owner_fiscal_code, 'business_vat', business_vat,
    'password_saved', password_secret_id is not null, 'pin_saved', pin_secret_id is not null,
    'revision', revision, 'updated_at', updated_at,
    'credentials_verified', false, 'transport_ready', false)
  from public.optyker_ts_connection where id;
$$;

create function public.optyker_ts_connection_save(
  p_revision bigint, p_username text, p_owner_code text, p_owner_fiscal_code text,
  p_business_vat text, p_password text default null, p_pin text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.optyker_ts_connection; u text := upper(btrim(p_username));
  f text := upper(btrim(p_owner_fiscal_code));
begin
  select * into strict c from public.optyker_ts_connection where id for update;
  if p_revision is null or p_revision <> c.revision then
    raise exception 'TS_REVISION_CONFLICT' using errcode = 'P0001';
  end if;
  if u is null or u !~ '^[A-Z0-9]{3,64}$'
    or p_owner_code is null or p_owner_code !~ '^[0-9]{3}-[0-9]{3}-[0-9]{6}$'
    or f is null or f !~ '^[A-Z0-9]{16}$'
    or p_business_vat is null or p_business_vat !~ '^[0-9]{11}$'
    or (p_password is not null and (length(p_password) not between 1 and 256 or p_password ~ '[\r\n]'))
    or (p_pin is not null and p_pin !~ '^[A-Za-z0-9]{4,64}$') then
    raise exception 'TS_INVALID_CONFIGURATION' using errcode = 'P0001';
  end if;
  -- Do not silently reuse another TS account's credentials after an identity edit.
  if c.username <> '' and u <> c.username and (p_password is null or p_pin is null) then
    raise exception 'TS_ACCOUNT_REQUIRES_CREDENTIALS' using errcode = 'P0001';
  end if;
  if p_password is not null then
    if c.password_secret_id is null then
      c.password_secret_id := vault.create_secret(p_password);
    else
      perform vault.update_secret(c.password_secret_id, p_password);
    end if;
  end if;
  if p_pin is not null then
    if c.pin_secret_id is null then c.pin_secret_id := vault.create_secret(p_pin);
    else perform vault.update_secret(c.pin_secret_id, p_pin); end if;
  end if;
  update public.optyker_ts_connection set username = u, owner_code = p_owner_code,
    owner_fiscal_code = f, business_vat = p_business_vat,
    password_secret_id = c.password_secret_id, pin_secret_id = c.pin_secret_id,
    revision = revision + 1, updated_at = now() where id;
  return public.optyker_ts_connection_status();
end;
$$;
revoke all on function public.optyker_ts_connection_status() from public, anon, authenticated;
revoke all on function public.optyker_ts_connection_save(bigint,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.optyker_ts_connection_status() to service_role;
grant execute on function public.optyker_ts_connection_save(bigint,text,text,text,text,text,text) to service_role;
