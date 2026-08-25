# FINAL PROVIDER MAP

| Concern | Provider | Notes |
|---|---|---|
| Edge / SPA route | Cloudflare Worker `uniapplab-app` | app.uniapplab.com |
| SPA static | Render `uniapplab-spa` | deploy/spa-public |
| API | Render `uniapplab-web` | /api/* |
| Games / Socket.IO | Render `uniapplab-greedy-tap` | /games/greedy-slot/*, /socket.io |
| Auth / DB / Realtime | Supabase | ldxrdbyznheayhbkvxlq |
| Object storage | Cloudflare R2 + media Worker | |
| RTC media | LiveKit via UniLiveRTC | locked |

No SFU cutover. No Vercel production path (account DEPLOYMENT_DISABLED).
