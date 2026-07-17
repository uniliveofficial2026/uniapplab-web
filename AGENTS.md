# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm monorepo (`pnpm@10.34.4`, Node 22) for **UniAppLab / InstaCollab** — a React 19 + Vite 7 social web app plus supporting services. Standard commands live in `README.md`, `replit.md`, and the per-package `package.json` files. Notes below are the non-obvious gotchas for running things in this environment.

### Services
- `@workspace/instacollab` (`artifacts/instacollab`) — the main React/Vite web app. This is the product; it runs standalone in "demo mode" with no cloud credentials.
- `@workspace/api-server` (`artifacts/api-server`) — Express 5 REST API for cloud features (optional for demo).
- `@workspace/chat-ws` (`artifacts/chat-ws`) — WebSocket server for real-time chat (optional).
- `@workspace/mockup-sandbox` — dev-only UI prototyping sandbox (not part of the product runtime).

### Running the app (local dev)
- Use `pnpm --filter @workspace/instacollab dev` to run the web app locally. It serves Vite on `http://localhost:5173` plus a passthrough proxy on `http://localhost:3000`.
- Do NOT use root `pnpm dev` / `pnpm develop` / `pnpm live` for local work — these run `scripts/live-sync.mjs`, a Replit/Vercel-oriented **auto-deploy on save** wrapper, not a plain local server.
- The API server: `pnpm --filter @workspace/api-server dev`. It requires `PORT` to be set in the env or it throws on startup, and it does a full build before `start` (no hot reload).

### Demo mode
- With no `VITE_SUPABASE_*` credentials, the app runs against an in-memory local store. The onboarding flow still asks you to "create an account" — this is handled locally (any email/password/username works), after which posts/feed/profile are fully functional. No external service is needed to exercise core functionality.

### Install gotcha
- Root `postinstall` runs `scripts/ensure-live.mjs`, which spawns a background `pnpm live` (auto-deploy) process unless a CI/cloud env var (`CI`, `VERCEL`, etc.) is set. When installing manually, run installs with `CI=1` to prevent that background process from starting. The startup update script already sets `CI` for this reason.

### Lint / typecheck / build
- Typecheck: `pnpm run typecheck` (whole workspace). Build: `pnpm run build` (builds `instacollab` + `api-server`). There is no dedicated ESLint script; `prettier` is available as the formatter.
