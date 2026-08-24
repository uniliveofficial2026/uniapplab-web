# Hosting Decision

## Vercel (checked once)
- Account/projects exist but public app returns `x-vercel-error: DEPLOYMENT_DISABLED` / HTTP 402.
- Not used for this cutover.

## Selected topology (authorized existing infra)
1. **Cloudflare Worker edge** `uniapplab-app` — SPA/docs/studio static + reverse proxy
2. **Render** `uniapplab-web` — Node API (`https://uniapplab-web.onrender.com`)
3. **Render** `uniapplab-greedy-tap` — Socket.IO game (`https://uniapplab-greedy-tap.onrender.com`)
4. **Cloudflare Worker** `uniapplab-media` + R2 — media
5. **Supabase** — DB/Auth/Realtime
6. **LiveKit** — RTC SFU

Workers subdomain: `uniliveofficial2026.workers.dev`
