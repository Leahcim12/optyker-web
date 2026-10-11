#!/usr/bin/env bash
# Runs one CI command. On failure its key lines become a GitHub annotation, readable
# from the API even where the raw job log cannot be downloaded. No secrets are printed.
set -o pipefail
label="$1"; shift
out=$(mktemp)
"$@" 2>&1 | tee "$out"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  python3 - "$label" "$out" <<'PY'
import re, sys
label, path = sys.argv[1], sys.argv[2]
lines = open(path, encoding='utf-8', errors='replace').read().splitlines()
pattern = r'not ok|✖|Error|assert|expected|actual|Cannot|failed|FAIL|SystemExit|Traceback|missing|refused'
keep = [l for l in lines if re.search(pattern, l)]
body = keep[:50] + ['--- ultime righe ---'] + lines[-35:]
msg = '%0A'.join(l.replace('%', '%25').replace('\r', '')[:280] for l in body)
print('::error title=' + re.sub(r'[,:]', ' ', label) + '::' + msg)
PY
fi
exit "$rc"
