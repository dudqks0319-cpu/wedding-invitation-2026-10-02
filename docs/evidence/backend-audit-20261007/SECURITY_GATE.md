# Consolidated security gate · 2026-10-07

Owner: Codex / current backend scope.

- Authentication/ownership: anonymous and other-owner reads/writes denied; session expiry/logout, one-use PKCE/state tests.
- Input/output: existing 2MiB upload and 64KiB JSON boundaries preserved; JSON total deadline, abort cancellation, real decoder and metadata-free WebP pipeline tested. Upload 60-second deadline is source-reviewed, not a timed 60-second live probe.
- Replay/privacy: reserved slug regression and account-deletion scope regression; draft/public snapshot separation, hidden accounts, photo revocation and hashed operation input. No credentials or private sources sent to Claude.
- Abuse/cost: persistent atomic usage/bytes reservation, active-upload concurrency, retry without second transform, fail-closed quotas and switches tested. Existing provider/account limits unchanged.
- Dependencies: no additions or version changes. npm audit production: 0 critical, 1 existing high source-map-js GHSA-68fv-2mgg-jv7q (untrusted indexed source map parser). Changed Worker module has no source-map-js parser; this API accepts strict JSON/images, not source maps. This is not a clean fleet dependency audit; upstream/toolchain remediation remains recorded.
- Operational limits: provider total account hard cap and WAF/DDoS enforcement not verified. Existing fleet USER_BUDGET_PENDING / PLATFORM_CONTROL_UNAVAILABLE retained; no paid feature or quota expansion.
- Data cleanup: failed object reservation retained; later objects proceed and cleanup retried. Legacy account deletion still relies on foreign-key protection until all v2 rows clear; no claim of end-to-end account-erasure under R2 outage.

Official billing reference: https://developers.cloudflare.com/images/optimization/binding/ — info() calls free; unique transform reservations stay before output().

Local receipt counts: {"cloudflare-local.json": 49, "independent-auth-local.json": 16, "native-auth-local.json": 13, "independent-gateway-local.json": 12}

Release harness: ATTENTION due to existing iPhone/TestFlight P0, no harness failures. This backend fix does not close the app/device release gate.

Operational follow-up: unsigned new-service origin request was found returning200; signed-gateway requirement added to worker template, 2 new local negative-path regressions passed and Production returns403. Public read-only8 PASS. Production fixture writes remain HOLD after auto-review rejection. Secret-pattern scan of changed sources passed.
