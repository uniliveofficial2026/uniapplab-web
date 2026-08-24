# Self-Host Architecture

UniLive Platform supports BYO infrastructure without vendor lock-in at the orchestration layer.

## Component map

| Layer | Self-host option |
|---|---|
| Web app | Static/Vercel/any CDN — build `artifacts/instacollab` |
| API | Node on Render/Railway/self — `artifacts/api-server` |
| Postgres | Supabase CLI local, managed Supabase, or plain Postgres |
| Media SFU | LiveKit OSS cluster |
| Object storage | Cloudflare R2, MinIO, S3 |
| Realtime | Supabase Realtime, custom WS, or memory (dev) |
| Git/CI | GitHub (default adapter) |

## Control plane persistence

Current `createControlPlaneStore()` is in-memory. Self-host production requires Postgres adapter (roadmap).

## Secret management

Environment variables + secret refs:

- LiveKit: `@workspace/livekit` config
- Supabase: service role via env (not exposed in `/v1/*`)
- R2: worker bindings (`workers/uniapplab-media`)

## RTC self-host

1. Deploy LiveKit OSS
2. Configure api-server LiveKit env
3. Use `/v1/rtc/tokens` for grant + JWT mint
4. Clients use `@unilives/rtc-livekit` with self-hosted URL

Alternate SFU: implement new adapter package + registry entry.

## Deploy boundary

`@unilives/deploy` records deployments; actual promotion uses existing Vercel integration.

## Render notes

- Bind `0.0.0.0:$PORT`
- Ephemeral disk — persist usage/audit to Postgres, not local files
- Linux paths case-sensitive

## Local stack (CLI `dev`)

Documented targets: `postgres, auth, realtime, storage, rtc-fake|livekit, api, mcp`

Full orchestration script pending.

## Open source boundaries

See `OPEN-SOURCE-BOUNDARIES.md` for what ships in public packages vs reference app proprietary assets.
