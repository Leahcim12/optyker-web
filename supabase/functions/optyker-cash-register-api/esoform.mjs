import catalog from './esoform-products.json' with { type: 'json' };

export const ESOFORM_VERSION = catalog.version;
const cents = (n) => Math.round(n * 100);
const rounded = (n) => cents(n) / 100;

// IDs, base prices and the discount are resolved here, never from the browser.
export function esoformProduct(id) {
  const p = catalog.products.find(p => 'esoform:' + p.id === id);
  if (!p) return null;
  const price = Math.round(cents(p.price) * (100 - catalog.discount_percent) / 100) / 100;
  return {
    catalog_id: p.id, catalog_version: catalog.version,
    product_id: '', variant_id: 'esoform:' + p.id,
    title: 'Esoform · ' + p.name,
    variant_title: p.pack_lenses === 3 ? 'Confezione 3 lenti per occhio' : 'Prezzo per occhio',
    vendor: 'Esoform', product_type: 'LAC Esoform', sku: p.id.toUpperCase(),
    barcode: '', image: '', available: true, inventory_quantity: null,
    list_price: p.price, discount_percent: catalog.discount_percent,
    discount_amount: rounded(p.price - price), price, price_unit: 'occhio',
    pack_lenses: p.pack_lenses
  };
}

export function listEsoformProducts(search = '') {
  const words = search.toLocaleLowerCase('it').trim().split(/\s+/).filter(Boolean);
  return catalog.products.map(p => esoformProduct('esoform:' + p.id))
    .filter(p => words.every(w => (p.title + ' ' + p.sku).toLocaleLowerCase('it').includes(w)));
}

export function pricingTotals(lines) {
  const gross = lines.reduce((sum, l) => sum + cents(l.list_price ?? l.price) * l.quantity, 0);
  const net = lines.reduce((sum, l) => sum + cents(l.price) * l.quantity, 0);
  return { list_total: gross / 100, discount_total: (gross - net) / 100, total: net / 100 };
}

export function cashDraftLine(line) {
  const p = esoformProduct(line.variant_id);
  if (!p) return { variantId: line.variant_id, quantity: line.quantity };
  return {
    title: p.title, sku: p.sku, quantity: line.quantity,
    originalUnitPriceWithCurrency: { amount: p.list_price.toFixed(2), currencyCode: 'EUR' },
    appliedDiscount: { title: 'Sconto Esoform 15%', description: 'Sconto automatico sul prezzo per occhio', value: 15, valueType: 'PERCENTAGE' },
    customAttributes: [
      { key: 'Listino', value: 'Esoform' },
      { key: 'Codice Optyker', value: p.catalog_id },
      { key: 'Unità', value: p.variant_title }
    ]
  };
}

export function assertEsoformTotal(lines, actual, currency = 'EUR') {
  if (!lines.some(l => esoformProduct(l.variant_id))) return;
  const expected = pricingTotals(lines).total;
  if (currency !== 'EUR' || !Number.isFinite(Number(actual)) || cents(Number(actual)) !== cents(expected)) {
    throw new Error('Totale Esoform diverso dal carrello scontato. Vendita non completata: verifica prezzi e imposte.');
  }
}
