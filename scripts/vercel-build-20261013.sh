#!/usr/bin/env bash
# Build Vercel completa. vercel.json accetta al massimo 256 caratteri nel buildCommand,
# quindi la sequenza vive qui. Ordine invariato rispetto al buildCommand precedente,
# poi le release successive; i passi nuovi vanno aggiunti qui, non in vercel.json.
set -e
bash scripts/vercel-build-v13.sh
bash scripts/vercel-finalize-20260914.sh
node --test tests/invoice-edit.test.cjs
python scripts/apply_invoice_edit_access.py
node --check _site/customer-invoice-print.js
node --check _site/billing-admin.js

# Release 20261013: Ufficio, cliente nelle schede, logo in fattura.
node --check optyker-office.js
node --check sheet-client-picker.js
python scripts/apply_release_20261013.py
node --check _site/customer-invoice-print.js
node --check _site/billing-admin.js
node --check _site/optyker-office.js
node --check _site/sheet-client-picker.js

# Report 20261014: richiami del mese e giacenze di magazzino.
node --check optyker-report.js
python scripts/apply_report_20261014.py
node --check _site/optyker-report.js
python scripts/check_desktop_html.py
