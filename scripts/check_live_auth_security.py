"""Read-only configuration check and negative legacy-auth requests; no accounts reset."""
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError
U = 'https://whgziwaegjzqsgcntesr.supabase.co'
K = 'sb_publishable_DndhLvY32YeCmqWMNRi30g_dEDm8upv'
headers = {'apikey': K, 'Content-Type': 'application/json'}
with urlopen(Request(U + '/auth/v1/settings', headers=headers), timeout=20) as response:
    settings = json.load(response)
assert settings.get('mailer_autoconfirm') is False, 'Native signup MUST require email confirmation'
print('PASS native Auth requires email confirmation')
for action in ('reset', 'register'):
    request = Request(U + '/functions/v1/optyker-customer-auth', headers=headers,
                      data=json.dumps({'action': action}).encode(), method='POST')
    try:
        with urlopen(request, timeout=20) as response:
            raise AssertionError('Legacy password-write action unexpectedly accepted')
    except HTTPError as error:
        data = json.load(error)
        assert error.code == 403 and data.get('ok') is False
        assert data.get('code') == 'EMAIL_VERIFICATION_REQUIRED'
        assert not any(k in data for k in ('session', 'access_token', 'user_id', 'client_id'))
    print('PASS legacy ' + action + ' denied server-side')
