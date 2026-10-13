"""Release 20261013: Ufficio (operatori e Amministrazione), cliente collegato nelle schede, logo in fattura.

Ultimo passo della build Vercel, dopo apply_invoice_edit_access.py. Pubblica i nuovi moduli,
aggiunge il logo dell'ottica di Lallio alla fattura cliente e mantiene aperte in Amministrazione
le sezioni aggiunte (Ufficio, Corrispettivi, Fatturato e incassi) invece di tornare a Fatturazione.
Fallisce se un punto di aggancio non corrisponde: meglio una build ferma che un sito rotto.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_site'
ALIASES = ('gestionale-v2', 'gestionale-v3')
OFFICE_VERSION = '20261013-office1'
SHEET_VERSION = '20261013-sheetclient1'
INVOICE_VERSION = '20261013-invoice-logo1'
OLD_INVOICE_VERSION = '20260928-invoice-edit3'
ASSETS = {
    'optyker-office.js': OFFICE_VERSION,
    'optyker-office.css': OFFICE_VERSION,
    'sheet-client-picker.js': SHEET_VERSION,
    'sheet-client-picker.css': SHEET_VERSION,
}
SELLER_ADDRESS = 'Via I Maggio 4 · 24040 Lallio (BG)'


def replace_one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Release 20261013: aggancio "{label}" trovato {count} volte')
    return text.replace(old, new, 1)


def base_path():
    manifest = SITE / 'design-version.json'
    if manifest.is_file():
        value = json.loads(manifest.read_text(encoding='utf-8')).get('base_path', '/')
        if re.fullmatch(r'/(?:[A-Za-z0-9_.-]+/)?', value):
            return value
    return '/'


def tags():
    base = base_path()
    return '\n'.join([
        f'<link rel="stylesheet" id="optykerOfficeCss" href="{base}optyker-office.css?v={OFFICE_VERSION}">',
        f'<link rel="stylesheet" id="optykerSheetClientCss" href="{base}sheet-client-picker.css?v={SHEET_VERSION}">',
        f'<script id="optykerOfficeJs" defer src="{base}optyker-office.js?v={OFFICE_VERSION}"></script>',
        f'<script id="optykerSheetClientJs" defer src="{base}sheet-client-picker.js?v={SHEET_VERSION}"></script>',
    ])


def patch_page(html):
    for tag_id in ('optykerOfficeCss', 'optykerSheetClientCss', 'optykerOfficeJs', 'optykerSheetClientJs'):
        html = re.sub(r'<(?:link|script)[^>]*\bid="' + tag_id + r'"[^>]*>(?:</script>)?\n?', '', html)
    end = html.lower().rfind('</body>')
    if end < 0:
        raise SystemExit('Release 20261013: </body> non trovato')
    html = html[:end] + tags() + '\n' + html[end:]
    html = re.sub(r'(customer-invoice-print\.js)\?v=[^"\'\s<>&]*', r'\1?v=' + INVOICE_VERSION, html)
    return html


ADDON_HELPER = (
    "  // OPTYKER_ADMIN_ADDON_PANELS_20261013: Ufficio, Corrispettivi e Fatturato e incassi restano aperti\n"
    "  // finché la loro voce è attiva, invece di essere sostituiti dalla Fatturazione ogni 700 ms.\n"
    "  function optykerAdminAddonPanel(){var map={optykerOfficeAdminNav:'optykerOfficeAdminPanel',otkCorrNav:'otkCorrPanel',otkTurnNav:'otkTurnPanel'};"
    "for(var nav in map){var b=E(nav),p=E(map[nav]);if(b&&p&&b.classList.contains('active'))return p}return null}\n"
)
MAINTENANCE_OLD = (
    "        E('optykerAdminCashPanel').style.setProperty('display','block','important')\n"
    "      }else{\n"
    "        hideRegularPanels();"
)
MAINTENANCE_NEW = (
    "        E('optykerAdminCashPanel').style.setProperty('display','block','important')\n"
    "      }else if(optykerAdminAddonPanel()){\n"
    "        var bp2=E('optykerBillingPanel');if(bp2)bp2.style.setProperty('display','none','important');\n"
    "        var sp2=E('optykerSettingsPanel');if(sp2)sp2.style.setProperty('display','none','important');\n"
    "        optykerAdminAddonPanel().style.setProperty('display','block','important')\n"
    "      }else{\n"
    "        hideRegularPanels();"
)


def patch_billing_admin(text):
    if 'OPTYKER_ADMIN_ADDON_PANELS_20261013' not in text:
        text = replace_one(text, '  function maintenance(){', ADDON_HELPER + '  function maintenance(){', 'maintenance()')
        text = replace_one(text, MAINTENANCE_OLD, MAINTENANCE_NEW, 'pannelli Amministrazione')
    text = text.replace('customer-invoice-print.js?v=' + OLD_INVOICE_VERSION, 'customer-invoice-print.js?v=' + INVOICE_VERSION)
    return text


def patch_invoice(text):
    if 'OPTYKER_INVOICE_LOGO_20261013' in text:
        return text
    logo = 'data:image/webp;base64,' + base64.b64encode((ROOT / 'ovc-print-logo.webp').read_bytes()).decode('ascii')
    text = replace_one(
        text,
        "var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-customer-invoice-print-api';",
        "/* OPTYKER_INVOICE_LOGO_20261013: logo e indirizzo dell'ottica di Lallio nell'intestazione. */\n"
        "var OVC_INVOICE_LOGO='" + logo + "';\n"
        "var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-customer-invoice-print-api';",
        'API fattura')
    text = replace_one(
        text,
        "'<header><div><div class=\"brand\">'",
        "'<header><div class=\"seller\"><img class=\"sellerLogo\" src=\"'+OVC_INVOICE_LOGO+'\" alt=\"Ottica Visual Care · Lallio\"><div><div class=\"brand\">'",
        'intestazione fattura')
    text = replace_one(
        text,
        "'</div></div><div class=\"doc\"><div class=\"docKind\">'",
        "'</div><div class=\"addr\">" + SELLER_ADDRESS + "</div></div></div><div class=\"doc\"><div class=\"docKind\">'",
        'blocco venditore')
    text = replace_one(
        text,
        "var STYLE='*{box-sizing:border-box}",
        "var STYLE='.seller{display:flex;align-items:center;gap:18px;min-width:0}"
        ".sellerLogo{width:88px;height:88px;flex:0 0 88px;object-fit:contain;display:block}"
        ".addr{margin-top:4px;font-size:11px;color:#607587}"
        "@media print{.sellerLogo{-webkit-print-color-adjust:exact;print-color-adjust:exact}}"
        "@media(max-width:560px){.seller{gap:12px}.sellerLogo{width:64px;height:64px;flex-basis:64px}}"
        "*{box-sizing:border-box}",
        'stile fattura')
    text = text.replace(OLD_INVOICE_VERSION, INVOICE_VERSION)
    return text


def main():
    for name in ASSETS:
        src = ROOT / name
        if not src.is_file():
            raise SystemExit('Release 20261013: manca ' + name)
        shutil.copyfile(src, SITE / name)

    pages = [SITE / 'index.html'] + [SITE / alias / 'index.html' for alias in ALIASES]
    pages = [p for p in pages if p.is_file()]
    aliases_equal = len({p.read_bytes() for p in pages}) == 1
    for page in pages:
        page.write_text(patch_page(page.read_text(encoding='utf-8')), encoding='utf-8')
    if aliases_equal and len({p.read_bytes() for p in pages}) != 1:
        raise SystemExit('Release 20261013: le pagine gestionale non sono più identiche')

    billing = patch_billing_admin((SITE / 'billing-admin.js').read_text(encoding='utf-8'))
    invoice = patch_invoice((SITE / 'customer-invoice-print.js').read_text(encoding='utf-8'))
    (SITE / 'billing-admin.js').write_text(billing, encoding='utf-8')
    (SITE / 'customer-invoice-print.js').write_text(invoice, encoding='utf-8')
    for alias in ALIASES:
        for name, text in (('billing-admin.js', billing), ('customer-invoice-print.js', invoice)):
            target = SITE / alias / name
            if target.exists():
                target.write_text(text, encoding='utf-8')

    html = (SITE / 'index.html').read_text(encoding='utf-8')
    for needle in ('id="optykerOfficeJs"', 'id="optykerSheetClientJs"', 'customer-invoice-print.js?v=' + INVOICE_VERSION):
        if needle not in html:
            raise SystemExit('Release 20261013: manca nella pagina ' + needle)
    for needle in ('OPTYKER_INVOICE_LOGO_20261013', 'sellerLogo', SELLER_ADDRESS, "version:'" + INVOICE_VERSION + "'"):
        if needle not in invoice:
            raise SystemExit('Release 20261013: fattura senza ' + needle)
    if 'optykerAdminAddonPanel()' not in billing or 'customer-invoice-print.js?v=' + INVOICE_VERSION not in billing:
        raise SystemExit('Release 20261013: Amministrazione non aggiornata')

    manifest = {
        'release': '20261013',
        'office': OFFICE_VERSION,
        'sheet_client': SHEET_VERSION,
        'invoice': INVOICE_VERSION,
        'assets': {name: hashlib.sha256((SITE / name).read_bytes()).hexdigest() for name in
                   list(ASSETS) + ['billing-admin.js', 'customer-invoice-print.js']},
    }
    (SITE / 'release-20261013-version.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Release 20261013 published: Ufficio, cliente nelle schede, logo in fattura')


if __name__ == '__main__':
    main()
