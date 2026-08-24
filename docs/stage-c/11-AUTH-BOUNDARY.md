# 11 — Auth Boundary (`@unilives/auth`)

Provider-neutral auth adapter boundary.

## Package

- Path: `lib/unilives-auth`
- Name: `@unilives/auth` v0.1.0

## Factory

`createUniLiveAuth({ adapter, supabaseClient })`

| Adapter | Status |
|---|---|
| `memory` | **IMPLEMENTED** — Stage B test coverage |
| `supabase` | **FOUNDATION** — wraps `@supabase/supabase-js` when client injected |

## Session model

PERSON / DEVICE / APP SESSION remain distinct (documented intent). Memory adapter returns canonical user ids for tests.

## SDK integration

Stage B: SDK `auth` namespace throws `AUTH_ADAPTER_REQUIRED`.

Stage C target: wire registry default (`supabase`) when project env has auth connection.

## Reference app

Still uses Firebase auth directly in `artifacts/instacollab`. Migration to `@unilives/auth` is incremental — no UI change.

## Classification

**FOUNDATION** + **NEEDS_PRODUCTIZATION**

## Stage C work

- [ ] Complete Supabase adapter (session refresh, OAuth hooks)
- [ ] Optional Firebase adapter for reference app bridge
- [ ] Wire SDK stub
- [ ] Document canonical user id mapping rules

## Evidence

`scripts/test-stage-b.mjs` → `auth_memory_and_realtime_lanes`
