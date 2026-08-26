#!/usr/bin/env node
/**
 * Generates docs/visual-runtime inventory matrices from source + public trees.
 * Does not invent artwork; classifies missing production-required files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/visual-runtime');
const PUBLIC = path.join(ROOT, 'artifacts/instacollab/public');
const SRC = path.join(ROOT, 'artifacts/instacollab/src');

const MEDIA_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.svga',
  '.json', '.apng',
]);

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

function classifyPath(rel) {
  if (rel.startsWith('live-tools-v14/')) return 'PUBLIC_ROOT_ASSET';
  if (rel.startsWith('live-gifts/')) return 'PUBLIC_ROOT_ASSET';
  if (rel.startsWith('unilives-assets/')) return 'PUBLIC_ROOT_ASSET';
  if (rel.startsWith('brand/')) return 'PUBLIC_ROOT_ASSET';
  if (rel.startsWith('assets/')) return 'BUNDLED_IMPORTED_ASSET';
  return 'PUBLIC_ROOT_ASSET';
}

function inventoryPublicAssets() {
  const files = walkFiles(PUBLIC).filter((f) => MEDIA_EXT.has(path.extname(f).toLowerCase()));
  const assets = files.map((abs) => {
    const rel = path.relative(PUBLIC, abs).split(path.sep).join('/');
    const st = fs.statSync(abs);
    return {
      path: `/${rel}`,
      sourceClass: classifyPath(rel),
      bytes: st.size,
      ext: path.extname(abs).toLowerCase(),
      failureClass: st.size === 0 ? 'ASSET_ZERO_BYTES' : null,
    };
  });
  return assets;
}

function inventoryAnimations() {
  const cssFiles = walkFiles(SRC).filter((f) => /\.(css|scss)$/.test(f));
  const tsFiles = walkFiles(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
  const entries = [];

  for (const f of cssFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    for (const m of text.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)) {
      entries.push({
        id: m[1],
        kind: 'CSS_KEYFRAMES',
        sourceFile: rel,
        proof: 'document.getAnimations() currentTime T0/T1',
      });
    }
    if (/animation\s*:/.test(text) || /animation-name\s*:/.test(text)) {
      entries.push({
        id: path.basename(f),
        kind: 'CSS_ANIMATION_DECL',
        sourceFile: rel,
      });
    }
  }

  const markers = [
    ['PRINCESS_INAPP_LOADING', 'VIDEO_LOOP'],
    ['avatar-ring-spin', 'CSS_KEYFRAMES'],
    ['thought-bubble-float', 'CSS_KEYFRAMES'],
    ['V14_GIFT_SPECS', 'CSS_MOTION_ON_IMAGE'],
    ['V14_STICKERS', 'CSS_MOTION_ON_IMAGE'],
    ['V14_BEAUTY', 'STATIC_COVER'],
    ['requestAnimationFrame', 'RAF'],
    ['lottie', 'LOTTIE'],
    ['svga', 'SVGA'],
  ];
  for (const f of tsFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    for (const [needle, kind] of markers) {
      if (text.includes(needle)) {
        entries.push({ id: needle, kind, sourceFile: rel });
      }
    }
  }

  // Dedup by id+file
  const seen = new Set();
  return entries.filter((e) => {
    const k = `${e.kind}|${e.id}|${e.sourceFile}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function requiredProductionPaths() {
  const required = [];
  // Loading
  required.push(
    '/unilives-assets/brand/loading/princess-inapp-loading-locked.mp4',
    '/unilives-assets/brand/loading/princess-inapp-loading-locked.jpg',
    '/unilives-assets/brand/loading/princess-loading-refresh-bg-extend.svg',
    '/brand/app-logo.png',
  );
  // V14 gifts/stickers/beauty/voices (from liveToolsV14Artwork)
  const v14 = path.join(PUBLIC, 'live-tools-v14');
  if (fs.existsSync(v14)) {
    for (const f of walkFiles(v14)) {
      if (MEDIA_EXT.has(path.extname(f).toLowerCase())) {
        required.push(`/${path.relative(PUBLIC, f).split(path.sep).join('/')}`);
      }
    }
  }
  // approved-v12 covers
  const v12 = path.join(PUBLIC, 'live-gifts/approved-v12');
  if (fs.existsSync(v12)) {
    for (const f of walkFiles(v12)) {
      if (MEDIA_EXT.has(path.extname(f).toLowerCase())) {
        required.push(`/${path.relative(PUBLIC, f).split(path.sep).join('/')}`);
      }
    }
  }
  // Legacy SVGAs
  for (const id of ['mic', 'star', 'crown', 'rocket']) {
    required.push(`/live-gifts/${id}.svga`);
  }
  return [...new Set(required)];
}

function buildBrokenMatrix(assets, required) {
  const byPath = new Map(assets.map((a) => [a.path, a]));
  const rows = [];
  for (const p of required) {
    const hit = byPath.get(p);
    if (!hit) {
      rows.push({
        path: p,
        local: 'MISSING',
        failureClass: 'ASSET_404',
        note: 'required production artwork absent from public/',
      });
    } else if (hit.bytes === 0) {
      rows.push({ path: p, local: 'ZERO', failureClass: 'ASSET_ZERO_BYTES' });
    } else {
      rows.push({ path: p, local: 'PRESENT', failureClass: null, bytes: hit.bytes });
    }
  }
  return rows;
}

function iosAnimationMatrix() {
  return [
    {
      id: 'loadingAnimation',
      impl: 'VIDEO_MP4',
      source: 'UniLivesPrincessLoadingRefreshLayout + AppNativeVideo',
      asset: '/unilives-assets/brand/loading/princess-inapp-loading-locked.mp4',
      proofRequired: ['element', 'naturalSize', 'video.currentTime T0/T1'],
      status: 'PENDING_PHYSICAL',
    },
    {
      id: 'thoughtBubble',
      impl: 'CSS_KEYFRAMES',
      source: 'index.css thought-bubble-float',
      proofRequired: ['getAnimations playState', 'currentTime T0/T1'],
      status: 'PENDING_PHYSICAL',
    },
    {
      id: 'liveRing',
      impl: 'CSS_KEYFRAMES',
      source: 'index.css avatar-ring-spin',
      proofRequired: ['getAnimations', 'geometry nonzero'],
      status: 'PENDING_PHYSICAL',
    },
    {
      id: 'storyRing',
      impl: 'CSS_KEYFRAMES',
      source: 'index.css avatar-ring-halo',
      proofRequired: ['getAnimations', 'not clipped'],
      status: 'PENDING_PHYSICAL',
    },
    {
      id: 'giftCover',
      impl: 'STATIC_PNG',
      source: 'liveToolsV14Artwork /live-tools-v14/gifts/*',
      proofRequired: ['HTTP', 'decode', 'naturalWidth>0'],
      status: 'LOCAL_RESTORED_PENDING_DEPLOY',
    },
    {
      id: 'giftEffects',
      impl: 'CSS_MOTION_ON_IMAGE + LEGACY_SVGA',
      source: 'live-artwork-motion.css + /live-gifts/*.svga',
      proofRequired: ['animation currentTime', 'svga render'],
      status: 'PENDING_PHYSICAL',
    },
    {
      id: 'beautyPreviewCover',
      impl: 'STATIC_PNG',
      source: '/live-tools-v14/beauty/*.png',
      proofRequired: ['HTTP', 'decode'],
      status: 'LOCAL_RESTORED_PENDING_DEPLOY',
    },
    {
      id: 'stickerCover',
      impl: 'STATIC_PNG + CSS_MOTION',
      source: '/live-tools-v14/stickers/*',
      proofRequired: ['HTTP', 'decode', 'motion T0/T1'],
      status: 'LOCAL_RESTORED_PENDING_DEPLOY',
    },
  ];
}

function providerMatrix() {
  return {
    productArtworkSSOT: 'artifacts/instacollab/public (Vite public/) → deploy/spa-public',
    unilivesRegistry: 'artifacts/instacollab/src/lib/unilives-assets (getAssetUrl)',
    presentationUrlContract: 'artifacts/instacollab/src/lib/mediaUrlContract.ts',
    legacyGiftSvga: '/live-gifts/{mic,star,crown,rocket}.svga',
    v14CatalogArt: '/live-tools-v14/{gifts,stickers,beauty,voices,games}',
    approvedV12Covers: '/live-gifts/approved-v12/UG-*.png',
    loadingBrand: '/unilives-assets/brand/loading/*',
    userUploads: 'R2 via API media layer (canonical key preferred over signed URL)',
    competingAuthorities: 'FORBIDDEN — do not dual-write Firebase+R2 for same product art',
  };
}

fs.mkdirSync(OUT, { recursive: true });
const assets = inventoryPublicAssets();
const animations = inventoryAnimations();
const required = requiredProductionPaths();
const broken = buildBrokenMatrix(assets, required);
const brokenCount = broken.filter((r) => r.failureClass).length;

const assetInventory = {
  generatedAt: new Date().toISOString(),
  total: assets.length,
  byExt: Object.fromEntries(
    [...MEDIA_EXT].map((e) => [e, assets.filter((a) => a.ext === e).length]),
  ),
  assets,
};
const animInventory = {
  generatedAt: new Date().toISOString(),
  total: animations.length,
  animations,
};
const brokenMatrix = {
  generatedAt: new Date().toISOString(),
  required: required.length,
  brokenLocal: brokenCount,
  rows: broken,
};
const iosMatrix = {
  generatedAt: new Date().toISOString(),
  entries: iosAnimationMatrix(),
};
const providers = {
  generatedAt: new Date().toISOString(),
  ...providerMatrix(),
};
const status = {
  generatedAt: new Date().toISOString(),
  fullRealApplication: 'FAIL',
  iosVisualRuntime: 'FAIL',
  assetUrls: brokenCount === 0 ? 'LOCAL_PACKAGED' : 'FAIL',
  animations: 'FAIL_PENDING_PHYSICAL',
  rootCausesFixed: [
    'mediaUrlContract: root-relative paths no longer replaced by Unsplash fallback',
    'restored missing live-tools-v14 + approved-v12 packages into public/',
  ],
  stillRequired: [
    'build + sync deploy/spa-public',
    'push release branch / Render deploy',
    'physical iPhone progression proof',
  ],
  totals: {
    visualAssetsIndexed: assets.length,
    animationsIndexed: animations.length,
    requiredPaths: required.length,
    brokenLocal: brokenCount,
  },
};

for (const [name, data] of [
  ['FINAL-ASSET-INVENTORY.json', assetInventory],
  ['FINAL-ANIMATION-INVENTORY.json', animInventory],
  ['FINAL-BROKEN-URL-MATRIX.json', brokenMatrix],
  ['FINAL-IOS-ANIMATION-MATRIX.json', iosMatrix],
  ['FINAL-ASSET-PROVIDER-MATRIX.json', providers],
  ['FINAL-VISUAL-RUNTIME-STATUS.json', status],
]) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
}

console.log(
  JSON.stringify(
    {
      ok: true,
      out: OUT,
      visualAssetsIndexed: assets.length,
      animationsIndexed: animations.length,
      brokenLocal: brokenCount,
    },
    null,
    2,
  ),
);
