#!/usr/bin/env bash
set -e
bash scripts/vercel-build-v12.sh
python scripts/patch_eyewear_summary_stability_v13.py
python scripts/patch_quote_dates_red.py

cp billing-compose.js _site/billing-compose.js
cp billing-compose.css _site/billing-compose.css

python - <<'CACHE'
from pathlib import Path
import re
p=Path('_site/index.html')
text=p.read_text()
text=re.sub(r'/billing-admin\.css(?:\?[^\"\']*)?', '/billing-admin.css?v=20260909-admin-history1', text)
p.write_text(re.sub(r'/billing-admin\.js(?:\?[^\"\']*)?', '/billing-admin.js?v=20260909-admin-history1', text))
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
