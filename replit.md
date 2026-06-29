# InstaCollab

A social media platform to create, connect, and collaborate in real time — with posts, reels, stories, messages, notifications, a creator workspace, dating, live, games, and a wallet.

## Run & Operate

- `pnpm --filter @workspace/instacollab run dev` — run the InstaCollab web app (port 25173)
- `pnpm --filter @workspace/instacollab run typecheck` — typecheck the app
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite 7, Tailwind CSS v4
- Animations: motion/react (Framer Motion)
- Auth: Firebase + Supabase (via CloudAuthContext)
- AI: @google/genai (Gemini)
- Icons: lucide-react
- Charts: recharts
- DB (local demo mode): in-memory db via useDB hook
- API: Express 5 (api-server artifact)

## Where things live

- `artifacts/instacollab/src/` — all InstaCollab source files
- `artifacts/instacollab/src/App.tsx` — root component, tab routing
- `artifacts/instacollab/src/components/layout/Shell.tsx` — responsive layout shell (desktop sidebar + mobile top/bottom nav)
- `artifacts/instacollab/src/lib/useDB.ts` — in-memory local data store (demo mode)
- `artifacts/instacollab/src/lib/utils.tsx` — shared utilities + `cn()` helper
- `artifacts/instacollab/src/index.css` — Tailwind v4 theme tokens and global styles
- `artifacts/instacollab/src/contexts/CloudAuthContext.tsx` — Firebase + Supabase auth

## Architecture decisions

- App runs in "demo mode" (local in-memory state) without Firebase/Supabase credentials — just tap "Continue" on the splash screen.
- Firebase/Supabase credentials must be set as env vars (`VITE_FIREBASE_*`, `VITE_SUPABASE_*`) to enable cloud auth.
- Tailwind v4 uses CSS-native `@theme` tokens — no `tailwind.config.js` needed.
- `@` path alias resolves to `./src/` so `@/lib/utils` → `./src/lib/utils`.
- All scaffold shadcn UI components were removed (not used by the original app).

## Product

- **Home feed** — posts, stories, likes, comments
- **Reels** — short video feed
- **Messages** — real-time chat
- **Notifications** — activity feed
- **Search / Explore** — discover users and content
- **Creator Workspace** — dashboard for creators
- **Dating** — match and connect
- **Live** — live streaming
- **Local & Third-Party Games** — in-app games
- **Wallet** — in-app currency and purchases
- **Marketplace** — presets, templates, digital goods

## User preferences

_Populate as the user provides explicit instructions._

## Gotchas

- Do NOT add scaffold shadcn UI components back — they were removed on purpose.
- The `src/lib/utils.tsx` file exports both the original app utilities AND `cn()`.
- Demo mode (no Firebase/Supabase credentials needed) uses seeded local data.
- Vite alias `@` → `./src` (NOT the artifact root `.`).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
