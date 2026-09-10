"""Append the TS lenses; preserve existing TS, Esoform and other catalogs."""
from pathlib import Path
import json, re, os, hashlib

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(__import__('sys').argv[1]) if len(__import__('sys').argv) > 1 else ROOT / '_site'
catalog = json.loads((ROOT / 'supabase/functions/optyker-cash-register-api/ts-products.json').read_text())
products = catalog['products']
assert len(products) == 32 and len({p['id'] for p in products}) == 32
assert catalog['brand'] == 'TS' and catalog['discount_percent'] == 15
marker = '/* OPTYKER_TS_CATALOG_V1 */'
p = SITE / 'index.html'
h = p.read_text()
if marker not in h:
    needle = 'var LAC_PRODUCT_CATALOGS={Esoform:cloneCatalog(),Wave:cloneCatalog(),TS:cloneCatalog(),Commerciale:COMMERCIALE_SNAPSHOT.slice()};'
    if h.count(needle) != 1:
        raise SystemExit('TS: original catalog definition is missing or ambiguous')
    addition = '\n  ' + marker + '\n  LAC_PRODUCT_CATALOGS.TS=LAC_PRODUCT_CATALOGS.TS.concat(' + json.dumps(products, ensure_ascii=False) + ');'
    h = h.replace(needle, needle + addition, 1)
    needle = 'syncBrandUi();\n'
    if h.count(needle) != 1:
        raise SystemExit('TS: catalog UI contract missing')
    addition = """    var tsHint=e('lacTsDiscountHint');
    if(!tsHint&&e('lacCatalogList')){tsHint=document.createElement('p');tsHint.id='lacTsDiscountHint';e('lacCatalogList').insertAdjacentElement('afterend',tsHint);}
    if(tsHint){tsHint.hidden=lacCurrentBrand!=='TS';tsHint.textContent='Nuove lenti trimestrali, semestrali, annuali e ibride: sconto automatico 15% in cassa su scontrino/fattura. Prezzi per singolo occhio.';}
"""
    h = h.replace(needle, needle + addition, 1)

h = re.sub(r'(cash-register\.js|billing-admin\.js)\?[^\"\'< >\s]+', lambda m: m[1] + '?v=' + catalog['version'], h)
p.write_text(h)
for alias in ('gestionale-v2', 'gestionale-v3'):
    target = SITE / alias / 'index.html'
    if target.exists():
        target.write_text(h)
cash = SITE / 'cash-register.js'
cash.write_text(re.sub(r"window.OPTYKER_CASH_BUILD='[^']+'", "window.OPTYKER_CASH_BUILD='" + catalog['version'] + "'", cash.read_text()))
manifest = SITE / 'cart-privacy-version.json'
if manifest.exists():
    release = json.loads(manifest.read_text())
    if 'cash-register.js' in release.get('assets', {}):
        release['assets']['cash-register.js'] = hashlib.sha256(cash.read_bytes()).hexdigest()
        manifest.write_text(json.dumps(release, indent=2) + '\n')
(SITE / 'ts-version.json').write_text(json.dumps({
    'version': catalog['version'], 'commit': os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA', ''),
    'products': len(products), 'discount_percent': 15, 'price_unit': 'occhio',
    'catalog_sha256': hashlib.sha256(json.dumps(catalog, sort_keys=True).encode()).hexdigest()
}, indent=2) + '\n')
print('TS: 32 additional lenses, per-eye prices and automatic 15% POS discount')
