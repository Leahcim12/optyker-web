-- Area cliente: "Documenti firmati". Il cliente autenticato (email confermata, collegata a un solo cliente Optyker)
-- vede e apre i documenti che ha firmato: informativa privacy (e revoche), consensi LAC / ortocheratologia, ritiro occhiali.

create or replace function optyker_private.customer_client_for_user(p_user_id uuid)
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare cid uuid; matches integer;
begin
  if p_user_id is null then return null; end if;
  select count(*), (array_agg(c.id))[1] into matches, cid
    from public.optyker_clients c join auth.users au on lower(trim(c.email)) = lower(trim(au.email))
   where au.id = p_user_id and au.email_confirmed_at is not null and coalesce(trim(au.email),'') <> '';
  if matches <> 1 then return null; end if;
  return cid;
end $$;
revoke all on function optyker_private.customer_client_for_user(uuid) from public, anon, authenticated;

create or replace function public.optyker_customer_signed_documents()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare cid uuid := optyker_private.customer_client_for_user(auth.uid());
begin
  if cid is null then
    return jsonb_build_object('ok', false, 'error', 'Account non collegato in modo univoco alla tua scheda cliente: contatta l’ottica.');
  end if;
  return jsonb_build_object('ok', true, 'documents', coalesce((
    select jsonb_agg(x order by x->>'date' desc) from (
      select jsonb_build_object(
        'kind', c.consent_type, 'id', c.id,
        'title', case c.consent_type
                   when 'privacy' then 'Informativa privacy e consensi'
                   when 'privacy_withdrawal' then 'Revoca consenso privacy'
                   when 'lac' then 'Consenso informato lenti a contatto'
                   when 'ortho' then 'Consenso informato ortocheratologia'
                   else coalesce(nullif(c.data->>'label',''), 'Documento firmato') end,
        'date', coalesce(nullif(c.data->>'acquired_on',''), c.created_at::date::text),
        'detail', case when c.consent_type = 'privacy' then 'Versione testo ' || coalesce(c.data->>'template_version','')
                       when c.consent_type = 'privacy_withdrawal' then 'Finalità: ' || coalesce(c.data->>'scope','')
                       else coalesce(c.file_name,'') end,
        'signed', coalesce(c.signature_data_url,'') like 'data:image/png;base64,%' or position('data:image' in coalesce(c.data->>'html','')) > 0) x
        from public.optyker_consents c
       where c.client_id = cid and c.consent_type in ('privacy','privacy_withdrawal','lac','ortho')
         and coalesce((c.data->>'preview')::boolean, false) = false
      union all
      select jsonb_build_object(
        'kind', 'delivery', 'id', a.id,
        'title', 'Ritiro occhiali' || coalesce(' · ' || nullif(a.reference,''), ''),
        'date', coalesce(a.signed_at::date::text, a.delivery_date::text),
        'detail', 'Dichiarazione di consegna firmata (PDF)',
        'signed', true)
        from public.optyker_eyewear_delivery_archive a
       where a.client_id = cid
    ) q), '[]'::jsonb));
end $$;

create or replace function public.optyker_customer_signed_document(p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare cid uuid := optyker_private.customer_client_for_user(auth.uid()); r record;
begin
  if cid is null then
    return jsonb_build_object('ok', false, 'error', 'Account non collegato in modo univoco alla tua scheda cliente: contatta l’ottica.');
  end if;
  if p_kind = 'delivery' then
    select id, reference, signed_at, delivery_date, pdf, pdf_sha256 into r
      from public.optyker_eyewear_delivery_archive where id = p_id and client_id = cid;
    if not found then return jsonb_build_object('ok', false, 'error', 'Documento non trovato'); end if;
    return jsonb_build_object('ok', true, 'kind', 'delivery', 'id', r.id, 'reference', r.reference,
      'signed_at', r.signed_at, 'pdf_base64', encode(r.pdf, 'base64'), 'pdf_sha256', r.pdf_sha256);
  end if;
  if p_kind not in ('privacy','privacy_withdrawal','lac','ortho') then
    return jsonb_build_object('ok', false, 'error', 'Tipo di documento non valido');
  end if;
  select id, consent_type, file_name, data, signature_data_url, created_at into r
    from public.optyker_consents
   where id = p_id and client_id = cid and consent_type = p_kind and coalesce((data->>'preview')::boolean, false) = false;
  if not found then return jsonb_build_object('ok', false, 'error', 'Documento non trovato'); end if;
  return jsonb_build_object('ok', true, 'kind', r.consent_type, 'id', r.id, 'file_name', r.file_name,
    'created_at', r.created_at, 'data', r.data, 'signature_data_url', r.signature_data_url);
end $$;

revoke all on function public.optyker_customer_signed_documents() from public, anon;
revoke all on function public.optyker_customer_signed_document(text, uuid) from public, anon;
grant execute on function public.optyker_customer_signed_documents() to authenticated;
grant execute on function public.optyker_customer_signed_document(text, uuid) to authenticated;
-- Sito otticavisualcare.it (area cliente Shopify): "Documenti firmati" tramite il codice personale del portale
-- (customer_portal_token, già usato da tutte le altre sezioni dell'area cliente del sito).
-- La logica è condivisa con l'app: stesse liste e stessi documenti, filtrati sul solo cliente collegato.

create or replace function optyker_private.customer_signed_documents_for(cid uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return jsonb_build_object('ok', true, 'documents', coalesce((
    select jsonb_agg(x order by x->>'date' desc) from (
      select jsonb_build_object(
        'kind', c.consent_type, 'id', c.id,
        'title', case c.consent_type
                   when 'privacy' then 'Informativa privacy e consensi'
                   when 'privacy_withdrawal' then 'Revoca consenso privacy'
                   when 'lac' then 'Consenso informato lenti a contatto'
                   when 'ortho' then 'Consenso informato ortocheratologia'
                   else coalesce(nullif(c.data->>'label',''), 'Documento firmato') end,
        'date', coalesce(nullif(c.data->>'acquired_on',''), c.created_at::date::text),
        'detail', case when c.consent_type = 'privacy' then 'Versione testo ' || coalesce(c.data->>'template_version','')
                       when c.consent_type = 'privacy_withdrawal' then 'Finalità: ' || coalesce(c.data->>'scope','')
                       else coalesce(c.file_name,'') end,
        'signed', coalesce(c.signature_data_url,'') like 'data:image/png;base64,%' or position('data:image' in coalesce(c.data->>'html','')) > 0) x
        from public.optyker_consents c
       where c.client_id = cid and c.consent_type in ('privacy','privacy_withdrawal','lac','ortho')
         and coalesce((c.data->>'preview')::boolean, false) = false
      union all
      select jsonb_build_object('kind', 'delivery', 'id', a.id,
        'title', 'Ritiro occhiali' || coalesce(' · ' || nullif(a.reference,''), ''),
        'date', coalesce(a.signed_at::date::text, a.delivery_date::text),
        'detail', 'Dichiarazione di consegna firmata (PDF)', 'signed', true)
        from public.optyker_eyewear_delivery_archive a where a.client_id = cid
    ) q), '[]'::jsonb));
end $$;

create or replace function optyker_private.customer_signed_document_for(cid uuid, p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if p_kind = 'delivery' then
    select id, reference, signed_at, pdf, pdf_sha256 into r
      from public.optyker_eyewear_delivery_archive where id = p_id and client_id = cid;
    if not found then return jsonb_build_object('ok', false, 'error', 'Documento non trovato'); end if;
    return jsonb_build_object('ok', true, 'kind', 'delivery', 'id', r.id, 'reference', r.reference,
      'signed_at', r.signed_at, 'pdf_base64', encode(r.pdf, 'base64'), 'pdf_sha256', r.pdf_sha256);
  end if;
  if p_kind not in ('privacy','privacy_withdrawal','lac','ortho') then
    return jsonb_build_object('ok', false, 'error', 'Tipo di documento non valido');
  end if;
  select id, consent_type, file_name, data, signature_data_url, created_at into r
    from public.optyker_consents
   where id = p_id and client_id = cid and consent_type = p_kind and coalesce((data->>'preview')::boolean, false) = false;
  if not found then return jsonb_build_object('ok', false, 'error', 'Documento non trovato'); end if;
  return jsonb_build_object('ok', true, 'kind', r.consent_type, 'id', r.id, 'file_name', r.file_name,
    'created_at', r.created_at, 'data', r.data, 'signature_data_url', r.signature_data_url);
end $$;
revoke all on function optyker_private.customer_signed_documents_for(uuid) from public, anon, authenticated;
revoke all on function optyker_private.customer_signed_document_for(uuid, text, uuid) from public, anon, authenticated;

create or replace function optyker_private.customer_client_for_portal_token(p_token text)
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare cid uuid; matches integer;
begin
  if coalesce(p_token,'') !~ '^[0-9a-f]{48}$' then return null; end if;
  select count(*), (array_agg(id))[1] into matches, cid from public.optyker_clients where customer_portal_token = p_token;
  if matches <> 1 then return null; end if;
  return cid;
end $$;
revoke all on function optyker_private.customer_client_for_portal_token(text) from public, anon, authenticated;

create or replace function public.optyker_site_signed_documents(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare cid uuid := optyker_private.customer_client_for_portal_token(p_token);
begin
  if cid is null then return jsonb_build_object('ok', false, 'error', 'Accesso non valido: ricarica la pagina o contatta l’ottica.'); end if;
  return optyker_private.customer_signed_documents_for(cid);
end $$;

create or replace function public.optyker_site_signed_document(p_token text, p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare cid uuid := optyker_private.customer_client_for_portal_token(p_token);
begin
  if cid is null then return jsonb_build_object('ok', false, 'error', 'Accesso non valido: ricarica la pagina o contatta l’ottica.'); end if;
  return optyker_private.customer_signed_document_for(cid, p_kind, p_id);
end $$;

revoke all on function public.optyker_site_signed_documents(text) from public;
revoke all on function public.optyker_site_signed_document(text, text, uuid) from public;
grant execute on function public.optyker_site_signed_documents(text) to anon, authenticated;
grant execute on function public.optyker_site_signed_document(text, text, uuid) to anon, authenticated;
