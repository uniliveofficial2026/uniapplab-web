# 16 — Self-Host Readiness

UniLiveRTC is designed for self-hosted or BYO-SFU deployments without forking product logic.

## Self-host components

| Component | Self-host option |
|---|---|
| Media SFU | LiveKit OSS or alternate adapter |
| API | `artifacts/api-server` on Render/Vercel/self Node |
| Postgres | Supabase self-host or plain Postgres via `@unilives/database` |
| Object storage | Cloudflare R2 or S3-compatible via storage driver |
| Realtime | Supabase realtime, custom WS, or memory (dev) |

## Control plane

`createControlPlaneStore()` is in-memory foundation. Production self-host adds Postgres persistence adapter for orgs/projects/environments/provider connections — not yet shipped.

## Secrets model

- `secretRef` strings only in control plane audit/logs
- Never embed API keys in ProjectGraph or MCP responses
- Provider credentials resolved at deploy/runtime from env/secret store

## Token minting

Self-hosted LiveKit: configure `@workspace/livekit` env vars; `mintProviderTokenFromGrant` returns 503 `provider_not_configured` when unset (grant still returned for debugging).

## Local dev stack

CLI `dev` command documents foundation stack:

`postgres, auth, realtime, storage, rtc-fake|livekit, api, mcp`

Full `unilive start` orchestration is **FOUNDATION_READY**, not complete docker-compose.

## Deployment boundary

`@unilives/deploy` wraps control-plane deployment records; actual build/deploy delegates to existing Vercel/GitHub paths.

## Render constraints

Bind `0.0.0.0:$PORT`; ephemeral filesystem — no local metering persistence without DB.
