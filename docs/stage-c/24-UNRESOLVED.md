# 24 — Unresolved (Stage C)

Honest open items blocking or deferring Stage C acceptance. Updated at bootstrap — not exhaustive of all future work.

## License decision — **PENDING**

| Item | Status |
|---|---|
| SPDX license per `@unilives/*` package | **NOT DECIDED** |
| Reference app license (proprietary vs open) | **NOT DECIDED** |
| Contributor agreement / CLA | **NOT DECIDED** |

See `LICENSE-DECISION.md`. **No silent license inventing.**

Public npm publish is likely a **`RELEASE_READY_EXTERNAL_STEP`** — separate from Stage C foundation PASS.

## Public npm publish — **DEFERRED**

| Blocker | Notes |
|---|---|
| License decision | Required before any publish |
| CI publish pipeline | Not configured |
| Semver policy | Documented in Stage C target, not enforced |
| `@unilives/*` currently `"private": true` | Workspace-only |

## Control plane persistence — **NOT STARTED**

In-memory store is acceptable for Stage B foundation; self-host and multi-instance API require Postgres adapter.

## SDK capability stubs — **OPEN**

`auth`, `database`, `storage`, `realtime`, `functions` throw adapter-required errors. Boundary packages exist but are not wired through SDK/registry.

## API auth middleware — **OPEN**

`controlPlane.authorize()` exists; not enforced on all `/v1/*` mutating routes. MCP enforces auth.

## Reference app RTC migration — **IN PROGRESS**

- `hostLiveKitRoom` still uses compatibility boundary
- Legacy `lib/livekit/*` paths active
- Target: full `createUniLiveRTC` attach without UI change

## Production RTC cutover — **NOT PERFORMED** (intentional)

`productionRtcCutover: NOT_PERFORMED` — UniLiveRTC API is product-facing; LiveKit remains media provider. Not a Stage C blocker unless explicitly scoped.

## Visual Builder / Studio UI — **OUT OF SCOPE**

`ProjectGraph` foundation only. No WYSIWYG editor in Stage C.

## Native CallKit/PushKit — **ACCEPTED EXTERNAL BLOCKER** (Stage A)

VoIP cert + online device required. Unchanged.

## APNs provider key — **ACCEPTED EXTERNAL BLOCKER** (Stage A)

Key absent after credential exhaust. FCM topic healthcheck PASS.

## Commerce UI kit (Checkout/Orders/Seller) — **FOUNDATION ONLY**

Registry entries exist; no new checkout screens. Not blocking platform productization.

## `@workspace/unilives-asset-studio` scope — **OPEN**

Separate media pipeline product under workspace scope. Relationship to `@unilives/*` platform TBD.

## Resolution tracking

Items move to `23-CHANGE-LOG.md` when resolved. Stage C acceptance (`25-FINAL-ACCEPTANCE.md`) remains **NOT PASS** until checklist items are honestly checked.
