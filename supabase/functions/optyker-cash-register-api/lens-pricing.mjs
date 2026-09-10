import esoform from './esoform-products.json' with { type: 'json' };
import ts from './ts-products.json' with { type: 'json' };

const catalogs = { esoform, ts };

export const LENS_CATALOG_VERSION = ts.version;
export const ESOFORM_VERSION = esoform.version;
const cents = (n) => Math.round(n * 100);
const rounded = (n) => cents(n) / 100;

// IDs, base prices and the discount are resolved here, never from the browser.
export function isLensCatalogId(id) {
  return typeof id === 'string' && /^(esoform|ts):/.test(id);
}

export function lensProduct(id) {
  if (!isLensCatalogId(id)) return null;
  const prefix = id.split(':')[0];
  const catalog = catalogs[prefix];
  const p = catalog.products.find(p => prefix + ':' + p.id === id);
  if (!p) return null;
  const price = Math.round(cents(p.price) * (100 - catalog.discount_percent) / 100) / 100;
  return {
    catalog_id: p.id, catalog_version: catalog.version,
    product_id: '', variant_id: prefix + ':' + p.id,
    title: catalog.brand + ' · ' + p.name,
    variant_title: p.pack_lenses === 3 ? 'Confezione 3 lenti per occhio' : 'Prezzo per occhio',
    vendor: catalog.brand, product_type: 'LAC ' + catalog.brand, sku: p.id.toUpperCase(),
    barcode: '', image: '', available: true, inventory_quantity: null,
    list_price: p.price, discount_percent: catalog.discount_percent,
    discount_amount: rounded(p.price - price), price, price_unit: 'occhio',
    pack_lenses: p.pack_lenses
  };
}

export function listLensProducts(search = '', brand = '') {
  const words = search.toLocaleLowerCase('it').trim().split(/\s+/).filter(Boolean);
  return Object.entries(catalogs).filter(([, c]) => !brand || c.brand === brand)
    .flatMap(([prefix, c]) => c.products.map(p => lensProduct(prefix + ':' + p.id)))
    .filter(p => words.every(w => (p.title + ' ' + p.sku).toLocaleLowerCase('it').includes(w)));
}

export function pricingTotals(lines) {
  const gross = lines.reduce((sum, l) => sum + cents(l.list_price ?? l.price) * l.quantity, 0);
  const net = lines.reduce((sum, l) => sum + cents(l.price) * l.quantity, 0);
  return { list_total: gross / 100, discount_total: (gross - net) / 100, total: net / 100 };
}

export function cashDraftLine(line) {
  const p = lensProduct(line.variant_id);
  if (!p) return { variantId: line.variant_id, quantity: line.quantity };
  return {
    title: p.title, sku: p.sku, quantity: line.quantity,
    originalUnitPriceWithCurrency: { amount: p.list_price.toFixed(2), currencyCode: 'EUR' },
    appliedDiscount: { title: 'Sconto ' + p.vendor + ' 15%', description: 'Sconto automatico sul prezzo per occhio', value: 15, valueType: 'PERCENTAGE' },
    customAttributes: [
      { key: 'Listino', value: p.vendor },
      { key: 'Codice Optyker', value: p.catalog_id },
      { key: 'Unità', value: p.variant_title }
    ]
  };
}

export function assertLensTotal(lines, actual, currency = 'EUR') {
  if (!lines.some(l => lensProduct(l.variant_id))) return;
  const expected = pricingTotals(lines).total;
  if (currency !== 'EUR' || !Number.isFinite(Number(actual)) || cents(Number(actual)) !== cents(expected)) {
    throw new Error('Totale lenti diverso dal carrello scontato. Vendita non completata: verifica prezzi e imposte.');
  }
}

export function discountBrands(lines) {
  return [...new Set(lines.filter(l => Number(l.discount_percent) > 0)
    .map(l => lensProduct(l.variant_id)?.vendor).filter(Boolean))].join(' / ');
}
