#!/usr/bin/env bash
set -e
python scripts/patch_shifts_save_refresh_20260914.py
python scripts/patch_agenda_overlap_native_20260914.py
python scripts/apply_admin_cash_closure.py
python scripts/apply_cash_pos5.py
python scripts/patch_agenda_auto_studio_20260915.py
python scripts/patch_public_asset_paths.py
python scripts/check_desktop_html.py
node --check _site/admin-cash-closure.js
node --check _site/cash-pos5.js
grep -q '__OPTYKER_ADMIN_CASH_CLOSURE_V2__' _site/admin-cash-closure.js
grep -q 'optykerAdminCashClosureJs' _site/index.html
grep -q 'optykerAdminCashClosureCss' _site/index.html
grep -q 'optykerCashPos5Js' _site/index.html
grep -q '20260914-pos5' _site/cash-pos5.js
grep -q 'optykerCashLotteryCode' _site/cash-pos5.js
grep -q 'order_missing_items' _site/cash-pos5.js
grep -q 'Consegna' _site/cash-pos5.js
grep -q 'OPTYKER_AGENDA_AUTO_STUDIO_20260915' _site/index.html
grep -q "autoStudio" _site/index.html
test -s _site/rch-connector/Aggiorna-RCH-POS.bat
test -s _site/rch-connector/Aggiorna-RCH-POS.ps1
grep -q 'zeroReceipt=\$true' _site/rch-connector/Aggiorna-RCH-POS.ps1
grep -q 'Comando di chiusura fiscale non consentito' _site/rch-connector/Aggiorna-RCH-POS.ps1
echo 'Optyker final production patches OK'
