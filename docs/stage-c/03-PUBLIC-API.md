# 03 — Public API (v1)

Stage C stabilizes the HTTP API introduced in Stage B. Router: `artifacts/api-server/src/routes/uniliveV1.ts`.

## Base path

All routes mount under `/v1/*` (Express app may prefix `/api` → `/api/v1/*` in deployment).

## Design principles

- Provider-neutral response shapes — no Supabase/LiveKit/Cloudflare ids as product truth
- Shared control plane + usage meter instances per process
- Bootstrap org/project for local dev (`unilives-reference` / `uniapplab-web`)
- Legacy routes (`/livekit/*`, Firebase, Supabase direct) coexist during migration

## Routes

| Method | Path | Description | Stage C status |
|---|---|---|---|
| GET | `/v1/health` | API version + `productionRtcApi` + `productionMediaProvider` | **IMPLEMENTED** |
| GET | `/v1/projects` | List projects | **IMPLEMENTED** |
| POST | `/v1/projects` | Create project (+ auto environments) | **IMPLEMENTED** |
| GET | `/v1/projects/:projectId` | Project detail + graph skeleton | **IMPLEMENTED** |
| GET | `/v1/environments` | Environments for project | **IMPLEMENTED** |
| POST | `/v1/rtc/rooms` | Register room start + usage | **IMPLEMENTED** |
| POST | `/v1/rtc/tokens` | Mint grant + provider token | **IMPLEMENTED** |
| POST | `/v1/rtc/webhooks/normalize` | Normalize provider webhook | **IMPLEMENTED** |
| GET | `/v1/storage/buckets` | Storage boundary stub | **FOUNDATION** |
| GET/POST | `/v1/deployments` | Deployment records | **FOUNDATION** |
| GET | `/v1/logs` | Audit log tail | **IMPLEMENTED** |
| GET | `/v1/metrics` | RTC rollup + providers | **IMPLEMENTED** |
| GET | `/v1/providers` | Provider registry (no secrets) | **IMPLEMENTED** |

## Health response

```json
{
  "productionRtcApi": "UniLiveRTC",
  "productionMediaProvider": "LiveKit"
}
```

## Token mint response

Success:

```json
{
  "grant": { "grantId", "roomId", "role", "permissions", "expiresAt" },
  "provider": "livekit",
  "token": "..."
}
```

Provider not configured (503): grant returned without token for debugging.

## Auth (Stage C target)

Stage B: credential authorization via `controlPlane.authorize()` exists; middleware **not yet enforced** on all v1 routes. MCP already requires credentials.

Stage C deliverable: enforce scoped credentials on all mutating routes.

## Deployment

- Render: bind `0.0.0.0:$PORT`
- Ephemeral filesystem — audit/usage must persist to Postgres (Stage C)

## Evidence

- `scripts/test-stage-b.mjs` — control plane + API integration paths
- `GET /v1/health` gate in `FINAL-STAGE-B-STATUS.json`
