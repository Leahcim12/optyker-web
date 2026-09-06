#!/usr/bin/env bash
set -e
bash scripts/vercel-build.sh
python scripts/patch_eyewear_runtime_v8.py

# Le viste gestionali devono usare lo stesso index appena aggiornato.
cp _site/index.html _site/gestionale-v2/index.html
cp _site/index.html _site/gestionale-v3/index.html

grep -q "OPTYKER_EYEWEAR_RUNTIME_V8" _site/index.html
grep -q "20260906-eyewear-flow8-fix1" _site/index.html
grep -q "Es. Michael Optyker" _site/index.html
grep -q "Tipo lente DX" _site/index.html
grep -q "Tipo lente SX" _site/index.html
grep -q "€ 20 a lente" _site/index.html
grep -q "€ 40 a lente" _site/index.html
grep -q "Garanzia" _site/index.html

echo "Optyker production build V8 OK"
