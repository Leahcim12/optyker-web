from pathlib import Path

p = Path('_site/index.html')
s = p.read_text(encoding='utf-8')
MARK = 'OPTYKER_WHATSAPP_QR_META_FIX_V2'

if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_WHATSAPP_QR_CONNECT_V1' not in s:
    raise SystemExit('Patch QR WhatsApp non presente')

def once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: atteso 1 match, trovati {n}')
    s = s.replace(old, new, 1)

once("version:'v23.0'", "version:'v25.0'", 'Versione Facebook JS SDK')
once(
    "extras:{version:'v4',featureType:'whatsapp_business_app_onboarding'}",
    "extras:{setup:{},version:'v4',featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}",
    'Payload Embedded Signup Coexistence'
)

i = s.rfind('</body>')
if i < 0:
    raise SystemExit('Chiusura body finale non trovata')
s = s[:i] + f'<!-- {MARK} -->\n' + s[i:]

p.write_text(s, encoding='utf-8')
print('Fix Meta Embedded Signup applicato:', len(s))
