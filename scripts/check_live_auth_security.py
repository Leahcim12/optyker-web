"""Read-only configuration check and negative legacy-auth requests; no accounts reset."""
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
U = 'https://whgziwaegjzqsgcntesr.supabase.co'
K = 'sb_publishable_DndhLvY32YeCmqWMNRi30g_dEDm8upv'
headers = {'apikey': K, 'Content-Type': 'application/json'}

def open_check(request):
    """Retry transport failures only; an unavailable check still fails the build."""
    for attempt in range(3):
        try:
            return urlopen(request, timeout=20)
        except HTTPError as error:
            if error.code not in (502, 503, 504) or attempt == 2:
                raise
            error.close()
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        print('Authentication service temporarily unavailable; retrying check')
        time.sleep(2 ** (attempt + 1))


def main():
    with open_check(Request(U + '/auth/v1/settings', headers=headers)) as response:
        settings = json.load(response)
    assert settings.get('mailer_autoconfirm') is False, 'Native signup MUST require email confirmation'
    print('PASS native Auth requires email confirmation')
    for action in ('reset', 'register'):
        request = Request(U + '/functions/v1/optyker-customer-auth', headers=headers,
                          data=json.dumps({'action': action}).encode(), method='POST')
        try:
            with open_check(request):
                raise AssertionError('Legacy password-write action unexpectedly accepted')
        except HTTPError as error:
            data = json.load(error)
            assert error.code == 403 and data.get('ok') is False
            assert data.get('code') == 'EMAIL_VERIFICATION_REQUIRED'
            assert not any(k in data for k in ('session', 'access_token', 'user_id', 'client_id'))
        print('PASS legacy ' + action + ' denied server-side')


if __name__ == '__main__':
    main()
