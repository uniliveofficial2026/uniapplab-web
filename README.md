# UniAppLab

Monorepo for [uniapplab.com](https://uniapplab.com) — social app, API, and services.

## Domain map

| Host | Role |
|------|------|
| `uniapplab.com` | Landing website |
| `www.uniapplab.com` | Public website |
| `app.uniapplab.com` | **React app** (Vercel) — InstaCollab |
| `api.uniapplab.com` | Backend API |
| `live.uniapplab.com` | Live streaming |
| `call.uniapplab.com` | Voice / video calls |
| `chat.uniapplab.com` | Chat services |
| `media.uniapplab.com` | Images & videos |
| `cdn.uniapplab.com` | CDN assets |
| `admin.uniapplab.com` | Admin dashboard |

## Local dev

```bash
pnpm install
pnpm dev
# → http://localhost:5173
```

## Unified live (local + production, same data)

```bash
pnpm live
```

| URL | What you get |
|-----|----------------|
| `http://localhost:5173` | Instant HMR while you code |
| `app.uniapplab.com` / `uniapplab.com` / `www.uniapplab.com` | **Instant deploy on save** (same Supabase data; ~1–2 min Vercel build) |

- Local dev uses **production Supabase + API** (not isolated `?launch=main` demo).
- Deploy runs on startup and **immediately** when you save (0ms debounce default).
- Offline smoke tests: `?force_demo=1&launch=main`
- `LIVE_SYNC_DEBOUNCE_MS=5000 pnpm live` — optional delay between deploys
- `pnpm run deploy:vercel` — remote Vercel build (CLI archive, auto-falls back to Git on rate limit)
- `pnpm run deploy:vercel:git` — push to GitHub → Vercel remote build (bypasses CLI upload limit)
- `pnpm run deploy:vercel:fast` — local build + prebuilt upload

## Deploy React app → Vercel → app.uniapplab.com

1. Push repo to GitHub
2. [vercel.com/new](https://vercel.com/new) → Import repo
3. **Root Directory:** `.` (repo root — **not** `artifacts/instacollab`) so root `vercel.json` serves `/api/*` from `api-server`
4. Add env vars from `artifacts/instacollab/.env.example` **and** `artifacts/api-server/.env.example` (Supabase service role for API)
5. **Domains:** add `app.uniapplab.com`
6. Connect Supabase (see below)

**Error 111** (`upstream connect error … delayed connect error: 111`) means the browser is calling a dead API host (`api.uniapplab.com`). Fix: redeploy from repo root (above), or deploy `artifacts/api-server/render.yaml` on Render and point DNS `api` → that service.

```bash
pnpm run deploy:vercel   # remote Vercel build (staged source, archive upload)
pnpm run domains:setup   # prints DNS + Supabase + Google OAuth checklist
pnpm run oauth:setup     # Supabase auth URLs only
pnpm run auth:check      # verify Supabase tables
```

## Connect app → Supabase

1. Supabase → **Authentication → URL Configuration**
   - Site URL: `https://app.uniapplab.com`
   - Redirect URLs: `https://app.uniapplab.com/**`, `http://localhost:5173/**`
2. Enable **Google** provider
3. Run SQL bootstrap: `pnpm run auth:bootstrap-db`

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Local React app |
| `pnpm run domains:setup` | Production domain checklist |
| `pnpm run oauth:setup` | OAuth redirect URLs |
| `pnpm run auth:bootstrap-db` | Supabase SQL bootstrap |
| `pnpm run git:push` | Push to GitHub (with auth fix) |
