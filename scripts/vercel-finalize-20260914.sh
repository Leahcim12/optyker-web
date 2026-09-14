#!/usr/bin/env bash
set -e
python scripts/patch_shifts_save_refresh_20260914.py
python scripts/patch_agenda_overlap_native_20260914.py
python scripts/apply_admin_cash_closure.py
python scripts/patch_public_asset_paths.py
python scripts/check_desktop_html.py
node --check _site/admin-cash-closure.js
grep -q '__OPTYKER_ADMIN_CASH_CLOSURE_V2__' _site/admin-cash-closure.js
grep -q 'optykerAdminCashClosureJs' _site/index.html
grep -q 'optykerAdminCashClosureCss' _site/index.html
echo 'Optyker final production patches OK'
