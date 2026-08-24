# Security Hardening

## Stage D security matrix

`scripts/stage-d-security-matrix.mjs` validates:

1. **Tenant isolation** — cross-org usage/deploy denial
2. **Observe redaction** — sensitive fields and JWT patterns
3. **AI Builder** — unsafe requirement rejection
4. **Marketplace** — privileged permission install blocking

## Secret scan

`scripts/stage-d-secret-scan.mjs` walks Stage D docs, packages, examples, scripts, release tree for live-secret-like patterns (Stripe, AWS, GitHub, Slack tokens).

## Pack validation

`scripts/stage-d-pack-validate.mjs` ensures tarball dry-run excludes `.env`, `.pem`, private keys, credentials.

## AI mutation path

Blocked patterns: shell, rm -rf, eval/exec, path traversal, deploy:mutate, secret.read.

## Inherited Stage C security

Stage B/C gates remain in CI: auth boundaries, RTC policy, wallet authority, visual lock.

## Status

`security`: **PASS** (Stage D matrix + inherited regression gates).
