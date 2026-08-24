# Backup and Restore

## Self-host backup

`backupSelfHost({ dataDir })`:

- Exports postgres fixture (`data/postgres/dump.json`)
- Includes platform `config.json`
- Writes timestamped backup file path in result

## Restore

`restoreSelfHost({ dataDir, backupPath })`:

- Validates backup shape
- Restores postgres dump + config
- Used in DR qualification

## Cloud MVP

In-memory `@unilives/cloud` has no durable backup in Stage D. DR script uses cloud identity/usage assertions plus self-host backup path.

## Tests

- `lib/unilives-selfhost/test/selfhost.test.mjs` — full backup/restore cycle
- `scripts/stage-d-dr.mjs` — integrated DR scenario
