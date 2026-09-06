#!/usr/bin/env bash
set -e
bash scripts/vercel-build-v10.sh
python scripts/patch_eyewear_runtime_v11.py

cp _site/index.html _site/gestionale-v2/index.html
cp _site/index.html _site/gestionale-v3/index.html

node --check eyewear-ui-fix-v11.js

grep -q "OPTYKER_EYEWEAR_RUNTIME_V11" _site/index.html
grep -q "20260906-eyewear-ui-fix-v11" _site/index.html
grep -q "Indice lente" _site/index.html
grep -q "separatamente dal Tipo lente" _site/index.html
grep -q "Base · inclusa" _site/index.html

echo "Optyker production build V11 OK"
