# 20 — Self-Host Readiness

Honest BYO infrastructure guide for UniLive Platform. Stage B validated contract swap via Fake provider; self-host production is **FOUNDATION_READY**, not fully automated.

## Component map

| Layer | Self-host option |
|---|---|
| Web app | Static/Vercel/any CDN — build `artifacts/instacollab` |
| API | Node on Render/Railway/self — `artifacts/api-server`, bind `0.0.0.0:$PORT` |
| Postgres | Supabase CLI local, managed Supabase, or plain Postgres |
| Media SFU | LiveKit OSS cluster |
| Object storage | Cloudflare R2, MinIO, S3 |
| Realtime | Supabase Realtime, custom WS, or memory (dev) |
| Git/CI | GitHub (default adapter) |

## Control plane persistence

Current `createControlPlaneStore()` is in-memory. Self-host production **requires** Postgres adapter — Stage C priority.

## Secret management

Environment variables + secret refs:

- LiveKit: `@workspace/livekit` config
- Supabase: service role via env (not exposed in `/v1/*`)
- R2: worker bindings or S3-compatible env

## RTC self-host

1. Deploy LiveKit OSS
2. Configure api-server LiveKit env
3. Use `/v1/rtc/tokens` for grant + JWT mint
4. Clients use `@unilives/rtc-livekit` with self-hosted URL

Alternate SFU: implement new adapter package + registry entry (no production cutover required for platform acceptance).

## Deploy boundary

`@unilives/deploy` records deployments; actual promotion uses existing Vercel integration today. Render/Railway adapters are Stage C foundation work.

## Render notes

- Bind `0.0.0.0:$PORT`
- Ephemeral disk — persist usage/audit to Postgres, not local files
- Linux paths case-sensitive

## Local stack (CLI `dev` / `start`)

Documented targets: `postgres, auth, realtime, storage, rtc-fake|livekit, api, mcp`

Full orchestration script **pending** — Stage C deliverable.

## Docker compose

Stage B documents orchestration intent; production-grade compose stack is **NOT SHIPPED**. Fake provider sufficient for CI.

## Stage C acceptance criteria (self-host slice)

- [ ] Postgres control plane adapter documented + tested
- [ ] LiveKit OSS env var matrix documented
- [ ] `unilive start` boots minimal local stack
- [ ] No claim of one-click production deploy until verified

## Evidence

`docs/rtc-platform/16-SELF-HOST-READINESS.md`, `docs/platform/SELF-HOST-ARCHITECTURE.md`
