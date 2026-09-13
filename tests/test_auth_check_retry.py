import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location(
    'auth_check', Path(__file__).resolve().parents[1] / 'scripts/check_live_auth_security.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def response(text):
    return io.BytesIO(text.encode())


def error(status, text='{}'):
    return HTTPError('https://example.test', status, 'test', {}, response(text))


class AuthCheckRetry(unittest.TestCase):
    def test_gateway_timeout_retries_then_verifies_all_guards(self):
        denied = '{"ok":false,"code":"EMAIL_VERIFICATION_REQUIRED"}'
        answers = [error(504), response('{"mailer_autoconfirm":false}'),
                   error(403, denied), error(403, denied)]
        with patch.object(check, 'urlopen', side_effect=answers) as opened, \
                patch.object(check.time, 'sleep') as delay:
            check.main()
        self.assertEqual(opened.call_count, 4)
        delay.assert_called_once_with(2)

    def test_unavailable_service_fails_after_three_attempts(self):
        with patch.object(check, 'urlopen', side_effect=[error(504) for _ in range(3)]) as opened, \
                patch.object(check.time, 'sleep'):
            with self.assertRaises(HTTPError):
                check.main()
        self.assertEqual(opened.call_count, 3)

    def test_enabled_autoconfirm_is_never_retried_or_accepted(self):
        with patch.object(check, 'urlopen', return_value=response('{"mailer_autoconfirm":true}')) as opened:
            with self.assertRaises(AssertionError):
                check.main()
        self.assertEqual(opened.call_count, 1)

    def test_successful_legacy_write_is_never_retried_or_accepted(self):
        with patch.object(check, 'urlopen', side_effect=[response('{"mailer_autoconfirm":false}'), response('{}')]) as opened:
            with self.assertRaises(AssertionError):
                check.main()
        self.assertEqual(opened.call_count, 2)


if __name__ == '__main__':
    unittest.main()
