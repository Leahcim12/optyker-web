# Shopify chat verification — 12 September 2026

Requested scope: repeat the pending automated check of Shopify chat loading after an eyewear warranty request.

Production version under test: `12ccd64456d09f9df0b2516f4ba47036b1be3093`.

The test reads the published Shopify page and immutable Optyker assets. All business API requests are intercepted and use synthetic identities and a disposable local PostgreSQL database. Chat is read-only; no customer messages are sent. No production orders, payments, claims or customer records are changed.

Chromium and WebKit checks cover the exact warranty message appearing after an intentionally delayed chat response, automatic refresh, stopping polling when leaving chat, reopening from Orders, and absence of duplicated chat containers.

Run `34683364448` stopped before browser tests because the existing build-time authentication settings check received HTTP 504. This commit retries the existing isolated verification workflow. No workflow, authentication guard or production file has been modified to bypass that failure.

This document is not a passing test result. The generated `channels-check/chat-checks.json` and final workflow status determine the result.
