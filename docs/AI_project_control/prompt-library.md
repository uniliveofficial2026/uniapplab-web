# Prompt library (safe agent prompts)

## Repo orientation

```
You are inside /Volumes/Wei2TB/Universal-Fixer.
Brand is UniLive’s. Main app is artifacts/instacollab.
Use docs/AI_project_control and docs/unilives-assets as control docs.
Do not deploy. Do not expose .env.local secrets.
```

## Asset studio dry-run

```
Run pnpm asset-studio:doctor then
pnpm asset-studio:prepare --id brand.logo.primary
Keep ASSET_STUDIO_DRY_RUN=true. Do not call paid APIs.
```

## Brand pilot (only after APPROVED refs exist)

```
Produce draft/preview only for brand.logo.primary, brand.logo.icon, brand.logo.animated.
Preserve UniLive’s spelling and approved artwork. One paid call per asset max. No auto-retry.
Stop for human approval. Do not mark production-approved.
```

## Checkpoint review

```
Verify Phase 12 docs, manifest, resolvers, validators, typecheck baseline 28, build PASS.
Fix only necessary local defects. No UI/UX, schema, or product behavior changes.
```
