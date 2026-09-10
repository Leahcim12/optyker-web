"""Replace legacy password writes in the actual deployment artifact.
The deployed optyker-customer-auth legacy service is independently fail-closed.
No customer data or application business handlers are changed here.
"""
from pathlib import Path
import json
import re
import sys

VERSION = '20260911-secure-auth-v1'
ROOT = Path(__file__).resolve().parents[1]
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_site'
APP = SITE / 'iphone-app-v13/index.html'
source = APP.read_text(encoding='utf-8')
module = (ROOT / 'iphone-app-v13/secure-auth-v1.js').read_text(encoding='utf-8').rstrip()
if 'OPTYKER_VERIFIED_EMAIL_RECOVERY_V1' not in source:
    for name in ('forgotScreen', 'registerScreen', 'newPasswordScreen'):
        pattern = rf'^function {name}\([^\n]*\)\{{\n.*?^\}}\n'
        source, count = re.subn(pattern, '', source, flags=re.M | re.S)
        if count != 1:
            raise SystemExit(f'Expected exactly one {name}; found {count}')
    anchor = 'function authSuccess('
    if source.count(anchor) != 1:
        raise SystemExit('Missing or ambiguous authentication success view')
    source = source.replace(anchor, module + '\n\n' + anchor, 1)
    handoff = '''<script id="optykerRecoveryHandoffV1">
(function(){
  const h=new URLSearchParams(location.hash.slice(1));
  const q=new URLSearchParams(location.search);
  const type=h.get('type')||q.get('type');
  if(type==='recovery'||type==='signup'||q.has('token_hash')||q.has('code')||h.has('error_code')){
    window.__optykerRecoveryRedirect=true;
    location.replace('https://leahcim12.github.io/optyker-web/reset-password/'+location.search+location.hash);
  }
})();
</script>
'''
    source = source.replace('<script id="optykerLocalAuth">', handoff + '<script id="optykerLocalAuth">', 1)
    if 'optykerRecoveryHandoffV1' not in source:
        raise SystemExit('Could not install recovery handoff before local session parser')
    source = source.replace('async function boot(){', 'async function boot(){\n  if(window.__optykerRecoveryRedirect)return;', 1)
    if '<meta name="referrer"' not in source:
        source = source.replace('</head>', '<meta name="referrer" content="no-referrer">\n</head>', 1)
source = re.sub(r"register\('\./sw\.js(?:\?[^']*)?'", "register('./sw.js?v=" + VERSION + "'", source)
for forbidden in ("customerAuth('reset'", "customerAuth('register'", 'forgotPwd1', 'forgotPwd2', 'forgotName', 'forgotSurname', 'forgotPhone', 'nessun link email', 'Non verrà inviato alcun link'):
    if forbidden in source:
        raise SystemExit('Legacy password bypass still present: ' + forbidden)
for marker in ('OPTYKER_VERIFIED_EMAIL_RECOVERY_V1', 'recoveryRequestForm', 'optykerRecoveryHandoffV1', 'OPTYKER_IPHONE_STAFF_REFERENCE_V1', 'refNewsDrawer'):
    if marker not in source:
        raise SystemExit('Security update or previous UI is incomplete: ' + marker)
APP.write_text(source, encoding='utf-8')
reset = SITE / 'reset-password/index.html'
reset.parent.mkdir(parents=True, exist_ok=True)
reset.write_text((ROOT / 'reset-password/index.html').read_text(encoding='utf-8'), encoding='utf-8')
(SITE / 'iphone-app-v13/sw.js').write_text((ROOT / 'iphone-app-v13/secure-sw-v1.js').read_text(encoding='utf-8'), encoding='utf-8')
(SITE / 'auth-security-version.json').write_text(json.dumps({
    'version': VERSION, 'recovery': 'verified-email-link',
    'legacy_direct_reset': 'disabled-server-side', 'auto_login_after_reset': False,
    'registration': 'native-email-confirmation',
}, indent=2) + '\n', encoding='utf-8')
print('Optyker: email-only recovery, isolated reset and verified registration embedded in deployment')
