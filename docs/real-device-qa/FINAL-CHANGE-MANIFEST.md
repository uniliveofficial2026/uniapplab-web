# FINAL CHANGE MANIFEST (real-device QA)

## Code
- `artifacts/instacollab/src/components/games/LocalGamePlayer.tsx` — DEV-only local fixed-server probe
- `artifacts/instacollab/src/lib/localGames/catalog.ts` — comment alignment
- `scripts/real-device-mapping-gate.mjs` — CI mapping gate
- `scripts/real-device-media-probe.mjs` — real hardware GUM probe
- `.github/workflows/ci.yml` — mapping gate + `qa/**` branch trigger
- `package.json` — `test:real-device-mapping`
- `deploy/spa-public/**` — rebuilt SPA including LocalGamePlayer fix

## Docs
- `docs/real-device-qa/**` maps, audits, FINAL-*, evidence/

## uiUxChanged
false

## Not changed
- RTC stack remains UniLiveRTC → LiveKit
- No CallKit/APNS enablement
- No provider cutover
