-- Report: nelle schede LAC il prodotto "Nessun prodotto" vale come occhio senza prodotto
-- (prima compariva "OD Ortok · OS Nessun prodotto").
create or replace function optyker_private.recall_lac_product(p_data jsonb)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  with raw as (
    select btrim(split_part(coalesce(p_data->'lacState'->>'odProductName', ''), ' — ', 1)) as od,
           btrim(split_part(coalesce(p_data->'lacState'->>'osProductName', ''), ' — ', 1)) as os
  ), x as (
    select case when raw.od = '' or lower(raw.od) = 'nessun prodotto' then null else raw.od end as od,
           case when raw.os = '' or lower(raw.os) = 'nessun prodotto' then null else raw.os end as os
      from raw
  )
  select case
           when x.od is null and x.os is null then ''
           when x.od is not null and x.os is not null and lower(x.od) <> lower(x.os) then 'OD ' || x.od || ' · OS ' || x.os
           else coalesce(x.od, x.os)
         end
    from x
$$;

revoke all on function optyker_private.recall_lac_product(jsonb) from public, anon, authenticated;
