# Environment requirements

Permanent secrets live only in repository-root `.env.local` (gitignored).

## Provider key names (never print values)

```
OPENAI_API_KEY
OPENAI_IMAGE_MODEL=gpt-image-2
MESHY_API_KEY
RUNWAY_API_KEY
KLING_API_KEY
KLING_ACCESS_KEY
KLING_SECRET_KEY
ELEVENLABS_API_KEY
```

Kling: fill either `KLING_API_KEY` **or** access/secret pair.

## Asset Studio safety

```
ASSET_STUDIO_DRY_RUN=true
ASSET_STUDIO_MAX_PAID_CALLS=1
ASSET_STUDIO_AUTO_RETRY=false
ASSET_STUDIO_REQUIRE_APPROVAL=true
```

## Rules

- Never use `VITE_` for provider secrets
- Templates: `.env.providers.example`, `docs/AI_project_control/env.example`
- Check without revealing secrets: `./scripts/check-unilive-env.sh`
