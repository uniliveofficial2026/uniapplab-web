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

## Deploy React app → Vercel → app.uniapplab.com

1. Push repo to GitHub
2. [vercel.com/new](https://vercel.com/new) → Import repo
3. **Root Directory:** `artifacts/instacollab`
4. Add env vars from `artifacts/instacollab/.env.example`
5. **Domains:** add `app.uniapplab.com`
6. Connect Supabase (see below)

```bash
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
