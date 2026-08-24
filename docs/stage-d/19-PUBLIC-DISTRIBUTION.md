# Public Distribution Status

## Current state

| Item | Status |
| --- | --- |
| Tarball artifacts | **RELEASE_READY** — 12 packages at `release/artifacts/` |
| Checksums | SHA-256 in `release-manifest.json` |
| npm registry publish | **NOT PERFORMED** |
| Formal LICENSE file | **MISSING** (root `package.json` declares MIT only) |
| Public registry release | **RELEASE_READY_EXTERNAL_STEP** |

## External steps required

1. Add formal `LICENSE` file (legal confirmation)
2. npm org authentication + 2FA for `@unilives` scope
3. `npm publish` per artifact (manual or CI with secrets)

## Do not claim publicly

- "Available on npm" — until publish completes
- "MIT licensed" — until LICENSE file is committed and reviewed

See `LICENSE-RELEASE-STATUS.md`.
