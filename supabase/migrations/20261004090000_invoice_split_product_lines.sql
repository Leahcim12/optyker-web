-- Split client-cart order lines (glasses / contact lenses) into separate invoice lines:
-- Montatura, Lente OD, Lente OS (+ Montaggio, Garanzia) or LAC OD / LAC OS.
-- Amounts are rescaled so the split lines always add up to the original line total.

create or replace function optyker_private.invoice_num(v jsonb)
returns numeric language plpgsql immutable as $$
declare s text;
begin
  if v is null or jsonb_typeof(v) not in ('number','string') then return 0; end if;
  if jsonb_typeof(v) = 'number' then return (v #>> '{}')::numeric; end if;
  s := regexp_replace(v #>> '{}', '[^0-9,.\-]', '', 'g');
  if s ~ ',' then s := replace(replace(s, '.', ''), ',', '.'); end if;
  if s = '' then return 0; end if;
  return s::numeric;
exception when others then return 0;
end $$;

create or replace function optyker_private.invoice_split_line(p_line jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, optyker_private as $$
declare
  v_sheet jsonb; v_target numeric; v_parts jsonb := '[]'::jsonb; v_raw numeric := 0; v_out jsonb := '[]'::jsonb;
  v_vat text; v_dept text; v_p jsonb; v_lens jsonb; v_frame jsonb; v_lac jsonb;
  w_od numeric; w_os numeric; v_lens_net numeric; v_extra numeric; v_od numeric; v_os numeric;
  v_frame_price numeric; v_name text; v_tr text; v_n int; v_i int; v_amount numeric; v_acc numeric := 0; v_last int;
  v_part jsonb;
begin
  if coalesce((p_line->>'is_client_cart_order')::boolean,false) is not true
     or coalesce(p_line->>'source_sheet_id','') !~* '^[0-9a-f-]{36}$'
     or coalesce((p_line->>'invoice_split')::boolean,false)
     or optyker_private.invoice_num(p_line->'quantity') <> 1 then
    return jsonb_build_array(p_line);
  end if;
  select data into v_sheet from optyker_sheets where id = (p_line->>'source_sheet_id')::uuid;
  if v_sheet is null then return jsonb_build_array(p_line); end if;
  v_target := round(optyker_private.invoice_num(coalesce(p_line->'total', p_line->'price')), 2);
  if v_target <= 0 then return jsonb_build_array(p_line); end if;

  v_vat := coalesce(nullif(p_line->>'fiscal_vat_code',''), nullif(p_line->>'vat_code',''));
  v_dept := p_line->>'department';
  if v_vat is null then v_vat := case v_dept when '1' then '04' when '2' then '22' when '3' then 'ART10' else '' end; end if;

  if jsonb_typeof(v_sheet->'pricing') = 'object' and (jsonb_typeof(v_sheet->'frame') = 'object' or jsonb_typeof(v_sheet->'lens') = 'object') then
    v_p := v_sheet->'pricing'; v_lens := coalesce(v_sheet->'lens','{}'); v_frame := coalesce(v_sheet->'frame','{}');
    v_frame_price := optyker_private.invoice_num(coalesce(v_p->'frame_price', v_frame->'price'));
    if v_frame_price > 0 then
      v_name := nullif(btrim(concat_ws(' ', nullif(v_frame->>'model',''))),'');
      if v_name is null then v_name := nullif(btrim(coalesce(v_frame->>'brand','')),''); end if;
      v_parts := v_parts || jsonb_build_object('part','frame','title','Montatura'||coalesce(' '||v_name,''),
        'variant', nullif(v_frame->>'type',''), 'sku', coalesce(nullif(v_frame->>'sku',''), p_line->>'sku'), 'amount', v_frame_price);
    end if;
    v_lens_net := optyker_private.invoice_num(coalesce(v_p->'lens_net', v_p->'lens_gross'));
    v_extra := optyker_private.invoice_num(v_p->'index_total') + optyker_private.invoice_num(v_p->'geometry_total')
             + optyker_private.invoice_num(v_p->'treatment_total') + optyker_private.invoice_num(v_p->'color_total');
    v_od := optyker_private.invoice_num(coalesce(v_lens->'unit_price_od', v_p->'lens_unit_price_od'));
    v_os := optyker_private.invoice_num(coalesce(v_lens->'unit_price_os', v_p->'lens_unit_price_os'));
    if v_od > 0 and v_os > 0 then w_od := v_od; w_os := v_os;
    elsif optyker_private.invoice_num(coalesce(v_p->'lens_quantity', v_lens->'quantity')) >= 2 then w_od := 1; w_os := 1;
    elsif v_od > 0 then w_od := 1; w_os := 0;
    elsif v_os > 0 then w_od := 0; w_os := 1;
    else w_od := 1; w_os := 1; end if;
    if coalesce((v_lens->'lens_od'->>'client_owned')::boolean,false) then w_od := 0; end if;
    if coalesce((v_lens->'lens_os'->>'client_owned')::boolean,false) then w_os := 0; end if;
    select string_agg(x, ', ') into v_tr from jsonb_array_elements_text(case when jsonb_typeof(v_lens->'treatments')='array' then v_lens->'treatments' else '[]' end) x;
    if (v_lens_net + v_extra) > 0 and (w_od + w_os) > 0 then
      if w_od > 0 then
        v_name := nullif(btrim(concat_ws(' ', coalesce(nullif(v_lens->'lens_od'->>'lens_name',''), nullif(v_lens->>'lens_name','')), coalesce(nullif(v_lens->>'lens_type_od',''), nullif(v_lens->'lens_od'->>'type',''), nullif(v_lens->>'lens_type','')))),'');
        v_parts := v_parts || jsonb_build_object('part','lens_od','title','Lente destra (OD)'||coalesce(' · '||v_name,''),
          'variant', nullif(concat_ws(' · ', coalesce(nullif(v_lens->'lens_od'->>'brand',''), nullif(v_lens->>'brand','')), case when nullif(v_lens->>'refractive_index','') is not null then 'Indice '||(v_lens->>'refractive_index') end, v_tr),''),
          'sku', p_line->>'sku', 'amount', (v_lens_net + v_extra) * w_od / (w_od + w_os));
      end if;
      if w_os > 0 then
        v_name := nullif(btrim(concat_ws(' ', coalesce(nullif(v_lens->'lens_os'->>'lens_name',''), nullif(v_lens->>'lens_name','')), coalesce(nullif(v_lens->>'lens_type_os',''), nullif(v_lens->'lens_os'->>'type',''), nullif(v_lens->>'lens_type','')))),'');
        v_parts := v_parts || jsonb_build_object('part','lens_os','title','Lente sinistra (OS)'||coalesce(' · '||v_name,''),
          'variant', nullif(concat_ws(' · ', coalesce(nullif(v_lens->'lens_os'->>'brand',''), nullif(v_lens->'lens_od'->>'brand',''), nullif(v_lens->>'brand','')), case when nullif(v_lens->>'refractive_index','') is not null then 'Indice '||(v_lens->>'refractive_index') end, v_tr),''),
          'sku', p_line->>'sku', 'amount', (v_lens_net + v_extra) * w_os / (w_od + w_os));
      end if;
    end if;
    if optyker_private.invoice_num(v_p->'mounting_price') > 0 then
      v_parts := v_parts || jsonb_build_object('part','mounting','title','Montaggio','sku',p_line->>'sku','amount',optyker_private.invoice_num(v_p->'mounting_price'));
    end if;
    if optyker_private.invoice_num(v_p->'warranty_total') > 0 then
      v_parts := v_parts || jsonb_build_object('part','warranty','title','Garanzia','sku',p_line->>'sku','amount',optyker_private.invoice_num(v_p->'warranty_total'));
    end if;
  elsif jsonb_typeof(v_sheet->'lacState') = 'object' then
    v_lac := v_sheet->'lacState';
    v_od := optyker_private.invoice_num(v_lac->'odCost'); v_os := optyker_private.invoice_num(v_lac->'osCost');
    if v_od > 0 then
      v_name := nullif(btrim(concat_ws(' ', nullif(v_lac->>'brand',''), nullif(btrim(split_part(coalesce(v_lac->>'odProductName',''),' — ',1)),''))),'');
      v_parts := v_parts || jsonb_build_object('part','lac_od','title','Lenti a contatto occhio destro (OD)'||coalesce(' · '||v_name,''),'sku',p_line->>'sku','amount',v_od);
    end if;
    if v_os > 0 then
      v_name := nullif(btrim(concat_ws(' ', nullif(v_lac->>'brand',''), nullif(btrim(split_part(coalesce(v_lac->>'osProductName',''),' — ',1)),''))),'');
      v_parts := v_parts || jsonb_build_object('part','lac_os','title','Lenti a contatto occhio sinistro (OS)'||coalesce(' · '||v_name,''),'sku',p_line->>'sku','amount',v_os);
    end if;
  end if;

  v_n := jsonb_array_length(v_parts);
  if v_n < 2 then return jsonb_build_array(p_line); end if;
  select sum((x->>'amount')::numeric) into v_raw from jsonb_array_elements(v_parts) x;
  if v_raw is null or v_raw <= 0 then return jsonb_build_array(p_line); end if;
  v_last := v_n - 1;
  for v_i in 0..v_n-1 loop
    v_part := v_parts->v_i;
    if v_i = v_last then v_amount := v_target - v_acc;
    else v_amount := round((v_part->>'amount')::numeric * v_target / v_raw, 2); v_acc := v_acc + v_amount; end if;
    v_out := v_out || (p_line || jsonb_build_object(
      'title', v_part->>'title', 'description', v_part->>'title', 'variant_title', coalesce(v_part->>'variant',''),
      'sku', coalesce(v_part->>'sku',''), 'quantity', 1, 'price', v_amount, 'unit_price', v_amount, 'total', v_amount,
      'list_price', v_amount, 'quoted_unit_price', v_amount, 'discount_percent', 0, 'discount_amount', 0, 'discount_total', 0,
      'fiscal_vat_code', v_vat, 'invoice_split', true, 'split_part', v_part->>'part', 'split_from_title', p_line->>'title',
      'split_from_total', v_target));
  end loop;
  return v_out;
end $$;

create or replace function public.optyker_invoice_split_lines(p_lines jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, optyker_private as $$
declare v_out jsonb := '[]'::jsonb; v_line jsonb;
begin
  if jsonb_typeof(p_lines) <> 'array' then return '[]'::jsonb; end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_out := v_out || optyker_private.invoice_split_line(v_line);
  end loop;
  return v_out;
end $$;
revoke all on function public.optyker_invoice_split_lines(jsonb) from public, anon, authenticated;
revoke all on function optyker_private.invoice_split_line(jsonb) from public, anon, authenticated;
grant execute on function public.optyker_invoice_split_lines(jsonb) to service_role;

create or replace function optyker_private.invoice_split_before_insert()
returns trigger language plpgsql security definer set search_path = public, optyker_private as $$
declare v_lines jsonb; v_new jsonb;
begin
  if new.direction = 'outgoing' and coalesce(new.provider_payload->>'source','') like 'optyker_pos%'
     and jsonb_typeof(new.provider_payload->'lines') = 'array' and new.provider_invoice_id is null then
    v_lines := new.provider_payload->'lines';
    begin
      v_new := public.optyker_invoice_split_lines(v_lines);
    exception when others then
      v_new := v_lines; -- never block the checkout because of the split
    end;
    if v_new is not null and v_new <> v_lines then
      new.provider_payload := new.provider_payload || jsonb_build_object('lines', v_new, 'original_lines', v_lines, 'lines_split_at', now());
    end if;
  end if;
  return new;
end $$;

drop trigger if exists optyker_zz_invoice_split_lines on public.optyker_billing_invoices;
create trigger optyker_zz_invoice_split_lines before insert on public.optyker_billing_invoices
for each row execute function optyker_private.invoice_split_before_insert();
