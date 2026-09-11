"""Build regression checks for the login-only visual layer (no network writes)."""
from pathlib import Path
import hashlib
import json
import re
import sys
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_site'
app = (SITE / 'iphone-app-v13/index.html').read_text(encoding='utf-8')
reset = (SITE / 'reset-password/index.html').read_text(encoding='utf-8')
version = json.loads((SITE / 'login-design-version.json').read_text())
scripts = lambda s: re.findall(r'<script\b[^>]*>[\s\S]*?</script>', s, re.I)
original = [s.replace('\n    const loginButton=e.currentTarget;', '').replace('loginButton.disabled', 'e.currentTarget.disabled') for s in scripts(app) if 'id="optykerLoginReferenceJs"' not in s]
assert hashlib.sha256('\n'.join(original).encode()).hexdigest() == version['base_app_scripts_sha256']
assert hashlib.sha256('\n'.join(scripts(reset)).encode()).hexdigest() == version['reset_scripts_sha256']
assert 'const loginButton=e.currentTarget;' in app
assert app.count('<script id="optykerLoginReferenceJs">') == 1
assert app.count('<style id="optykerLoginReferenceCss">') == 1
assert reset.count('<style id="optykerLoginReferenceCss">') == 1
assert app.rfind('<script id="optykerLoginReferenceJs">') > app.rfind('<script id="optykerStaffReferenceJs">')
for marker in ('OPTYKER_VERIFIED_EMAIL_RECOVERY_V1', 'recoveryRequestForm', 'optykerRecoveryHandoffV1', 'OPTYKER_IPHONE_STAFF_REFERENCE_V1', 'refNewsDrawer', 'refShopOfficialLogo'):
    assert marker in app, marker
for bypass in ("customerAuth('reset'", "customerAuth('register'", 'forgotPwd1', 'forgotPwd2'):
    assert bypass not in app, bypass
js = (ROOT / 'iphone-app-v13/login-reference-ui-v1.js').read_text()
for forbidden in ('fetch(', 'localStorage', 'sessionStorage', '.auth.', 'location.', 'state.', 'innerHTML = app'):
    assert forbidden not in js, forbidden
assert 'field.append(glyph, input)' in js
assert 'card.insertBefore(forgot, enter)' in js
assert 'reveal.type = \'button\'' in js
assert 'input.value' not in js
with tempfile.TemporaryDirectory() as tmp:
    for i, script in enumerate(scripts(app) + scripts(reset)):
        code = re.sub(r'^<script\b[^>]*>', '', script, flags=re.I).rsplit('</script>', 1)[0]
        path = Path(tmp) / f'{i}.js'
        path.write_text(code)
        subprocess.run(['node', '--check', str(path)], check=True)
print('PASS login design: auth requests intact, isolated recovery, role UI, input nodes and JavaScript syntax')
