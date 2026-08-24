# 02 — Package Map (Stage C inventory)

All packages live under `lib/unilives-*`. Names read from each `package.json` `name` field.

## Package inventory (20 packages)

| Directory | npm name | Version |
|---|---|---|
| `lib/unilives-platform-core` | `@unilives/platform-core` | 0.1.0 |
| `lib/unilives-sdk` | `@unilives/sdk` | 0.1.0 |
| `lib/unilives-rtc-contracts` | `@unilives/rtc-contracts` | 0.1.0 |
| `lib/unilives-rtc-core` | `@unilives/rtc-core` | 0.1.0 |
| `lib/unilives-rtc-client` | `@unilives/rtc-client` | 0.1.0 |
| `lib/unilives-rtc-server` | `@unilives/rtc-server` | 0.1.0 |
| `lib/unilives-rtc-livekit` | `@unilives/rtc-livekit` | 0.1.0 |
| `lib/unilives-rtc-fake` | `@unilives/rtc-fake` | 0.1.0 |
| `lib/unilives-rtc-qoe` | `@unilives/rtc-qoe` | 0.1.0 |
| `lib/unilives-mcp` | `@unilives/mcp` | 0.1.0 |
| `lib/unilives-cli` | `@unilives/cli` | 0.1.0 |
| `lib/unilives-auth` | `@unilives/auth` | 0.1.0 |
| `lib/unilives-database` | `@unilives/database` | 0.1.0 |
| `lib/unilives-storage` | `@unilives/storage` | 0.1.0 |
| `lib/unilives-realtime` | `@unilives/realtime` | 0.1.0 |
| `lib/unilives-deploy` | `@unilives/deploy` | 0.1.0 |
| `lib/unilives-git` | `@unilives/git` | 0.1.0 |
| `lib/unilives-observe` | `@unilives/observe` | 0.1.0 |
| `lib/unilives-ui` | `@unilives/ui` | 0.1.0 |
| `lib/unilives-asset-studio` | `@workspace/unilives-asset-studio` | 0.0.0 |

**Note:** `unilives-asset-studio` uses workspace scope and is a separate media pipeline product — not part of the core platform productization track.

## Classification legend

| Label | Meaning |
|---|---|
| **IMPLEMENTED** | Working code with Stage B test coverage |
| **FOUNDATION** | Real code; intentionally scoped; not full commercial product |
| **INTERNAL_ONLY** | Workspace/monorepo use only; not intended for external publish |
| **PUBLIC_READY** | Stable API, types, docs sufficient for npm publish (pending license) |
| **NEEDS_PRODUCTIZATION** | Stage C must add README, semver, exports audit, publish prep |

## Classification by domain

### platform-core — `@unilives/platform-core`

| Attribute | Value |
|---|---|
| Classification | **IMPLEMENTED** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Control plane store, provider registry, usage meter, project graph, trace context. In-memory only — Postgres adapter is Stage C work. |

### sdk — `@unilives/sdk`

| Attribute | Value |
|---|---|
| Classification | **IMPLEMENTED** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | `createUniLive()` active for RTC/events/control plane. Auth/database/storage/realtime/functions stubs throw adapter-required errors. |

### rtc-* (8 packages)

| Package | Classification | Notes |
|---|---|---|
| `@unilives/rtc-contracts` | **IMPLEMENTED**, **PUBLIC_READY** | Pure types; no provider leakage. Best first publish candidate. |
| `@unilives/rtc-core` | **IMPLEMENTED**, **NEEDS_PRODUCTIZATION** | Orchestrators + runtime; 16-test coverage. |
| `@unilives/rtc-client` | **IMPLEMENTED**, **NEEDS_PRODUCTIZATION** | `createUniLiveRTC` join/publish/leave. |
| `@unilives/rtc-server` | **IMPLEMENTED**, **NEEDS_PRODUCTIZATION** | Grants, webhook normalize, token mint. |
| `@unilives/rtc-livekit` | **IMPLEMENTED**, **NEEDS_PRODUCTIZATION** | Only package with `livekit-client` dep (dynamic import). |
| `@unilives/rtc-fake` | **IMPLEMENTED**, **INTERNAL_ONLY** | CI/MCP test double; not production media. |
| `@unilives/rtc-qoe` | **IMPLEMENTED**, **NEEDS_PRODUCTIZATION** | QoE governor, thermal profiles. |
| `@unilives/rtc-server` | (listed above) | |
| `@workspace/unilives-asset-studio` | **FOUNDATION**, **INTERNAL_ONLY** | Asset pipeline; separate scope. |

### mcp — `@unilives/mcp`

| Attribute | Value |
|---|---|
| Classification | **IMPLEMENTED** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | 17 tools; auth required by default. Stdio binary foundation. |

### cli — `@unilives/cli`

| Attribute | Value |
|---|---|
| Classification | **IMPLEMENTED** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | `init`, `doctor`, `rtc status`, delegates to repo scripts. `unilive start` documented, not complete. |

### auth — `@unilives/auth`

| Attribute | Value |
|---|---|
| Classification | **FOUNDATION** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Memory + Supabase adapters. SDK stub not wired. Reference app still uses Firebase directly. |

### database — `@unilives/database`

| Attribute | Value |
|---|---|
| Classification | **FOUNDATION** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Adapter boundary stub. Supabase default in registry. No ORM/query layer yet. |

### storage — `@unilives/storage`

| Attribute | Value |
|---|---|
| Classification | **FOUNDATION** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Adapter boundary stub. R2 default in registry. API returns bucket stub. |

### realtime — `@unilives/realtime`

| Attribute | Value |
|---|---|
| Classification | **IMPLEMENTED** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Topic lanes (authoritative vs loss-tolerant). Tested in Stage B suite. |

### deploy — `@unilives/deploy`

| Attribute | Value |
|---|---|
| Classification | **FOUNDATION** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Deployment lifecycle records. Actual promotion delegates to Vercel integration. |

### git — `@unilives/git`

| Attribute | Value |
|---|---|
| Classification | **FOUNDATION** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Repository metadata abstraction. GitHub default adapter. |

### observe — `@unilives/observe`

| Attribute | Value |
|---|---|
| Classification | **IMPLEMENTED** + **NEEDS_PRODUCTIZATION** |
| Stage C notes | Trace + sanitized logging. Feeds MCP `get_logs` / `get_metrics`. |

### ui — `@unilives/ui`

| Attribute | Value |
|---|---|
| Classification | **FOUNDATION** + **INTERNAL_ONLY** |
| Stage C notes | `createUiKitRegistry()` maps surfaces to reference app paths. No React components exported. Checkout/Orders/Seller are `foundation` only. |

## Stage C productization priority

1. `@unilives/rtc-contracts` → **PUBLIC_READY** (license pending)
2. `@unilives/rtc-core`, `rtc-client`, `rtc-server` → document + semver
3. `@unilives/platform-core`, `sdk` → Postgres persistence + wire stubs
4. `@unilives/mcp`, `cli` → publish prep + bin packaging
5. Boundary packages → adapter completion or honest "stub" docs
6. `@unilives/ui` → remain **INTERNAL_ONLY** until extractable components exist

## Dependency rule (enforced)

No `lib/unilives-*` package may import from `artifacts/instacollab`. Reference app imports platform packages — not reverse.
