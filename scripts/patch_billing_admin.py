from pathlib import Path

path = Path("_site/index.html")
text = path.read_text(encoding="utf-8")

css = '<link rel="stylesheet" href="/billing-admin.css?v=20260903-adminnav1" id="optykerBillingAdminCss">'
js = '<script src="/billing-admin.js?v=20260903-adminnav1" id="optykerBillingAdminScript"></script>'

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

path.write_text(text, encoding="utf-8")
print("Billing admin loader applicato")
