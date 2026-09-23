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
python scripts/patch_customer_invoice_print_20260915.py
python scripts/patch_rch_relay_order_20260915.py
python scripts/patch_public_asset_paths.py
python scripts/check_desktop_html.py
node --check _site/admin-cash-closure.js
node --check _site/cash-pos5.js
node --check _site/cash-register.js
node --check _site/optyker-operations.js
node --check _site/rch-cloud-relay.js
node --check _site/customer-invoice-print.js
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
grep -Fq 'Visualizza / Stampa' _site/index.html
grep -Fq 'optykerCustomerInvoicePrintJs' _site/index.html
grep -Fq 'optyker-customer-invoice-print-api' _site/customer-invoice-print.js
if grep -Fq 'fic_send' _site/customer-invoice-print.js; then
  echo 'Customer invoice print flow must not send to SDI' >&2
  exit 1
fi
grep -Fq "selectFrame(Number(this.getAttribute('data-ey-frame')))" _site/index.html
grep -Fq "OPTYKER_EYEWEAR_ORDER_BUTTON_VISIBLE_20260915" _site/optyker-operations.js
grep -Fq "b.className='eyBtn primary'" _site/optyker-operations.js
grep -Fq "b.onclick=()=>sendOrder()" _site/optyker-operations.js
grep -Fq "?'Invia ordine':'Ordina lenti'" _site/optyker-operations.js
grep -Fq "function tick(){ensureOrderButton();if(!logged()){" _site/optyker-operations.js
if grep -Fq "b.hidden=!job" _site/optyker-operations.js; then
  echo 'Eyewear order button is still Busta-only hidden' >&2
  exit 1
fi
grep -Fq 'id="optykerRchCloudRelayJs" defer src="/rch-cloud-relay.js?v=20260915-relay5"' _site/index.html
grep -Fq "String(s.idleState)!=='0'" _site/rch-cloud-relay.js
grep -Fq "['busy','errorCode','printerError','paperEnd','coverOpen']" _site/rch-cloud-relay.js
test -s _site/rch-connector/Aggiorna-RCH-POS.bat
test -s _site/rch-connector/Aggiorna-RCH-POS.ps1
grep -q 'zeroReceipt=\$true' _site/rch-connector/Aggiorna-RCH-POS.ps1
grep -q 'Comando di chiusura fiscale non consentito' _site/rch-connector/Aggiorna-RCH-POS.ps1
python scripts/apply_cash_cart_selection.py
node --check _site/cash-register.js
node --test tests/cash-cart-selection.test.mjs
grep -q '20260916-selection3' _site/cash-register.js
grep -q 'data-price' _site/cash-register.js
python scripts/apply_eyewear_order_parameters.py
node --check _site/order-sheet-actions.js
node --test tests/eyewear-order-parameters.test.mjs
python scripts/apply_unified_fiscal_void.py
node --check _site/unified-fiscal-void.js
node --test tests/unified-fiscal-void.test.mjs
node --check eyewear-manual-final-price-v14.js
python scripts/patch_eyewear_manual_final_price_20260916.py
grep -q 'OPTYKER_EYEWEAR_MANUAL_FINAL_PRICE_V14' _site/index.html
grep -q '20260916-finalprice2' _site/index.html
grep -q 'eyManualFinalPrice' _site/index.html
grep -q 'restoreManualFinalCurrent' _site/index.html
node --check sheet-reference-numbers.js
python scripts/patch_sheet_reference_numbers_20260916.py
grep -q 'optykerSheetReferenceNumbersJs' _site/index.html
grep -q 'OPTYKER_SHEET_REFERENCE_NUMBERS_20260918' _site/sheet-reference-numbers.js
grep -q '20260918-sheetrefs3-visible' _site/index.html
python scripts/patch_rch_daily_closure_compat_20260916.py
node --check _site/rch-cloud-relay.js
grep -Fq '2\.2-daily-closure' _site/rch-cloud-relay.js
python scripts/patch_login_interaction_20260919.py
grep -q 'OPTYKER_LOGIN_INTERACTION_20260919' _site/index.html
grep -q '20260919-login-click1' _site/index.html
python scripts/check_desktop_html.py
# Read-only customer lookup, with unchanged payment and pending-receipt guards.
node --check cash-client-search.js
python scripts/apply_cash_client_search.py
node --check _site/cash-register.js
python scripts/check_desktop_html.py
echo 'Optyker final production patches OK'
# Same-day cash sessions; no printer commands during build or deployment.
python scripts/apply_cash_sessions.py
node --check _site/cash-sessions.js
node --check _site/cash-day-control.js
python scripts/check_desktop_html.py

# Client LAC product workspace for production domain: trial vs final lenses.
node --check client-lac-products.js
node --test tests/client-lac-products.test.cjs
python scripts/apply_client_lac_products.py
node --check _site/client-lac-products.js
python scripts/check_desktop_html.py
grep -q 'optykerClientLacProductsJs' _site/index.html
grep -q 'Lenti di prova' _site/client-lac-products.js
grep -q 'Lenti finali' _site/client-lac-products.js
test -s _site/client-lac-products-version.json
echo 'Client LAC product workspace installed on production build'
