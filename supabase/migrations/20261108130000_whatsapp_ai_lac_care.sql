-- Applicata in produzione l'8 novembre 2026: dati per scegliere le istruzioni di pulizia (optyker-whatsapp-ai, careDoc).
create or replace function public.optyker_wa_ai_lac_care(p_client uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select jsonb_build_object(
      'data_scheda', to_char(s.created_at at time zone 'Europe/Rome', 'YYYY-MM-DD'),
      'prodotto_od', nullif(btrim(s.data #>> '{elements,lacOdProduct,value}'), ''),
      'prodotto_os', nullif(btrim(s.data #>> '{elements,lacOsProduct,value}'), ''),
      'perossido', coalesce((s.data #>> '{elements,lacPeroxide,checked}')::boolean, false),
      'tipo_od', nullif(btrim(s.data #>> '{lacClinical,OD,contact_lens,tipoLente}'), ''),
      'tipo_os', nullif(btrim(s.data #>> '{lacClinical,OS,contact_lens,tipoLente}'), ''),
      'nome_od', nullif(btrim(s.data #>> '{lacClinical,OD,contact_lens,prodotto}'), ''),
      'nome_os', nullif(btrim(s.data #>> '{lacClinical,OS,contact_lens,prodotto}'), '')
    )
    from optyker_sheets s
    where s.client_id = p_client and s.sheet_type = 'lac' and s.archived_at is null
      and coalesce(s.document_type, '') <> 'Preventivo'
    order by s.created_at desc
    limit 1
  ), 'null'::jsonb)
$$;
revoke all on function public.optyker_wa_ai_lac_care(uuid) from public, anon, authenticated;
grant execute on function public.optyker_wa_ai_lac_care(uuid) to service_role;
