#!/usr/bin/env bash
set -e

# Vercel's build image may not include cmp. Keep byte-for-byte checks using
# Python, which is already required by every patch step in this build.
verify_desktop_aliases() {
  python - <<'VERIFY_ALIASES'
from pathlib import Path

root = Path('_site')
try:
    original = (root / 'index.html').read_bytes()
    if not original:
        raise SystemExit('Desktop verification failed: index.html is empty')
    for alias in ('gestionale-v2', 'gestionale-v3'):
        target = root / alias / 'index.html'
        if target.read_bytes() != original:
            raise SystemExit('Desktop verification failed: ' + str(target) + ' differs from index.html')
except OSError as exc:
    raise SystemExit('Desktop verification failed: ' + str(exc))
print('Desktop entry points verified byte-for-byte (Python; no cmp dependency)')
VERIFY_ALIASES
}

bash scripts/vercel-build-v12.sh
python scripts/patch_eyewear_summary_stability_v13.py
python scripts/patch_quote_dates_red.py

cp billing-compose.js _site/billing-compose.js
cp foreign-invoices.js _site/foreign-invoices.js
cp billing-compose.css _site/billing-compose.css

python - <<'CACHE'
from pathlib import Path
import re
p=Path('_site/index.html')
text=p.read_text()
text=re.sub(r'/billing-admin\.css(?:\?[^\"\']*)?', '/billing-admin.css?v=20260909-foreign1', text)
p.write_text(re.sub(r'/billing-admin\.js(?:\?[^\"\']*)?', '/billing-admin.js?v=20260909-foreign1', text))
CACHE

cp _site/index.html _site/gestionale-v2/index.html
cp _site/index.html _site/gestionale-v3/index.html

node --check eyewear-summary-stability-v13.js

grep -q "OPTYKER_EYEWEAR_SUMMARY_STABILITY_V13" _site/index.html
grep -q "20260907-eyewear-summary-v13" _site/index.html
grep -q "Lente DX" _site/index.html
grep -q "Lente SX" _site/index.html
grep -q "OPTYKER_QUOTE_DATES_RED_V1" _site/index.html
grep -q "optykerQuoteDateRed" _site/index.html

echo "Optyker production build V13 OK"

# Screen-only redesign. The patch verifies existing scripts and form controls.
python scripts/apply_aurora_design.py
grep -q 'id="optykerAuroraCss"' _site/index.html
test -s _site/optyker-aurora.css

# Reference-matched dashboard: preserve original application scripts and read live data.
node --check optyker-vision.js
python scripts/apply_vision_design.py
grep -q 'id="optykerVisionCss"' _site/index.html
grep -q 'id="optykerVisionJs"' _site/index.html
test -s _site/optyker-vision-eye.webp
verify_desktop_aliases
echo "Optyker Vision production build OK"

# Agenda and anagrafica presentation, preserving existing scripts and controls.
node --check optyker-workspace.js
python scripts/apply_workspace_design.py
grep -q 'id="optykerWorkspaceCss"' _site/index.html
grep -q 'id="optykerWorkspaceJs"' _site/index.html
test -s _site/optyker-workspace.css
test -s _site/workspace-version.json
verify_desktop_aliases
echo "Optyker Workspace production build OK"

# Chat, Cassa and Documenti: additive screen styles and accessibility.
node --check optyker-services.js
python scripts/apply_services_design.py
grep -q 'id="optykerServicesCss"' _site/index.html
grep -q 'id="optykerServicesJs"' _site/index.html
test -s _site/optyker-services.css
test -s _site/services-version.json
verify_desktop_aliases
echo "Optyker Services production build OK"

# Cart-first POS, register icon and the separately authenticated privacy workflow.
node --check optyker-privacy.js
python scripts/apply_cart_privacy.py
node --check _site/cash-register.js
node --check _site/optyker-vision.js
grep -q 'id="optykerPrivacyJs"' _site/index.html
grep -q 'function openProductPicker' _site/cash-register.js
test -s _site/cart-privacy-version.json
verify_desktop_aliases
echo "Optyker Cart Privacy build OK"

# Canonical Esoform prices and per-line discount, after cart patches.
python scripts/apply_esoform_catalog.py
node --check _site/cash-register.js
node --test tests/esoform-pricing.test.mjs
verify_desktop_aliases

# Extend the same canonical discount rules to the new TS lenses.
python scripts/apply_ts_catalog.py
node --test tests/ts-pricing.test.mjs
verify_desktop_aliases

# Complete OVC Card, service repricing and eyewear laboratory integration.
node --check optyker-operations.js
python scripts/apply_ovc_operations.py
node --check _site/cash-register.js
node --check _site/optyker-vision.js
node --test tests/ovc-pricing.test.mjs
verify_desktop_aliases

# GitHub Pages has a repository subpath; Vercel uses the domain root.
python scripts/patch_public_asset_paths.py
verify_desktop_aliases

# Staff uses the customer iPhone design without altering its existing services.
# Embed into the actual deployment artifact, not a separate async source commit.
node --check iphone-app-v13/staff-reference-ui-v1.js
python scripts/apply_iphone_staff_reference.py
node scripts/test_iphone_staff_reference.cjs

# Password recovery requires verified email, not biographical information.
# Apply to the final artifact after all UI patches, and fail closed on regression.
node --check iphone-app-v13/secure-auth-v1.js
node --check iphone-app-v13/secure-sw-v1.js
python scripts/apply_secure_auth.py
node --test tests/secure-auth.test.cjs
python scripts/check_live_auth_security.py

# Authentication screens share the app design; preserve verified email recovery.
node --check iphone-app-v13/login-reference-ui-v1.js
python scripts/apply_iphone_login_reference.py
python tests/test_iphone_login_reference.py
node --test tests/secure-auth.test.cjs

# Verified customer workflow changes, applied after existing versioned patches.
node --check optyker-sept11.js
python scripts/apply_sept11_release.py
node --test tests/sept11-pricing.test.mjs
python scripts/patch_public_asset_paths.py
python scripts/finalize_sept11_manifest.py
verify_desktop_aliases

# Customer-scoped opening, safe sheet deletion and quote-to-laboratory orders.
node --check client-sheet-actions.js
python scripts/apply_client_sheet_actions.py
python scripts/patch_public_asset_paths.py
verify_desktop_aliases

# Signed delivery record, full reference fields and care instructions.
node --check eyewear-delivery.mjs
python scripts/apply_eyewear_delivery.py
python scripts/patch_public_asset_paths.py
verify_desktop_aliases

# Customer eyewear cover: actual interactive controls and server-enforced replacement caps.
node --check iphone-app-v13/eyewear-cover.js
node --check eyewear-cover-staff.js
python scripts/apply_eyewear_cover.py
python scripts/patch_public_asset_paths.py
verify_desktop_aliases
python3 scripts/apply_cover_channels.py
