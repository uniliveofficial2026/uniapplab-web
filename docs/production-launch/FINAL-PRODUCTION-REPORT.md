# UniLive’s PRODUCTION LAUNCH — COMPLETE

## Production URL
https://app.uniapplab.com

## Status
LIVE / PASS

## Final Git SHA
`a8eb0df6b3c7b5c78af753011a3480f97258c28e`

## Branch
`release/app-uniapplab-production`

## Hosting Topology
- Cloudflare Worker `uniapplab-app` (edge router + SPA deep-link fallback)
- Render `uniapplab-web` (API Node)
- Render `uniapplab-spa` (SPA/docs/studio shell)
- Render `uniapplab-greedy-tap` (Socket.IO game)
- Cloudflare `uniapplab-media` + R2
- Supabase Postgres/Auth/Realtime
- LiveKit via UniLiveRTC

## Evidence highlights
- DNS cutover off Weglot/Vercel 402 → Workers custom domain + route
- TLS valid (Google Trust Services WE1)
- `/api/v1/health` returns UniLiveRTC + LiveKit
- `/api/v1/cloud/health` persistenceMode=durable
- Org/project rows persist in `unilive_*` tables across API redeploy
- Socket.IO WSS upgrade PASS
- Game healthz PASS
- SPA deep links PASS

## SFU Cutover
NOT_PERFORMED

## npm / License
RELEASE_READY_EXTERNAL_STEP (does not block hosting)

## Remaining external
- Formal LICENSE / public npm publish decision
- APNS / native device QA if still external
- Protected main PR review if required by branch policy
