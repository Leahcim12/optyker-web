from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from apply_ts_connection import inject_assets
from check_desktop_html import PageScripts, validate


PAGE = '''<!doctype html><html><head><title>Optyker</title></head><body>
<main>Dashboard</main>
<script>
function printAttachment() {
  return '<html><head><title>Print</title></head><body>Attachment</body></html>';
}
function hearingPrintHtml() { return '<html><body>Prescription</body></html>'; }
function dashboardRenderClients() { return 'Clients'; }
</script>
<script src="/billing-admin.js?v=old" id="optykerBillingAdminScript"></script>
</body></html>'''


class TsLoaderTests(unittest.TestCase):
    def test_print_templates_and_inline_scripts_stay_byte_identical(self):
        before = PageScripts(PAGE)
        output = inject_assets(PAGE)
        after = PageScripts(output)
        self.assertEqual([s['code'] for s in before.scripts if 'src' not in s['attrs']],
                         [s['code'] for s in after.scripts if 'src' not in s['attrs']])
        self.assertEqual(validate(output), 1)
        self.assertGreater(output.index('id="optykerTsConnectionJs"'), output.index('id="optykerBillingAdminScript"'))

    def test_repeated_build_patch_does_not_duplicate_loader(self):
        output = inject_assets(PAGE)
        self.assertEqual(inject_assets(output), output)

    def test_final_guard_rejects_the_exact_reported_regression(self):
        broken = PAGE.replace('</body>', '<script src="/ts-connection.js?v=broken" id="optykerTsConnectionJs"></script>\n</body>', 1)
        with self.assertRaisesRegex(ValueError, 'rendered as page text|Invalid final inline'):
            validate(broken)

    def test_guard_rejects_other_inline_syntax_errors(self):
        broken = inject_assets(PAGE.replace("return 'Clients';", "return 'Clients;"))
        with self.assertRaisesRegex(ValueError, 'Invalid final inline'):
            validate(broken)

    def test_github_pages_base_matches_the_actual_deployment_path(self):
        output = inject_assets(PAGE).replace('src="/ts-connection.js?', 'src="/optyker-web/ts-connection.js?')
        self.assertEqual(validate(output, '/optyker-web/'), 1)
        with self.assertRaisesRegex(ValueError, 'TS loader missing'):
            validate(output)
        with self.assertRaisesRegex(ValueError, 'TS loader missing'):
            validate(output.replace('/optyker-web/ts-connection.js?', '//external.test/ts-connection.js?'), '/optyker-web/')


if __name__ == '__main__':
    unittest.main()
