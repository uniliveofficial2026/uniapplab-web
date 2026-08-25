# Full-app recovery — FINAL REPORT (honest; not acceptance)

**Status: FAIL — prior device acceptance INVALID. Do not treat this as PASS.**

## Owner authority

Owner opened the real-device production app and reported it still broken / not the full UniLive’s application. That overrides CI, contracts, health, and prior PASS reports.

## What was wrong (root causes found)

1. **Frontend `instacollab/src` was already complete** vs owner dirty tree (1348/1348 identical). The incomplete feel was not “missing SPA src.”
2. **Backend chat list was stripped** — owner dirty `chat.ts` had GET `/threads` etc.; release tip did not. Production previously 404’d; after `5a259bf` returns **401** (route present).
3. **Auth boot gap** — `AuthProvidersHost` rendered children without AuthContext until async load → offline stub behavior.
4. **Vercel SpeedInsights** left in SPA → 404/MIME noise on non-Vercel hosting.
5. **Onboarding hit targets** too small on Cap/notch — painted “Next” is art; real buttons invisible.
6. **Additional API surface still thinner than owner dirty** — me identities, presence offline/devices, stream room_type/viewers, gifts lifecycle/catalog, livekit seat publish authority, youtube detail routes, fuller Upstash. **Recovered into recovery branch and rebuilt `deploy/render-api` — pending next deploy tip.**

## What is live now (`5a259bf`)

- SPA + API on Render at recovery SHA `5a259bf…`
- Health 200
- `/api/chat/threads` → 401 JSON (not missing-route 404)
- No SpeedInsights in production index chunk

## What is NOT PASS yet

- Owner-visible full-app completeness on iPhone
- Auth → home → nav functional walkthrough
- Messages/calls/live/PK/gifts/marketplace functional PASS
- iPhone↔Mac media qualification
- Remaining dirty migrations / app.ts merge

## Gates added

`pnpm run test:full-app-gates` (routes, components, API map, production artifact) wired into CI.

## Manifests generated

Under `docs/full-app-recovery/`:

- FULL-SOURCE-MANIFEST.md
- FULL-SCREEN-MANIFEST.json
- FULL-ROUTE-MANIFEST.json
- FULL-COMPONENT-MANIFEST.json
- FULL-API-MAP.json
- FEATURE-FLAGS.json
- STUB-SCAN.json
- RECOVERED-FILES.md
- FINAL-STATUS.json (FAIL)

## Next required steps

1. Commit + deploy this API recovery tip.
2. Re-open Cap on iPhone; confirm full consumer shell (not Studio).
3. Only then run iPhone↔Mac call/live functional tests.
4. Keep `fullRealApplication=FAIL` until owner’s full app is visibly present and functions work.
