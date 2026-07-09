/**
 * First-app-install AR asset warm: TRTC/WebAR always; DeepAR only when enabled.
 * Runs once for each new user/device after paint; later launches use Cache API + local markers.
 */

import { DEEPAR_ENABLED } from '../deepar/deeparEnabled';

const MARKER_KEY = 'ic_ar_assets_ready_v2';
const CACHE_NAME = 'ic-ar-assets-v2';

/** Core SDK + beauty plugin + TRTC manifest (DeepAR URLs skipped when disabled). */
const DEEPAR_CORE_URLS = [
  '/deepar-resources/wasm/deepar.wasm',
  '/deepar-resources/js/deepar.esm.js',
  '/deepar-resources/js/dynamicModules/xzimg.js',
  '/deepar-resources/js/dynamicModules/mediaPipe.js',
  '/deepar-beauty/beauty-deepar.esm.js',
  '/deepar-beauty/assets/effects/baseBeautyBlur.deepar',
  '/deepar-beauty/assets/effects/lut.deepar',
  '/deepar-beauty/assets/effects/segmentation_initialize.deepar',
  '/effects/ray-ban-wayfarer.deepar',
  '/effects/MakeupLook.deepar',
];

const TRTC_CORE_URLS = ['/trtc-webar/manifest.json'];

/** Beauty pre-look zips (full DeepAR beauty package). */
const BEAUTY_PRESET_URLS = [
  'cute',
  'after-dark',
  'night-out',
  'kim-classic',
  'caramel-kiss',
  'spring-petals',
  'midnight-stunner',
  'happy-tears',
  'starry-night-seduction',
  'lash-delight',
  'black-hearts',
  'cateye-maple',
  'gelid-breeze',
  'twilight-hues',
  'misty-enchantment',
  'skyline-glamour-stripes',
  'light-touchup-fair-skin',
  'rosy',
  'glowing',
  'light-blush',
  'gelid',
].map((name) => `/effects/beauty-presets/${name}.zip`);

function alreadyReady(): boolean {
  try {
    return localStorage.getItem(MARKER_KEY) === '1';
  } catch {
    return false;
  }
}

function markReady(): void {
  try {
    localStorage.setItem(MARKER_KEY, '1');
    localStorage.setItem(`${MARKER_KEY}_at`, new Date().toISOString());
  } catch {
    /* private mode */
  }
}

async function putInCache(urls: string[]): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(CACHE_NAME);
  // Limit concurrency so first launch stays responsive.
  const queue = [...urls];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) return;
      try {
        const existing = await cache.match(url);
        if (existing) continue;
        const res = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
        if (res.ok) await cache.put(url, res.clone());
      } catch {
        /* optional asset */
      }
    }
  });
  await Promise.all(workers);
}

async function warmPackages(): Promise<void> {
  const jobs: Array<Promise<unknown>> = [import('tencentcloud-webar').catch(() => null)];
  if (DEEPAR_ENABLED) {
    jobs.push(import('deepar').catch(() => null));
  }
  await Promise.all(jobs);
}

async function collectTrtcBackgrounds(): Promise<string[]> {
  try {
    const res = await fetch('/trtc-webar/manifest.json', { credentials: 'same-origin' });
    if (!res.ok) return [];
    const json = (await res.json()) as { backgrounds?: string[] };
    return Array.isArray(json.backgrounds) ? json.backgrounds.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Call after first paint. Safe to invoke multiple times — no-ops after first success.
 * New users get full DeepAR + TRTC packages cached locally on first session.
 */
export function bootstrapArAssets(): void {
  if (typeof window === 'undefined') return;
  if (alreadyReady()) {
    void warmPackages();
    return;
  }

  const run = async () => {
    const backgrounds = await collectTrtcBackgrounds();
    const coreUrls = [
      ...(DEEPAR_ENABLED ? DEEPAR_CORE_URLS : []),
      ...TRTC_CORE_URLS,
      ...(DEEPAR_ENABLED ? BEAUTY_PRESET_URLS : []),
      ...backgrounds,
    ];
    await putInCache(coreUrls);
    await warmPackages();
    markReady();
  };

  const schedule =
    typeof requestIdleCallback === 'function'
      ? (cb: () => void) => requestIdleCallback(() => cb(), { timeout: 3_000 })
      : (cb: () => void) => window.setTimeout(cb, 800);

  schedule(() => {
    void run();
  });
}

export function isArAssetsReady(): boolean {
  return alreadyReady();
}

/** Force a full re-warm (e.g. after settings repair). */
export function resetArAssetsCache(): void {
  try {
    localStorage.removeItem(MARKER_KEY);
    localStorage.removeItem(`${MARKER_KEY}_at`);
  } catch {
    /* ignore */
  }
  void caches.delete(CACHE_NAME).catch(() => undefined);
}
