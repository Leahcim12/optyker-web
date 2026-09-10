// Preserve the existing Esoform API while both brands share canonical pricing.
import { lensProduct, listLensProducts } from './lens-pricing.mjs';
export { ESOFORM_VERSION, pricingTotals, cashDraftLine, assertLensTotal as assertEsoformTotal } from './lens-pricing.mjs';
export function esoformProduct(id) {
  return typeof id === 'string' && id.startsWith('esoform:') ? lensProduct(id) : null;
}
export function listEsoformProducts(search = '') { return listLensProducts(search, 'Esoform'); }
