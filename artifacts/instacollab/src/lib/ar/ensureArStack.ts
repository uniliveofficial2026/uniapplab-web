/**
 * Load DeepAR + TRTC asset packages on demand (camera / live / karaoke),
 * not on every app boot.
 */
let scheduled = false;

export function ensureArStackLoaded(): void {
  if (typeof window === 'undefined' || scheduled) return;
  scheduled = true;
  void import('./arAssetBootstrap').then((m) => m.bootstrapArAssets());
}
