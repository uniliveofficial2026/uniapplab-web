# 00 — Baseline

| Field | Value |
|---|---|
| Stage | **A only** (Stage B NOT started) |
| Branch | `fix/vercel-api-root-now` |
| Commit | `54656e48f9358d5be5d4192529510f07a5bb2f3d` |
| Node | v26.3.0 |
| pnpm | 10.34.4 |
| Started | `2026-08-23T06:49:57Z` |
| Dirty tree | ~602 porcelain entries (**PRE-EXISTING**, not from this work) |
| Backup | `backups/production-hardening/baseline-20260823T064955Z` |
| Backup contents | `tracked.diff`, status porcelain, untracked list (+ tracked-stat / patch) |
| uiUxChanged | **false** (ZERO redesign invariant) |
| Production deploy | **Forbidden** during Stage A |
| Prior audit | `docs/rtc-audit/` — evidence, **not** absolute truth; claims re-verified in `AUDIT-CLAIM-REVERIFY.md` |

## In-scope packages

| Area | Paths |
|---|---|
| Apps | `artifacts/instacollab`, `artifacts/api-server`, `artifacts/chat-ws`, `artifacts/admin-panel` |
| Libs | `lib/livekit`, `lib/db`, and related shared libs |
| Workers | `workers/uniapplab-media` |

## Tooling / MCP (snapshot)

| Provider | State |
|---|---|
| Cloudflare MCP | `needsAuth` |
| Supabase plugin | ready |
| Vercel | ready |
| LiveKit CLI | not found |
| Wrangler | not in PATH |

## Known baseline defect

- `api-server` typecheck **FAIL**: DevAgentChatResult grounded fields (pre-existing)

## Status

| Item | Status |
|---|---|
| Workspace / docs scaffold | IN_PROGRESS |
| Baseline backup | DONE |
| Typecheck (api-server) | STARTED / FAIL known |
| Stage B | NOT STARTED |
| Production deploy | BLOCKED (Stage A policy) |

## Baseline validation (re-run)

| Check | Result | Evidence | At |
|---|---|---|---|
| `pnpm run typecheck` | **PASS** | all workspace packages Done | 2026-08-23T07:16:38Z |
| `pnpm run test:gifts` | **PASS** | 3/3 | 2026-08-23T07:16:38Z |
| `pnpm run test:wallet` | **PASS** | 7/7 | 2026-08-23T07:16:38Z |
| LiveKit auth unit tests | **PASS** | 3/3 viewer/seat/host grants | 2026-08-23T07:16:38Z |
| Production deploy | **NOT PERFORMED** | Stage A rule | 2026-08-23T07:16:38Z |
| Stage B RTC | **NOT STARTED** | gate locked | 2026-08-23T07:16:38Z |
| uiUxChanged | **false** | invariant | 2026-08-23T07:16:38Z |

Prior known FAIL (`DevAgentChatResult.grounded` / admin-control-plane) was **FIXED** in this Stage A pass (api-server typecheck green).

