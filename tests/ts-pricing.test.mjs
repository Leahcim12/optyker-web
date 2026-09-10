import test from 'node:test';
import assert from 'node:assert/strict';
import {lensProduct, listLensProducts, isLensCatalogId, pricingTotals, cashDraftLine, assertLensTotal, discountBrands} from '../supabase/functions/optyker-cash-register-api/lens-pricing.mjs';

const rows = listLensProducts('', 'TS');
test('all 32 TS per-eye list prices and discounted prices match the request', () => {
  const base = [50,80,80,110,120,180,70,100,100,130,140,250,100,130,200,120,150,220,100,130,200,120,150,220,70,100,140,100,130,200,500,600];
  const net = [42.5,68,68,93.5,102,153,59.5,85,85,110.5,119,212.5,85,110.5,170,102,127.5,187,85,110.5,170,102,127.5,187,59.5,85,119,85,110.5,170,425,510];
  assert.equal(rows.length, 32);
  assert.equal(new Set(rows.map(r => r.variant_id)).size, 32);
  assert.deepEqual(rows.map(r => r.list_price), base);
  assert.deepEqual(rows.map(r => r.price), net);
  for (const row of rows) {
    assert.equal(row.price_unit, 'occhio');
    assert.equal(row.pack_lenses, 1);
    assert.equal(row.discount_percent, 15);
    assert.equal(row.vendor, 'TS');
  }
});
test('two eyes cost 85 EUR and a 20 EUR deposit leaves 65 EUR', () => {
  const line = {...rows[0], quantity: 2};
  assert.deepEqual(pricingTotals([line]), {list_total: 100, discount_total: 15, total: 85});
  assert.equal(pricingTotals([line]).total - 20, 65);
  assert.equal(cashDraftLine(line).quantity, 2);
});
test('TS and Esoform share the discount without discounting ordinary or legacy lenses', () => {
  assert.equal(listLensProducts().length, 64);
  assert.equal(listLensProducts('', 'Esoform').length, 32);
  for (const id of ['ortok', 'rgp', 'sei_mesi_multifocali', 'permanenza', 'wave_mensili', 'ts:unknown', 'esoform:unknown']) {
    assert.equal(lensProduct(id), null);
  }
  const ordinary = {variant_id: 'gid://shopify/ProductVariant/123', price: 350, quantity: 1, vendor: 'TS'};
  const lines = [{...rows[0], quantity: 2}, {...listLensProducts('', 'Esoform')[0], quantity: 1}, ordinary];
  assert.deepEqual(pricingTotals(lines), {list_total: 495, discount_total: 21.75, total: 473.25});
  assert.deepEqual(cashDraftLine(ordinary), {variantId: ordinary.variant_id, quantity: 1});
  assert.equal(discountBrands(lines), 'TS / Esoform');
  assert.equal(cashDraftLine(lines[0]).appliedDiscount.title, 'Sconto TS 15%');
  assert.equal(cashDraftLine(lines[1]).appliedDiscount.title, 'Sconto Esoform 15%');
});
test('the original canonical price receives exactly one discount, ignoring browser overrides', () => {
  const draft = cashDraftLine({...rows[0], list_price: 1, price: 1, discount_percent: 90, quantity: 1});
  assert.deepEqual(draft.originalUnitPriceWithCurrency, {amount: '50.00', currencyCode: 'EUR'});
  assert.equal(draft.appliedDiscount.value, 15);
  assert.equal(draft.appliedDiscount.valueType, 'PERCENTAGE');
  assert.equal(draft.variantId, undefined);
  assert.equal(draft.customAttributes[0].value, 'TS');
});
test('hybrid lenses and cent rounding remain exact; mismatched totals cannot complete', () => {
  const hybrids = rows.slice(-2).map(r => ({...r, quantity: 1}));
  assert.deepEqual(pricingTotals(hybrids), {list_total: 1100, discount_total: 165, total: 935});
  const lines = [{...rows[0], quantity: 3}, {...listLensProducts('', 'Esoform')[4], quantity: 3}];
  assert.equal(pricingTotals(lines).total, 351.9);
  assert.doesNotThrow(() => assertLensTotal(lines, '351.90', 'EUR'));
  for (const actual of [351.91, 414, 299.115, NaN]) assert.throws(() => assertLensTotal(lines, actual));
  assert.throws(() => assertLensTotal(lines, 351.9, 'USD'));
});
test('search finds TS products and reserved IDs remain distinguishable from Shopify variants', () => {
  assert.equal(listLensProducts('ts MYOPIC torica').length, 3);
  assert.equal(listLensProducts('IBRIDA', 'TS').length, 2);
  assert.equal(listLensProducts('trimestrale multifocale inversa', 'TS').length, 1);
  assert.equal(listLensProducts('nessun-prodotto', 'TS').length, 0);
  assert.equal(isLensCatalogId('ts:unknown'), true);
  assert.equal(isLensCatalogId('esoform:unknown'), true);
  for (const id of [null, 123, '123', 'ortok', 'gid://shopify/ProductVariant/123']) assert.equal(isLensCatalogId(id), false);
});
