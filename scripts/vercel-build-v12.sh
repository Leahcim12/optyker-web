#!/usr/bin/env bash
set -e
bash scripts/vercel-build-v11.sh
python scripts/patch_eyewear_runtime_v12.py

cp _site/index.html _site/gestionale-v2/index.html
cp _site/index.html _site/gestionale-v3/index.html

node --check eyewear-flow-v12.js

grep -q "OPTYKER_EYEWEAR_FLOW_V12" _site/index.html
grep -q "20260907-eyewear-flow-v12-stable1" _site/index.html
grep -q "Sportive" _site/index.html
grep -q "€ 25 a lente" _site/index.html
grep -q "solo monofocali" _site/index.html
grep -q "optyker-eyewear-api-v6" _site/index.html

echo "Optyker production build V12 stable OK"
