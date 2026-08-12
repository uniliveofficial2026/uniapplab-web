# UniLive’s character pipeline — integration order

Official brand: **UniLive’s**

## Layout

```
Universal-Fixer/
├── .env.meshy.local                 # local secret (gitignored)
├── .env.meshy.local.example
├── tools/character-pipeline/
│   ├── meshy/                       # generate + 360° viewer
│   ├── blender/                     # export scripts
│   ├── audio/                       # lip-sync / SFX helpers
│   └── validation/
├── assets-source/unilives-character/
│   ├── references/                  # Meshy review GLBs + refs
│   ├── blender/                     # editable .blend masters
│   ├── textures/
│   ├── rigs/
│   ├── animations/
│   └── audio/
└── artifacts/instacollab/public/unilives-assets/characters/
    └── *.glb                        # optimized runtime only
```

Editable masters stay under `assets-source/`.  
Optimized app files go under `artifacts/instacollab/public/unilives-assets/characters/`.

## Prerequisites checklist

| Step | Item | Status notes |
|-----:|------|--------------|
| 1 | Add Meshy key to `.env.meshy.local` | required before generation |
| 2 | Install Blender | Blender 5.x app + CLI shim |
| 3 | Install Three.js | already in `@workspace/instacollab` (`three@0.185.1`) |
| 4 | Install FFmpeg | Homebrew ffmpeg present |
| 5 | Generate Meshy review model | `generate-review-model.mjs` |
| 6 | Inspect in 360° Three.js viewer | `meshy/viewer/index.html` |
| 7 | Correct + rig in Blender | masters in `assets-source/.../blender/` |
| 8 | Expressions + lip-sync | blender + audio tools |
| 9 | Export optimized GLB | `export-optimized-glb.py` → `public/.../characters/` |
| 10 | Animations, effects, sound | masters → runtime |
| 11 | Test inside UniLive’s | local Vite app |

## Safe Meshy key load

```bash
cd /Volumes/Wei2TB/Universal-Fixer
set -a
source .env.meshy.local
set +a

if [ -n "$MESHY_API_KEY" ]; then
  echo "Meshy key loaded"
else
  echo "Meshy key missing"
fi

# Never: echo "$MESHY_API_KEY"
unset MESHY_API_KEY
```

Or:

```bash
./tools/character-pipeline/meshy/check-key.sh
```

## Generate a review model

```bash
cd /Volumes/Wei2TB/Universal-Fixer
set -a && source .env.meshy.local && set +a
node tools/character-pipeline/meshy/generate-review-model.mjs \
  --prompt "UniLive’s friendly stylized mascot, A-pose, game-ready" \
  --name unilives-mascot-v1 \
  --refine
unset MESHY_API_KEY
```

Output lands in:

`assets-source/unilives-character/references/meshy-reviews/`

## Inspect (360°)

Open in a browser:

`tools/character-pipeline/meshy/viewer/index.html`

Load the downloaded `.glb`. Orbit / zoom / auto-rotate.

## Export runtime GLB from Blender

```bash
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
blender --background assets-source/unilives-character/blender/MASTER.blend \
  --python tools/character-pipeline/blender/export-optimized-glb.py -- \
  --out artifacts/instacollab/public/unilives-assets/characters/unilives-mascot.glb
```

## Validate structure

```bash
node tools/character-pipeline/validation/check-character-assets.mjs
```


## Progress log

| Step | Status | Evidence |
|-----:|--------|----------|
| 1 Meshy key | done | `.env.meshy.local` (gitignored) |
| 2 Blender | done | Blender 5.2 + clean CLI shim |
| 3 Three.js | done | `three@0.185.1` |
| 4 FFmpeg | done | ffmpeg 8.1.2 |
| 5 Meshy review model | done | `.../meshy-reviews/unilives-mascot-v1-refine.glb` |
| 6 360° viewer | done | `tools/character-pipeline/meshy/viewer/index.html` |
| 7 Blender correct+rig | first-pass done | `assets-source/.../blender/MASTER.blend` + `UniLivesRig` |
| 8 Expressions + lip-sync | placeholders | shape keys on master mesh (sculpt deltas next) |
| 9 Optimized GLB export | done | `public/unilives-assets/characters/unilives-mascot.glb` |
| 10 Animations / FX / sound | first-pass done | idle clip + ambient mp3 |
| 11 Test in UniLive’s | wired | `/?unilivesCharacterPreview=1` |

Use clean Blender launcher:

```bash
./tools/character-pipeline/blender/run-blender.sh
# or: blender  (shim in ~/.local/bin clears PYTHONPATH issues)
```
