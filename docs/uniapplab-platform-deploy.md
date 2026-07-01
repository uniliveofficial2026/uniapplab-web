# UniAppLab platform deployment

## Services

| Service | Host | Platform |
|---------|------|----------|
| SPA | `app.uniapplab.com` | Vercel (`artifacts/instacollab`) |
| REST API | `api.uniapplab.com` | Vercel Node (`artifacts/api-server`) or Render web service |
| Chat WS | `chat.uniapplab.com` | Render web service (`artifacts/chat-ws`) |
| DB/Auth | Supabase `otiqckextvdbudbxzmau` | Supabase |

Root `vercel.monorepo.json` routes `/api/*` to the built api-server bundle (use when Vercel Root Directory is `.`).

## Environment variables

### Vercel — app (`artifacts/instacollab`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL=https://api.uniapplab.com` (optional; defaults to production API host)

### Vercel / Render — api-server

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` — JWT verification only
- `SUPABASE_SERVICE_ROLE_KEY` — **server only**, never `VITE_*`
- `CORS_ORIGINS` — comma-separated origins, e.g. `https://app.uniapplab.com,http://localhost:5173`
- `PORT` — Render binds `0.0.0.0:$PORT`

### Render — chat-ws (`artifacts/chat-ws`)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORT`

Clients connect: `wss://chat.uniapplab.com?token=<supabase_access_token>`

## Migrations

Apply SQL under `artifacts/instacollab/supabase/migrations/` to the Supabase project (roles, wallets, chat, streams).

## Local dev

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # :3000
pnpm --filter @workspace/instacollab run dev  # :5173
```

Set `VITE_API_URL=http://localhost:3000` in `artifacts/instacollab/.env`.

## Secrets

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or `VITE_*` vars.
- Admin, wallet credit, and ban/role changes require api-server + service role.
