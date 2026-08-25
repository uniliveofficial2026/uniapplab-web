# UniLive’s FULL APP RECOVERY — STATUS

## Verdict
**FAIL** — prior real-device acceptance is **INVALID**. Owner observation confirmed.

## Production
https://app.uniapplab.com

## What was wrong (evidence)

1. **Backend chat was stripped** vs owner dirty source: production `GET /api/chat/threads` → 404. Owner dirty `chat.ts` includes list/read/DM routes.
2. **Auth boot gap**: `AuthProvidersHost` rendered children with **no** AuthContext until async import finished → `useAuth` offline stub warning on production.
3. **Vercel Speed Insights** still imported → `/_vercel/speed-insights/script.js` 404/MIME fail on Cloudflare/Render hosting.
4. **Onboarding “Next” is painted in JPG art**; real controls are invisible hit targets. Cap/notch geometry made hits too small → taps feel like a dead/fake app.
5. Frontend `artifacts/instacollab/src` is **identical** to owner dirty tree — incompleteness was **not** “missing SPA files from dirty tree.” Dirty API + runtime defects were.

## Recovery branch
`fix/restore-full-production-app`  
Worktree: `/Volumes/Wei2TB/Universal-Fixer-Full-App-Recovery`

## Fixes included (pending full redeploy verification)

- Restore fuller `chat.ts` + `chatDmKey.ts` into Render API bundle
- AuthContext boot stub while providers hydrate
- Remove SpeedInsights
- Enlarge onboarding invisible hit targets (no visual redesign)

## Honesty
No feature is marked PASS until runtime evidence on iPhone + Mac after deploy.
