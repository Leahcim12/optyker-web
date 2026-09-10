import test from 'node:test';
import assert from 'node:assert/strict';
import {listEsoformProducts, esoformProduct, pricingTotals, cashDraftLine, assertEsoformTotal} from '../supabase/functions/optyker-cash-register-api/esoform.mjs';

const rows=listEsoformProducts();
test('32 per-eye prices match the requested list and 15% discount exactly',()=>{
  const expected=[45,50,65,75,88,110,70,90,90,110,80,85,80,85,80,95,140,45,60,70,75,95,85,110,100,200,280,290,100,120,320,380];
  const net=[38.25,42.50,55.25,63.75,74.80,93.50,59.50,76.50,76.50,93.50,68,72.25,68,72.25,68,80.75,119,38.25,51,59.50,63.75,80.75,72.25,93.50,85,170,238,246.50,85,102,272,323];
  assert.equal(rows.length,32);
  assert.equal(new Set(rows.map(r=>r.variant_id)).size,32);
  assert.deepEqual(rows.map(r=>r.list_price),expected);
  assert.deepEqual(rows.map(r=>r.price),net);
  assert.equal(rows.filter(r=>r.pack_lenses===3).length,17);
  rows.forEach(r=>assert.equal(r.discount_percent,15));
});
test('three-lens pack is one per-eye unit, two eyes cost 76.50',()=>{
  const line={...rows[0],quantity:2};
  assert.deepEqual(pricingTotals([line]),{list_total:90,discount_total:13.5,total:76.5});
  assert.equal(pricingTotals([line]).total-20,56.5);
  assert.equal(cashDraftLine(line).quantity,2);
});
test('discount does not affect existing lenses, other brands or ordinary items',()=>{
  for(const id of ['ortok','rgp','sei_mesi_multifocali','permanenza','wave_mensili','esoform:made_up','gid://shopify/ProductVariant/123'])assert.equal(esoformProduct(id),null);
  const ordinary={variant_id:'gid://shopify/ProductVariant/123',price:435,quantity:1,vendor:'Esoform'};
  assert.deepEqual(cashDraftLine(ordinary),{variantId:ordinary.variant_id,quantity:1});
  assert.deepEqual(pricingTotals([ordinary,{...rows[0],quantity:2}]),{list_total:525,discount_total:13.5,total:511.5});
});
test('Shopify receives original price and one discount, ignoring caller price overrides',()=>{
  const draft=cashDraftLine({...rows[0],price:1,list_price:1,discount_percent:90,quantity:1});
  assert.deepEqual(draft.originalUnitPriceWithCurrency,{amount:'45.00',currencyCode:'EUR'});
  assert.equal(draft.appliedDiscount.value,15);
  assert.equal(draft.appliedDiscount.valueType,'PERCENTAGE');
  assert.equal(draft.variantId,undefined);
});
test('cent rounding remains exact at multiple quantities; mismatches stop completion',()=>{
  const lines=[{...rows[4],quantity:3},{...rows[31],quantity:2}];
  assert.equal(pricingTotals(lines).total,870.4);
  assert.doesNotThrow(()=>assertEsoformTotal(lines,'870.40','EUR'));
  for(const actual of [870.41,1024,739.84,NaN])assert.throws(()=>assertEsoformTotal(lines,actual,'EUR'));
  assert.throws(()=>assertEsoformTotal(lines,870.4,'USD'));
});
test('Esoform search is token-based and case-insensitive',()=>{
  assert.equal(listEsoformProducts('Esoform silicone toriche').length,2);
  assert.equal(listEsoformProducts('ANNUALI MULTIFOCALI').length,2);
  assert.equal(listEsoformProducts('nessun-prodotto').length,0);
});
