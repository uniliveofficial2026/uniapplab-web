# 06 — API Matrix

Invariant: **uiUxChanged: false**

Packages: `artifacts/api-server`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`.

| Area | Endpoints / modules (fill) | Auth | Idempotent? | Status |
|---|---|---|---|---|
| Health / version | | | | UNKNOWN |
| LiveKit token / room ensure | | required | | UNKNOWN |
| Live lifecycle (start/end) | | required | | UNKNOWN |
| Seats | | required | | UNKNOWN |
| PK lifecycle | | required | | UNKNOWN |
| Gifts / settle | | required | critical | UNKNOWN |
| Wallet | | required | | UNKNOWN |
| Presence heartbeat | | required | replace | UNKNOWN |
| Media signed upload helpers | | required | | UNKNOWN |
| Admin / config | | admin ACL | | UNKNOWN |
| Webhooks (LiveKit etc.) | | signature | | UNKNOWN |
| DevAgent / chat agent | | | | IN_PROGRESS — typecheck FAIL (grounded fields) |

## Contracts

| Check | Status |
|---|---|
| OpenAPI ↔ Zod ↔ React client alignment | UNKNOWN |
| api-server typecheck | FAIL (known: DevAgentChatResult grounded fields) |
| No breaking public API change in Stage A without note | PENDING |

## Stage A policy

- Document and verify; **no production deploy**.
- Prefer fixing typecheck failures that block verification.
