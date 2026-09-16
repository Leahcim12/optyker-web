from pathlib import Path
import shutil

path = Path("_site/index.html")
text = path.read_text(encoding="utf-8")

css = '<link rel="stylesheet" href="/billing-admin.css?v=20260903-adminnav1" id="optykerBillingAdminCss">'
js = '<script src="/billing-admin.js?v=20260903-adminnav1" id="optykerBillingAdminScript"></script>'
split_js = '<script src="/billing-customer-company-split.js?v=20260916-split1" id="optykerBillingCustomerCompanySplitScript"></script>'

if 'id="optykerBillingAdminCss"' not in text:
    if "</head>" in text:
        text = text.replace("</head>", css + "\n</head>", 1)
    else:
        text = css + "\n" + text

if 'id="optykerBillingAdminScript"' not in text:
    pos = text.rfind("</body>")
    if pos >= 0:
        text = text[:pos] + js + "\n" + text[pos:]
    else:
        text += "\n" + js

# Customer invoices are a separate no-SDI archive. Keep this loader independent
# from the administration bundle so later admin/cash patches cannot remove it.
source = Path('billing-customer-company-split.js')
target = Path('_site/billing-customer-company-split.js')
if not source.is_file():
    raise SystemExit('billing-customer-company-split.js missing')
shutil.copyfile(source, target)

# Remove an older split loader before adding the current version.
import re
text = re.sub(r'<script\b[^>]*id=["\']optykerBillingCustomerCompanySplitScript["\'][^>]*>\s*</script>\s*', '', text, flags=re.I)
pos = text.rfind('</body>')
if pos >= 0:
    text = text[:pos] + split_js + "\n" + text[pos:]
else:
    text += "\n" + split_js

path.write_text(text, encoding="utf-8")
print("Billing admin + separazione fatture clienti/aziende applicati")
