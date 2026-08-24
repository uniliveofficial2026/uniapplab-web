# 01 — Product Scope (Stage C)

Stage C turns the Stage B **foundation** into a **productized UniLive Platform** that external developers and agents can adopt without forking the reference app.

## What UniLive Platform is

A provider-neutral control plane + RTC domain layer for building live social applications:

- **Control plane** — orgs, projects, environments, provider connections, credentials, deployments, audit
- **UniLiveRTC** — call, live, seat, PK orchestrators with swappable media providers
- **Developer surfaces** — REST API (`/v1/*`), SDK, MCP tools, CLI
- **Capability adapters** — auth, database, storage, realtime, deploy, git (boundary packages)
- **Reference app** — `artifacts/instacollab` demonstrates production UI; remains separate IP

## In scope for Stage C

| Area | Goal |
|---|---|
| Package productization | README, exports, types, semver policy per `@unilives/*` package |
| Public API v1 | Stable routes, credential middleware, OpenAPI or typed contract |
| SDK completeness | Wire auth/database/storage/realtime adapters (today stubs throw) |
| Control plane persistence | Postgres adapter replacing in-memory store |
| Reference app RTC migration | Full join/publish via `createUniLiveRTC`; shrink compatibility boundary |
| Import boundary | Monotonically decrease `livekit-client` offenders outside allowlist |
| Test matrix | Stage B + Stage A regressions + new Stage C acceptance gates |
| License decision | Explicit SPDX per package; no silent license inventing |
| Self-host docs | Honest BYO infrastructure guide (LiveKit OSS, Postgres, R2/MinIO) |

## Out of scope for Stage C

| Area | Reason |
|---|---|
| UI/UX redesign | Locked since Stage A (`uiUxChanged: false`) |
| Production SFU cutover | LiveKit remains media provider; alternate SFU is adapter work only |
| Visual Builder / Studio UI | `ProjectGraph` foundation only — no WYSIWYG editor |
| Native CallKit/PushKit device QA | Accepted external blocker from Stage A |
| Public npm publish | May be `RELEASE_READY_EXTERNAL_STEP` — requires license + CI publish pipeline |
| Commerce checkout UI kit | Registry entries `foundation` only — no new checkout screens |

## Target customer

1. **App developers** — integrate via SDK + `/v1/*` without touching LiveKit types
2. **Agent operators** — automate projects/deployments/tests via MCP
3. **Self-hosters** — run api-server + LiveKit OSS + Postgres with documented env vars
4. **Internal team** — reference app continues as dogfood; platform packages extracted cleanly

## Success criteria (Stage C acceptance)

See `25-FINAL-ACCEPTANCE.md`. High level:

- All `@unilives/*` packages classified and documented in `02-PACKAGE-MAP.md`
- Stage B test suite remains green; Stage C additions documented in `22-TEST-MATRIX.md`
- Reference app RTC attach path migrated (no new UI)
- License decision recorded in `LICENSE-DECISION.md`
- `uiUxChanged: false` maintained

## Non-goals (explicit)

- Replacing Firebase/Supabase in the reference app in one step (incremental adapter migration)
- Billing/commercial metering production cutover (foundation hooks exist; warehouse deferred)
- Extracting sticker/gift brand assets to npm (remain reference-app proprietary)
