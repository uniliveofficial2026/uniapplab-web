# @workspace/unilives-asset-studio

Server-only UniLive’s asset pipeline plug-in.

## Safety

- Loads secrets **only** from repository-root `.env.local`
- Never prints secret values
- Never uses `VITE_` for provider secrets
- Defaults: `ASSET_STUDIO_DRY_RUN=true`, max **1** paid call, no auto-retry, approval required
- Never marks assets `production-approved` automatically
- Rejects whole design boards as runtime assets

## Commands (from repo root)

```bash
pnpm asset-studio:doctor
pnpm asset-studio:status
pnpm asset-studio:prepare --id brand.logo.primary
pnpm asset-studio:preview --id brand.logo.primary --provider openai
pnpm asset-studio:approve --id brand.logo.primary --version v001
pnpm asset-studio:validate
```

With dry-run enabled, preview creates a planned job + draft folder but does **not** call paid providers.
