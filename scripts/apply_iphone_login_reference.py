"""Apply the app's reference design to authentication, after secure-auth patches.
Authentication requests and recovery rules are preserved. Apart from capturing
the login button before an await, existing scripts remain byte-identical.
"""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_site'
VERSION = '20260911-login-reference-v1'
STYLE_ID = 'optykerLoginReferenceCss'
SCRIPT_ID = 'optykerLoginReferenceJs'
css = (ROOT / 'iphone-app-v13/login-reference-ui-v1.css').read_text(encoding='utf-8').strip()
js = (ROOT / 'iphone-app-v13/login-reference-ui-v1.js').read_text(encoding='utf-8').strip()

def scripts(html):
    return re.findall(r'<script\b[^>]*>[\s\S]*?</script>', html, re.I)

def strip_theme(html):
    for tag, key in [('style', STYLE_ID), ('script', SCRIPT_ID)]:
        html = re.sub(r'\n?<' + tag + r' id="' + key + r'">[\s\S]*?</' + tag + r'>\n?', '\n', html)
    return html

app_file = SITE / 'iphone-app-v13/index.html'
app = strip_theme(app_file.read_text(encoding='utf-8'))
for marker in ('OPTYKER_VERIFIED_EMAIL_RECOVERY_V1', 'optykerRecoveryHandoffV1', 'OPTYKER_IPHONE_STAFF_REFERENCE_V1', 'OPTYKER_HERO_PLANT_CONNECTED_V1'):
    if marker not in app:
        raise SystemExit('Apply login design only after security/shared UI: ' + marker)
before = scripts(app)
# UI-only bug: currentTarget is cleared after dispatch, before async login ends.
# Capture the clicked element so a rejected password can re-enable the button.
login_match = re.search(r'^function login\([^\n]*\)\{\n.*?^\}', app, re.M | re.S)
assert login_match, 'Login renderer missing'
login_code = login_match.group()
if 'const loginButton=e.currentTarget;' not in login_code:
    fixed = login_code.replace('onclick=async(e)=>{', 'onclick=async(e)=>{\n    const loginButton=e.currentTarget;', 1)
    fixed = fixed.replace('e.currentTarget.disabled', 'loginButton.disabled')
    assert fixed != login_code, 'Login button lifecycle hook missing'
    app = app[:login_match.start()] + fixed + app[login_match.end():]

def normalize_login_script(script):
    return script.replace('\n    const loginButton=e.currentTarget;', '').replace('loginButton.disabled', 'e.currentTarget.disabled')

normalized_before = [normalize_login_script(s) for s in before]
app = app.replace('</head>', '<style id="' + STYLE_ID + '">\n' + css + '\n</style>\n</head>', 1)
app = app.replace('</body>', '<script id="' + SCRIPT_ID + '">\n' + js + '\n</script>\n</body>', 1)
assert [normalize_login_script(s) for s in scripts(app)[:-1]] == normalized_before, 'Only the documented button reference may change'
assert SCRIPT_ID in app and STYLE_ID in app
app_file.write_text(app, encoding='utf-8')

reset_file = SITE / 'reset-password/index.html'
reset = strip_theme(reset_file.read_text(encoding='utf-8'))
assert 'OPTYKER_ISOLATED_PASSWORD_RECOVERY_V1' in reset
reset_scripts = scripts(reset)
reset = reset.replace('<body>', '<body class="ovcAuthResetPage">', 1)
reset = reset.replace('<main class="card">', '<main class="card ovcAuthResetShell">', 1)
reset = reset.replace('<div class="brand">', '<div class="brand ovcAuthBrand">', 1)
reset = reset.replace('</head>', '<style id="' + STYLE_ID + '">\n' + css + '\n</style>\n</head>', 1)
assert scripts(reset) == reset_scripts, 'Recovery validation scripts must remain identical'
assert 'class="ovcAuthResetPage"' in reset
reset_file.write_text(reset, encoding='utf-8')

(SITE / 'login-design-version.json').write_text(json.dumps({
    'version': VERSION,
    'scope': ['login', 'recovery-request', 'registration', 'auth-messages', 'isolated-reset'],
    'design': 'shared-customer-staff-reference',
    'authentication_rules_unchanged': True, 'login_button_lifetime_fixed': True,
    'base_app_scripts_sha256': hashlib.sha256('\n'.join(normalized_before).encode()).hexdigest(),
    'reset_scripts_sha256': hashlib.sha256('\n'.join(reset_scripts).encode()).hexdigest(),
}, indent=2) + '\n', encoding='utf-8')
print('OVC login design installed; auth rules preserved; async button reference captured')
