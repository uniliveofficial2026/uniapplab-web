# AI Project Control — UniLive’s / Universal-Fixer

Authoritative control folder for AI agents working in this repository.

**Repository root:** `/Volumes/Wei2TB/Universal-Fixer`  
**Brand spelling (immutable):** UniLive’s  
**Main app:** `artifacts/instacollab/`  
**Phase 12 / assets:** `docs/unilives-assets/`, `public/unilives-assets/`, `production/unilives-assets/`  
**Asset studio package:** `lib/unilives-asset-studio/` (`@workspace/unilives-asset-studio`)

## Documents in this folder

| File | Purpose |
|------|---------|
| `project-map.md` | Real top-level layout and important paths |
| `approved-lock.md` | Locked approvals that must not drift |
| `rejected-log.md` | Explicit rejects / stop conditions |
| `asset-registry.md` | Current asset system snapshot |
| `animation-registry.md` | Animation / splash / preview rules |
| `prompt-library.md` | Reusable safe prompts for agents |
| `env-requirements.md` | Required env key **names** only |
| `work-mode-context.md` | How to operate locally without deploy |
| `next-tasks.md` | Ordered next work |

## Hard rules

- Do not change UI/UX unless explicitly asked.
- Do not deploy, push, merge, or publish unless explicitly asked.
- Never print or commit secrets from `.env` / `.env.local`.
- Never put provider secrets behind `VITE_`.
- Never invent production-approved assets.
- Never register whole design boards as runtime assets.
- Prefer existing Phase 12 manifest + resolvers over new parallel systems.

## Quick commands

```bash
cd /Volumes/Wei2TB/Universal-Fixer
./scripts/check-unilive-env.sh
./scripts/package-unilive-workmode-zip.sh
pnpm asset-studio:doctor
pnpm --filter @workspace/instacollab unilives:validate
pnpm --filter @workspace/instacollab android:bundle
```

## Play Store

See [`play-store-checklist.md`](./play-store-checklist.md) for AAB build, signing backup, and Console listing steps.
Package lock: `com.uniapplab.unilive`.