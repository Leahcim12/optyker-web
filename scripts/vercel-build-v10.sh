#!/usr/bin/env bash
set -e
bash scripts/vercel-build-v9.sh
python scripts/patch_eyewear_runtime_v10.py

cp _site/index.html _site/gestionale-v2/index.html
cp _site/index.html _site/gestionale-v3/index.html

node --check eyewear-flow-v9.js
node --check eyewear-discounts-v10.js

grep -q "OPTYKER_EYEWEAR_DISCOUNTS_V10" _site/index.html
grep -q "20260906-eyewear-discounts-v10" _site/index.html
grep -q "STUDENTIBLU" _site/index.html
grep -q "OCCHIALI15" _site/index.html
grep -q "MONTATURA30" _site/index.html
grep -q "LENTI15" _site/index.html
grep -q "VICINO" _site/index.html
grep -q "VICINOHARD" _site/index.html
grep -q "VICINOHMC" _site/index.html
grep -q "optyker-eyewear-api-v5" _site/index.html

echo "Optyker production build V10 OK"
