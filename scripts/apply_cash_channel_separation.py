from pathlib import Path

MARKER = "OPTYKER_CASH_CHANNEL_SEPARATION_20260914"
LOCAL_API = "https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-local-api"

paths = [
    Path('_site/cash-register.js'),
]

for path in paths:
    text = path.read_text(encoding='utf-8')
    if MARKER in text:
        continue

    old_api = "var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';"
    new_api = old_api + "\nvar LOCAL_API='" + LOCAL_API + "'; // " + MARKER
    if text.count(old_api) != 1:
        raise SystemExit(f'Cash API declaration not found exactly once in {path}')
    text = text.replace(old_api, new_api, 1)

    old_fetch = "return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})"
    new_fetch = "return fetch(action==='checkout'?LOCAL_API:API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})"
    if text.count(old_fetch) != 1:
        raise SystemExit(f'Cash API fetch call not found exactly once in {path}')
    text = text.replace(old_fetch, new_fetch, 1)

    text = text.replace("window.OPTYKER_CASH_BUILD='20260913-cash4';", "window.OPTYKER_CASH_BUILD='20260914-channel1';", 1)
    path.write_text(text, encoding='utf-8')

print('Optyker cash channel separation installed: POS/RCH local, Shopify reserved for site/app')
