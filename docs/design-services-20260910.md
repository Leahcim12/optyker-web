# Vision Services — Chat, Cassa e Documenti

Release: `20260910-services1`.

Additive management-only design. The mobile customer app and Shopify bundles are not modified. The existing Workspace (Agenda/Anagrafica) and Vision dashboard remain in place.

## Scope

- Main and client chat: clearer conversation list, sender bubbles, channel selector, composer, accessible photo enlargement. No new upload or messaging backend.
- Cash: existing catalog/payment columns retained. Original fiscal warning, confirmation button and secondary actions are moved, not cloned, to a dedicated footer. Original positions are restored before printing. Independent scrolling on desktop; natural flow on mobile and very short screens.
- DDT and customer invoice lists: search, date filters, larger tables, status colors. DDT editor and client consent archive use the same design. Dialog stacking corrected relative to the existing high-z-index sidebar.

## Safety boundaries

No changes to cash-register.js, original business scripts, credentials, API requests, document status values, financial calculations or print templates. No real messages, payments, receipts or DDT were created during design testing.

The build fails closed if required desktop markers are absent or original scripts/form controls change during patching. `services-version.json` records release and asset hashes. A read-only CI workflow checks the published HTML, commit and both asset hashes on the custom domain and GitHub Pages.

## Verification

Local browser tests use synthetic data and mocked fetch responses. Tested at 1440x960, 1366x768, 1024x768 and 390x844: chat search/composer, document lists/filters, DDT row addition/removal and accessible save controls, cart quantity/total, deposit validation, payment selection, catalog reload, unique confirmation button, preserved fiscal notice, close and print restoration. This is UI regression testing, not certification of fiscal transmission or a live financial transaction test.

## Rollback

Revert this design commit (or remove the Services block from the build script). Existing application logic and stored records do not depend on this layer.
