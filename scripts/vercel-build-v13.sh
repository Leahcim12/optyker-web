#!/usr/bin/env bash
set -e
bash scripts/vercel-build-v12.sh
python scripts/patch_eyewear_summary_stability_v13.py

cp _site/index.html _site/gestionale-v2/index.html
cp _site/index.html _site/gestionale-v3/index.html

node --check eyewear-summary-stability-v13.js

grep -q "OPTYKER_EYEWEAR_SUMMARY_STABILITY_V13" _site/index.html
grep -q "20260907-eyewear-summary-v13" _site/index.html
grep -q "Lente DX" _site/index.html
grep -q "Lente SX" _site/index.html

echo "Optyker production build V13 OK"
