# Sistema TS — protected setup

Release `20260913-ts1` adds **Amministrazione → Sistema TS** on the desktop site and its two management aliases.

Implemented:

- Existing signed billing-administrator session authorizes `optyker-ts-api`. Expired, malformed, forged and ordinary-operator sessions are rejected. Browser requests use HTTPS, an explicit origin allowlist and `Cache-Control: no-store`.
- Username, owner/office code, owner fiscal code and business VAT are stored separately from credentials. Password and PIN are encrypted with Supabase Vault; the UI and status RPC receive presence booleans only. Blank fields retain existing credentials. Changing the username requires both new credentials. Revision locking prevents concurrent stale saves.
- The user enters the current TS password in a password field. The password/PIN fields are cleared after both successful and failed saves and on close. No TS secrets are written to browser storage or source files. There is no endpoint to read them back.
- Private upload accepts technical ZIP, PDF, WSDL/XSD/XML and certificate files, up to 10 MB each. SHA-256 deduplicates uploads; failed metadata writes remove the new object. No archives are extracted or files executed. Uploading documentation does not mark it reviewed or activate transmission.
- Configuration and technical-file tables deny public access. Vault has no `anon`/`authenticated` access. A restrictive Storage policy protects the private kit even if broad Storage policies are later added. The RLS advisor's “no policies” information for the two service-only tables is intentional default denial.

Deployment:

- Apply `20260912234850_ts_secure_connection.sql` (the timestamp matches the remote applied migration).
- Deploy `supabase/functions/optyker-ts-api/{index.ts,security.mjs}` with gateway JWT verification disabled **only because the function itself validates the existing billing HMAC administrator bearer**. Standard Supabase URL/service-role environment variables stay server-side.
- Run `bash scripts/vercel-build-v13.sh`. The final TS patch installs the module and updates the billing-admin cache key; the cash register, fiscal API and RCH connector release remain unchanged.

## Explicit remaining integration work

**No TS transmission or authentication test is implemented by this release.** `credentials_verified` and `transport_ready` remain false. A saved password is not evidence of accepted credentials. There is no send action, scheduler, fabricated protocol or accepted receipt.

During implementation, the official TS portal blocked automated downloads with HTTP 403. The operator can obtain the kit from the official **Spese sanitarie → Documenti e specifiche tecniche → Strumenti per lo sviluppo** area and upload it using the new form:
<https://sistemats1.sanita.finanze.it/portale/spese-sanitarie>

Before enabling transport, obtain and verify the current expense-transmission WSDL/XSD, authentication/encryption instructions, certificate validity and test/production endpoints applicable to the optician's account. Implement receipt polling and rejection handling against those specifications and test in the provided test environment. Historical 2020 specifications alone were not treated as a verified current kit.

The existing `optyker_ts_outbox` is untouched. Any future sender must claim rows atomically, respect fiscal-void holds, reject duplicates, retain real TS protocols/outcomes and coordinate cancellation/variation with accepted TS documents. Technical-kit uploads must never activate that sender automatically.

## Verification

`OPTYKER_TEST_PACKAGE=/tmp/optyker-ts-test/package.json node --test tests/ts-security.test.mjs tests/ts-connection-ui.test.mjs`

The temporary test package supplies jsdom 26.1.0. `tests/ts-connection-db.test.sql` tests permissions, Vault round-trip, blank-field retention, revision conflicts and account isolation inside a rollback. It neither modifies pre-existing live secrets nor transmits data. The Edge function passes Deno check; live negative requests verify the authentication/origin boundaries. The assembled build and existing receipt/void UI tests cover the unchanged cash workflow.

An authenticated TS login and live expense submission still require the user's current TS password and verified technical kit. No live customer expense was transmitted during these tests.
