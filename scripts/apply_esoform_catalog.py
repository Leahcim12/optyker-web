"""Add Esoform's per-eye catalog without altering the other lens price lists."""
from pathlib import Path
import json, re, os, hashlib

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(__import__('sys').argv[1]) if len(__import__('sys').argv) > 1 else ROOT / '_site'
catalog = json.loads((ROOT / 'supabase/functions/optyker-cash-register-api/esoform-products.json').read_text())
products = catalog['products']
assert len(products) == 32 and len({p['id'] for p in products}) == 32
assert catalog['discount_percent'] == 15
marker = '/* OPTYKER_ESOFORM_CATALOG_V1 */'
p = SITE / 'index.html'
h = p.read_text()
if marker not in h:
    needle = 'var LAC_PRODUCT_CATALOGS={Esoform:cloneCatalog(),Wave:cloneCatalog(),TS:cloneCatalog(),Commerciale:COMMERCIALE_SNAPSHOT.slice()};'
    if h.count(needle) != 1:
        raise SystemExit('Esoform: original catalog definition is missing or ambiguous')
    addition = '\n  ' + marker + '\n  LAC_PRODUCT_CATALOGS.Esoform=LAC_PRODUCT_CATALOGS.Esoform.concat(' + json.dumps(products, ensure_ascii=False) + ');'
    h = h.replace(needle, needle + addition, 1)
    # Product names and original prices remain suitable for saved LAC sheets.
    needle = 'syncBrandUi();\n  }\n  async function loadCommercialeLive()'
    if h.count(needle) != 1:
        raise SystemExit('Esoform: catalog UI contract missing')
    addition = """syncBrandUi();
    var hint=e('lacEsoformDiscountHint');
    if(!hint&&e('lacCatalogList')){hint=document.createElement('p');hint.id='lacEsoformDiscountHint';e('lacCatalogList').insertAdjacentElement('afterend',hint);}
    if(hint){hint.hidden=lacCurrentBrand!=='Esoform';hint.textContent='Nuove lenti mensili, trimestrali, semestrali e annuali: sconto automatico 15% in cassa su scontrino/fattura. Prezzi per occhio; 3L indica una confezione di 3 lenti.';}
  }
  async function loadCommercialeLive()"""
    h = h.replace(needle, addition, 1)

# This runs after the existing cash/cart patches so their exact contracts survive.
h = re.sub(r'(cash-register\.js|billing-admin\.js)\?[^\"\'< >\s]+', lambda m: m[1] + '?v=' + catalog['version'], h)
p.write_text(h)
for alias in ('gestionale-v2', 'gestionale-v3'):
    target = SITE / alias / 'index.html'
    if target.exists():
        target.write_text(h)
cash = SITE / 'cash-register.js'
s = re.sub(r"window.OPTYKER_CASH_BUILD='[^']+'", "window.OPTYKER_CASH_BUILD='" + catalog['version'] + "'", cash.read_text())
cash.write_text(s)
# Keep the existing release manifest consistent with the updated POS asset.
manifest = SITE / 'cart-privacy-version.json'
if manifest.exists():
    release = json.loads(manifest.read_text())
    if 'cash-register.js' in release.get('assets', {}):
        release['assets']['cash-register.js'] = hashlib.sha256(cash.read_bytes()).hexdigest()
        manifest.write_text(json.dumps(release, indent=2) + '\n')
(SITE / 'esoform-version.json').write_text(json.dumps({
    'version': catalog['version'], 'commit': os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA', ''),
    'products': len(products), 'discount_percent': 15, 'price_unit': 'occhio',
    'catalog_sha256': hashlib.sha256(json.dumps(catalog, sort_keys=True).encode()).hexdigest()
}, indent=2) + '\n')
print('Esoform: 32 additional lenses, original per-eye prices, automatic 15% POS discount')
