-- Accesso operatori: correzione account "Diego Panseri" e chiusura dell'accesso anonimo alle API interne.
--
-- 1) Le funzioni interne "legacy_passwordless" autorizzavano solo un elenco fisso di nomi, con il
--    refuso 'DIEGO PANSIERI'. L'account reale è "Diego Panseri": tutte le sue chiamate a clienti,
--    schede, ordini Shopify, etichette e chat venivano rifiutate ("Operatore non autorizzato").
--    Ora l'elenco è letto dai profili operatore (optyker_operator_profiles), quindi vale anche per
--    i nuovi operatori. Le API pubbliche continuano a verificare la password con optyker_staff_allowed
--    prima di chiamare queste funzioni.
-- 2) optyker_api_legacy_passwordless era eseguibile dal ruolo anon senza password: il sito non la usa
--    (chiama optyker_api, che verifica la password), quindi l'esecuzione resta solo interna.

create or replace function optyker_private.staff_operator_keys()
returns setof text
language sql
stable
set search_path = public, pg_temp
as $$
  select upper(regexp_replace(btrim(username), '\s+', ' ', 'g'))
    from public.optyker_operator_profiles
   where btrim(coalesce(username, '')) <> ''
  union
  select x from unnest(array['OTTICA VISUAL CARE', 'MICHAEL MOLOGNI', 'GIORGIA BONO', 'DIEGO PANSERI']) as x
$$;

revoke all on function optyker_private.staff_operator_keys() from public, anon, authenticated;

do $migration$
declare
  r record;
  def text;
  newdef text;
  pattern text := $p$'OTTICA VISUAL CARE',\s*'MICHAEL MOLOGNI',\s*'GIORGIA BONO',\s*'DIEGO PANSIERI'$p$;
  replacement text := $r$select optyker_private.staff_operator_keys()$r$;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'optyker_api_legacy_passwordless_base_20260830',
         'optyker_chat_api_legacy_passwordless',
         'optyker_shopify_api_legacy_passwordless',
         'optyker_order_label_api_legacy_passwordless'
       )
  loop
    def := pg_get_functiondef(r.oid);
    if position('staff_operator_keys' in def) > 0 then
      continue;
    end if;
    newdef := regexp_replace(def, pattern, replacement, 'g');
    if newdef = def then
      raise exception 'Elenco operatori non trovato in %', r.oid::regprocedure;
    end if;
    execute newdef;
  end loop;
end
$migration$;

revoke execute on function public.optyker_api_legacy_passwordless(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.optyker_api_legacy_passwordless(text, text, text, jsonb) to service_role;
