#!/usr/bin/env bash
set -e
python scripts/patch_shifts_save_refresh_20260914.py
python scripts/patch_agenda_overlap_native_20260914.py
python scripts/apply_admin_cash_closure.py
python scripts/apply_cash_pos5.py
python scripts/patch_agenda_auto_studio_20260915.py
python scripts/patch_agenda_staff_rules_20260915.py
python scripts/prepare_order_cart_lab_20260915.py
python scripts/patch_order_cart_lab_20260915.py
python scripts/patch_eyewear_frame_selection_20260915.py
python scripts/patch_eyewear_order_button_visible_20260915.py
python scripts/patch_public_asset_paths.py
python scripts/check_desktop_html.py
node --check _site/admin-cash-closure.js
node --check _site/cash-pos5.js
node --check _site/cash-register.js
node --check _site/optyker-operations.js
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
grep -q 'OPTYKER_AGENDA_STAFF_RULES_20260915' _site/index.html
grep -q 'oaPrivateNotes' _site/index.html
grep -q 'oaV10ForceOccupied' _site/index.html
grep -q 'Fiera / trasferta' _site/index.html
grep -q 'almeno email oppure telefono' _site/index.html
grep -q '__OPTYKER_CLIENT_CART_PERSISTENCE_V1__' _site/cash-register.js
grep -q 'OPTYKER_ORDER_CART_LAB_20260915' _site/index.html
grep -q 'Pronto per la consegna' _site/index.html
grep -Fq "selectFrame(Number(this.getAttribute('data-ey-frame')))" _site/index.html
grep -Fq "OPTYKER_EYEWEAR_ORDER_BUTTON_VISIBLE_20260915" _site/optyker-operations.js
grep -Fq "b.className='eyBtn primary'" _site/optyker-operations.js
grep -Fq "b.onclick=()=>sendOrder()" _site/optyker-operations.js
grep -Fq "b.textContent=orderBusy?'Ordino…':'Ordina lenti'" _site/optyker-operations.js
grep -Fq "function tick(){ensureOrderButton();if(!logged()){" _site/optyker-operations.js
if grep -Fq "b.hidden=!job" _site/optyker-operations.js; then
  echo 'Eyewear order button is still Busta-only hidden' >&2
  exit 1
fi
test -s _site/rch-connector/Aggiorna-RCH-POS.bat
test -s _site/rch-connector/Aggiorna-RCH-POS.ps1
grep -q 'zeroReceipt=\$true' _site/rch-connector/Aggiorna-RCH-POS.ps1
grep -q 'Comando di chiusura fiscale non consentito' _site/rch-connector/Aggiorna-RCH-POS.ps1
echo 'Optyker final production patches OK'
