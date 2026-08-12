# Project map (real repository)

Root: `/Volumes/Wei2TB/Universal-Fixer`

## Top-level entries (non-dot)

| Path | Role |
|------|------|
| `artifacts/` | Apps & services (`instacollab`, `api-server`, `chat-ws`, …) |
| `lib/` | Shared packages (`livekit`, `db`, `unilives-asset-studio`, …) |
| `docs/` | Architecture + `unilives-assets` Phase 12 + this control folder |
| `production/unilives-assets/` | Masters / previews / references / drafts (non-runtime) |
| `unilives_master_source/` | Character manuals + approved references (+ large models) |
| `assets-source/` | Character source pipeline stubs |
| `scripts/` | Local tooling, packagers, env checks |
| `supabase/` | SQL / local supabase assets |
| `workers/` | Edge/worker projects |
| `exports/` | Generated zips (not source of truth) |
| `config/` | Deploy/domain config JSON |
| `tools/` | Local tools |
| `vendor/` | Vendored binaries/archives |
| `package.json` / `pnpm-workspace.yaml` | Workspace root |

## Critical app paths

| Path | Role |
|------|------|
| `artifacts/instacollab/` | UniLive’s frontend (Vite/React) |
| `artifacts/instacollab/public/unilives-assets/` | Runtime asset tree + `manifest.json` |
| `artifacts/instacollab/src/lib/unilives-assets/` | Central resolvers + `seed.json` |
| `artifacts/instacollab/public/brand/app-logo.png` | Legacy known-good brand fallback |
| `artifacts/instacollab/public/live-gifts/*.svga` | Legacy gift SVGAs |
| `lib/unilives-asset-studio/` | Server-only provider plug-in (dry-run default) |

## Docs of record

- `docs/unilives-assets/` — Phase 12 audits, inventories, blockers, recovery reports
- `docs/AI_project_control/` — this AI work-mode control pack
