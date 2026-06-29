# Archived maintenance scripts

One-off or emergency tools. **Not run in CI.** Kept for reference only.

| Script | Purpose |
|--------|---------|
| `split-db.mjs` | Split `db.ts` into mixins (high risk, obsolete) |
| `split-db-domains.mjs` | Regenerate `src/lib/db/**` from `db.monolith.ts` (one-shot; overwrites) |
| `restore-db-monolith.mjs` | Rebuild monolith from fragments (high risk) |
| `repair-db.mjs` | Salvage corrupted `db.ts` |
| `extract-chat-panels.mjs` / `wire-chat-panels.mjs` | Messages screen codegen |

Use `npm run verify` after any manual run. Prefer normal edits over these scripts.
