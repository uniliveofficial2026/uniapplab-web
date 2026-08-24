# Final Route Map

| Path | Origin |
|---|---|
| `/api/*` | Render API `uniapplab-web` |
| `/games/greedy-slot/*` | Render Greedy |
| `/socket.io` | Render Greedy |
| `/media/*` | Cloudflare media Worker |
| `/studio/*` | SPA static origin |
| `/docs/*` | SPA static origin |
| `/*` | SPA + Worker index.html fallback |
