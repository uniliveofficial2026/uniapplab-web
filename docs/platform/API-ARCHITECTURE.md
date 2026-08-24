# API Architecture

Public HTTP API v1 lives in `artifacts/api-server/src/routes/uniliveV1.ts`.

## Design

- Provider-neutral response shapes
- No Supabase/LiveKit/Cloudflare ids as product truth in payloads
- Shared control plane + usage meter instances per process
- Bootstrap org/project for local dev

## Routes

| Method | Path | Description |
|---|---|---|
| GET | `/v1/health` | API version + production RTC labels |
| GET/POST | `/v1/projects` | List / create projects |
| GET | `/v1/projects/:projectId` | Project detail + graph skeleton |
| GET | `/v1/environments` | Environments for project |
| POST | `/v1/rtc/rooms` | Register room start + usage |
| POST | `/v1/rtc/tokens` | Mint grant + provider token |
| POST | `/v1/rtc/webhooks/normalize` | Normalize provider webhook |
| GET | `/v1/storage/buckets` | Storage boundary stub |
| GET/POST | `/v1/deployments` | Deployment records |
| GET | `/v1/logs` | Audit log tail |
| GET | `/v1/metrics` | RTC rollup + providers |
| GET | `/v1/providers` | Provider registry |

## Token response

Success:

```json
{
  "grant": { "grantId", "roomId", "role", "permissions", "expiresAt" },
  "provider": "livekit",
  "token": "..."
}
```

Provider not configured (503): grant returned without token for debugging.

## Legacy coexistence

Existing routes (`/livekit/*`, Firebase auth, Supabase direct) remain during migration. New integrations should use `/v1/*`.

## Auth (future)

Credential authorization via `controlPlane.authorize()` — middleware not yet enforced on all v1 routes; MCP already requires credentials.

## Deployment

Mounted on api-server Express app. Render: bind `0.0.0.0:$PORT`.
