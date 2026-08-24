# Hosting Topology

Vercel account deployment remains blocked (`DEPLOYMENT_DISABLED`). Abandoned after one check.

## Production
- Edge: Cloudflare Worker `uniapplab-app` on `app.uniapplab.com`
- SPA/Docs/Studio shell: Render Static `uniapplab-spa` (`deploy/spa-public`)
- API: Render Web `uniapplab-web` (`deploy/render-api`)
- Game/Socket.IO: Render Web `uniapplab-greedy-tap`
- Media: Cloudflare Worker `uniapplab-media` + R2 `livestream-assets`
- DB/Auth/Realtime: Supabase `ldxrdbyznheayhbkvxlq`
- RTC: LiveKit via UniLiveRTC

## Route map
- `/api/*` → Render API
- `/games/greedy-slot/*`, `/socket.io` → Greedy
- `/media/*` → media Worker
- `/*` → SPA origin with Worker SPA deep-link fallback
