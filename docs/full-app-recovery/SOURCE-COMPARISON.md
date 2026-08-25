# SOURCE COMPARISON — Full App Recovery

Status date: 2026-08-25  
Prior acceptance tip `d715b726…` = **INVALID** (owner physical observation).

## Worktrees inspected (read-only)

| Tree | Branch / tip | `instacollab/src` files |
|---|---|---|
| Original `/Volumes/Wei2TB/Universal-Fixer` | `fix/vercel-api-root-now` @ `fb94caf` + **749 dirty** | 1348 (working tree) |
| Stage C | `6e178ef` | 1311 tracked / 1348 wt |
| Stage D | `47e15f9` | 1348 |
| Production Launch | `9e8c44a` (local behind remote) | 1348 |
| Device QA | `d715b72` | 1348 |
| **Recovery** | `fix/restore-full-production-app` @ `d715b72` | 1348 |

## Finding A — Frontend source is NOT missing from release tip

Byte comparison of `artifacts/instacollab/src` between:

- Owner **working tree** (including dirty files)
- Device-QA / Recovery tip `d715b72`

Result:

- **1348 vs 1348 files**
- **0 content diffs**
- **0 owner-only src files**

Conclusion: the incomplete product is **not** explained by “forgot to copy ~700 dirty frontend files.” Dirty frontend sources already match the released tip.

## Finding B — Owner dirty tree STILL contains critical non-src deltas

Revalidated (not “unrelated”):

### API server (REAL_APP_REQUIRED)

Owner dirty `artifacts/api-server` **differs** from recovery tip. Notably `routes/chat.ts`:

| | Recovery tip | Owner dirty |
|---|---|---|
| Lines | ~140 | ~441 |
| Routes | POST threads/messages/typing | **GET /threads**, **GET /threads/:id/messages**, DM key, group meta, delete, etc. |

Production currently 404s `GET /api/chat/threads` (probe). That matches the stripped chat router.

Other dirty API files to reconcile: `app.ts`, `index.ts`, `gifts.ts`, `livekit.ts`, `me.ts`, `presence.ts`, `stream.ts`, plus untracked migrations under `artifacts/instacollab/supabase/migrations/`.

### Tests / migrations / vendor (classify)

Many owner-only files are tests, admin-dev bridges, locale resources — keep investigating; do not discard UNKNOWN.

## Finding C — What production actually shows (browser evidence)

Playwright against `https://app.uniapplab.com/`:

1. Branded onboarding (“Go Live” / unicorn) — **present**
2. Auth welcome (Google / Sign Up with Email) — **present**
3. Logged-out shell (Home/Live/Messages) — **not reachable without auth** (expected funnel)

So the consumer **brand shell exists**. Owner “not the full app” is therefore more likely:

- logged-in experience broken / hollow (API gaps, dual Firebase/Supabase, missing chat list, etc.)
- Cap WebView session / cache / stuck funnel
- and/or feature surfaces that depend on fuller API never hydrate

## Finding D — Production API surface is partially hollow

Probes (edge = Render origin):

| Path | Result |
|---|---|
| `/api/health`, `/api/v1/health`, `/api/v1/cloud/health` | 200 |
| `/api/gifts/catalog`, `/api/feed/posts`, `/api/wallet` | 200/401 |
| `/api/chat/threads` (GET) | **404** |
| `/api/livekit/token` (GET) | 404 (POST-only in source — OK) |
| `/api/me` | 404 (actual is `/api/me/me`) |

Render service `uniapplab-web` rootDir=`deploy/render-api`, autoDeploy from `release/app-uniapplab-production`. Bundle contains many route strings, but **chat list GET is absent** vs owner dirty.

## Finding E — Leftover / dual-stack issues

- `/_vercel/speed-insights/script.js` still referenced → 404 / MIME fail
- `firebase-config.json` still `uchat-app-c1b8e` while auth primary is Supabase
- Firestore Listen channels still open in network log

## Slim SPA?

`deploy/spa-public` is a full Vite SPA (~198 assets, large unilives-assets). Not a Studio-only shell. Root title UniLive’s. Studio remains `/studio/`.

## Next recovery actions

1. Port owner dirty **fuller chat API** (+ related helpers/migrations) into recovery branch.
2. Rebuild `deploy/render-api` full bundle; redeploy Render API.
3. Remove Vercel speed-insights from production HTML/build.
4. Screen-crawl authenticated session; mark features PASS/FAIL/NOT_TESTED only from runtime.
5. Cap iPhone completeness check after API restore.

## Status (honest)

| Gate | Status |
|---|---|
| Prior acceptance | **FAIL / INVALID** |
| Full real app on device | **FAIL** (owner) |
| Frontend src completeness vs dirty | **PASS** (identical) |
| Backend completeness vs dirty | **FAIL** |
| Production artifact = consumer app branding | **PASS** (launch/auth) |
| Production functional completeness | **FAIL** |
