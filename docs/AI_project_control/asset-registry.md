# Asset registry snapshot

Source of truth: `artifacts/instacollab/public/unilives-assets/manifest.json` + `src/lib/unilives-assets/seed.json`

| Metric | Value |
|--------|------:|
| Seed version | 10 |
| Seed assets | 259 |
| Manifest entries | 260 |
| Seed status=missing | 259 |
| Manifest production-approved | 0 |
| Manifest installed | 0 |
| Preview-on-disk (not production-approved) | 1 (`character.mascot.preview.glb`) |
| Replacement mappings | 159 |

## Brand pilot IDs

| Canonical ID | Role | Production status |
|--------------|------|-------------------|
| `brand.logo.primary` | Primary logo | missing |
| `brand.logo.icon` | App icon mark | missing |
| `brand.logo.animated` | Default animated splash/logo | missing |
| `brand.splash.main` | Static splash layout | missing |

## Runtime / legacy fallbacks

- `/brand/app-logo.png`
- `/live-gifts/{mic,star,crown,rocket}.svga`

## Folders

- Runtime: `artifacts/instacollab/public/unilives-assets/`
- Masters/previews/refs: `production/unilives-assets/`
- Studio drafts: `production/unilives-assets/previews/drafts/`
