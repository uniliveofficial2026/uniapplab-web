# Work mode context

## Operating mode: local repair / asset studio

1. Work only in `/Volumes/Wei2TB/Universal-Fixer`
2. Load keys from `.env.local` (do not commit)
3. Prefer existing Phase 12 + resolvers + Asset Studio package
4. Default dry-run for paid providers
5. Preserve UI/UX and business logic
6. No deploy / push / merge / publish unless explicitly requested

## Typecheck baseline

`pnpm --filter @workspace/instacollab typecheck` → **28** existing errors (AdminControlCenter + vite.config). Do not “fix” unrelated baseline debt unless asked.

## Validation suite

```bash
pnpm asset-studio:doctor
pnpm asset-studio:validate
pnpm --filter @workspace/instacollab unilives:validate
pnpm --filter @workspace/instacollab typecheck
pnpm --filter @workspace/instacollab build
```

## Portable work-mode pack

```bash
./scripts/package-unilive-workmode-zip.sh
```

Creates one clean zip under **500MB** excluding node_modules, dist, build, .git, old zips, mp4s, and real env files.
