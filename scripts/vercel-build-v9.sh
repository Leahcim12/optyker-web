#!/usr/bin/env bash
set -e
bash scripts/vercel-build-v8.sh
python scripts/patch_eyewear_runtime_v9.py

cp _site/index.html _site/gestionale-v2/index.html
cp _site/index.html _site/gestionale-v3/index.html

node --check eyewear-flow-v9.js

grep -q "OPTYKER_EYEWEAR_RUNTIME_V9" _site/index.html
grep -q "20260906-eyewear-flow9" _site/index.html
grep -q "SCELTA DELLA LENTE DX" _site/index.html
grep -q "SCELTA DELLA LENTE SX" _site/index.html
grep -q "Tipo montatura" _site/index.html
grep -q "Del cliente" _site/index.html
grep -q "€ 10 a lente" _site/index.html
grep -q "€ 15 a lente" _site/index.html
grep -q "€ 25 a lente" _site/index.html
grep -q "€ 20 a lente" _site/index.html
grep -q "Montaggio tradizionale" _site/index.html
grep -q "Montaggio speciale" _site/index.html

echo "Optyker production build V9 OK"
