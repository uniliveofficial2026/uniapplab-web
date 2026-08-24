# Release Pipeline

## Version source

`lib/unilives-release/version.mjs`:

- `PLATFORM_VERSION` = `0.1.0`
- `PLATFORM_CHANNEL` = `stable`
- Stage baselines A/B/C embedded

## Artifact generation

`scripts/stage-d-release-artifacts.mjs`:

1. `pnpm pack` each public package
2. Copy `.tgz` to `release/artifacts/`
3. SHA-256 checksum per artifact
4. Write `release-manifest.json` (root + `release/artifacts/`)

## Public packages (12)

`@unilives/sdk`, `cli`, `mcp`, `ui`, `rtc-client`, `rtc-react`, `project-graph`, `provider-sdk`, `plugin-sdk`, `errors`, `observe`, `templates`

## Stage D workspace packages (pack-validated, not in public manifest)

`@unilives/cloud`, `marketplace`, `ai-builder`, `selfhost`, `release`

## Consumer test

`scripts/stage-d-package-consumer.mjs` — isolated `node_modules` import smoke outside monorepo linker.

## CI

`.github/workflows/ci.yml` runs `pnpm run test:stage-d` on push/PR.

## Registry publish

**Not performed.** Manifest marks `publicRegistryRelease: RELEASE_READY_EXTERNAL_STEP`.
