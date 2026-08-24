# Observability

## Package

`@unilives/observe` — extended in Stage D for redaction hardening.

## Redaction

- `redactFields(obj)` — replaces known secret field names with `[redacted]`
- `redactString(str)` — scrubs bearer tokens and JWT-like patterns

Covered patterns include: `authorization`, `bearer`, `cookie`, `password`, `api_secret`, `private_key`, APNS/FCM, LiveKit/Supabase/Cloudflare/Vercel/GitHub tokens.

## Cloud audit log

`@unilives/cloud` maintains append-only audit events with `platformVersion` from `@unilives/release`.

## Self-host

Reference compose includes an `observability` service slot. Full metrics/traces stack deployment is template-level — not qualified at hyperscale in Stage D.

## Tests

- `lib/unilives-observe/test/observe.test.mjs`
- `scripts/stage-d-security-matrix.mjs` redaction assertions
