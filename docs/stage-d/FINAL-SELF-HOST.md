# FINAL — Self-Host Production

## Package

`@unilives/selfhost` v0.1.0

## Delivered

- Docker compose reference stack
- `initSelfHost` / `getSelfHostStatus`
- `backupSelfHost` / `restoreSelfHost`
- `upgradePreflight`
- `generateComposeTemplate`
- LiveKit config template
- Placeholder-only secrets (`CHANGE_ME_*`)

## TLS

Terminate HTTPS with Caddy or another reverse proxy — not built into package.

## Container images

Compose references `ghcr.io/unilives/*` — reference placeholders; publish not verified in Stage D.

## Classification

**PRODUCTION_READY** distribution scaffolding for operators.
