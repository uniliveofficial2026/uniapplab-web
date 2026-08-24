# 11 — Provider State

Snapshot at Stage A start. **No production deploy** during Stage A.

| Provider | Tooling | Auth / readiness | CLI / PATH | Stage A use | Status |
|---|---|---|---|---|---|
| Vercel | MCP / CLI | ready | — | read / inspect only | READY (no deploy) |
| Supabase | plugin-supabase | ready | — | schema/read verify | READY |
| Cloudflare | Cloudflare MCP | **needsAuth** | wrangler **not in PATH** | blocked until auth + CLI | BLOCKED |
| LiveKit | Cloud + `lib/livekit` | — | **livekit CLI not found** | code-path verify; limited ops | LIMITED |
| Render (casino SO) | external (audit) | — | — | document only | UNKNOWN |
| Upstash | `lib/upstash` | — | — | presence/TTL patterns | UNKNOWN |
| R2 / media | via CF Worker | depends on CF auth | wrangler missing | limited | BLOCKED |

## Packages under hardening

| Package | Path |
|---|---|
| instacollab | `artifacts/instacollab` |
| api-server | `artifacts/api-server` |
| chat-ws | `artifacts/chat-ws` |
| admin-panel | `artifacts/admin-panel` |
| livekit lib | `lib/livekit` |
| db lib | `lib/db` |
| media worker | `workers/uniapplab-media` |

uiUxChanged: **false**
