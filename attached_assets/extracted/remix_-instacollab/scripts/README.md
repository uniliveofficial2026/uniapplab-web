# Maintenance scripts

## Safe to run anytime

| Script | Command | Purpose |
|--------|---------|---------|
| Health check | `npm run check:health` | Line limits, `db.ts` structure |
| Full verify | `npm run verify` | Typecheck, ESLint, build, health |

## Do not run without a commit + backup

These scripts have caused broken `db.ts` merges in the past:

| Script | Risk |
|--------|------|
| `split-db.mjs` | Splits `db.ts` into mixins; easy to leave half-imported code |
| `restore-db-monolith.mjs` | Rebuilds monolith from fragments; can produce invalid TS |
| `repair-db.mjs` | Emergency salvage only when `db.ts` is already corrupted |
| `extract-chat-panels.mjs` / `wire-chat-panels.mjs` | One-off codegen for Messages split; re-run only if you know the line ranges |
| `archive/split-db-domains.mjs` | Regenerates `src/lib/db/**` from `db.monolith.ts` (overwrites domain modules) |

**DB maintenance (safe, idempotent):** `trim-db-domain-imports.mjs`, `fix-db-mixin-this.mjs`, `revert-db-mixin-local-this.mjs` — only run if you know you need to re-apply mixin import/typing fixes.

Before any destructive script: `git add -A && git commit -m "checkpoint before script"` (or stash).

## Adding new scripts

- Prefer `npm run verify` as the exit gate.
- Document the script in this README.
- Avoid editing `src/lib/db.ts` with regex unless you run `npm run verify` immediately after.
