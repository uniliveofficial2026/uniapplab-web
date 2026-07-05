/**
 * Tencent Cloud WebAR (beauty / AR) credentials.
 * Set in `.env` (repo root or artifacts/instacollab):
 *   VITE_TENCENT_WEBAR_APP_ID=
 *   VITE_TENCENT_WEBAR_LICENSE_KEY=
 *   VITE_TENCENT_WEBAR_TOKEN=
 *
 * Token is used client-side for local/dev only (matches quick-start demo).
 * For production, move signature generation to the API server.
 */

export function getTencentWebARAppId(): string {
  return String(import.meta.env.VITE_TENCENT_WEBAR_APP_ID ?? '').trim();
}

export function getTencentWebARLicenseKey(): string {
  return String(import.meta.env.VITE_TENCENT_WEBAR_LICENSE_KEY ?? '').trim();
}

export function getTencentWebARToken(): string {
  return String(import.meta.env.VITE_TENCENT_WEBAR_TOKEN ?? '').trim();
}

export function isTencentWebARConfigured(): boolean {
  return Boolean(
    getTencentWebARAppId() &&
      getTencentWebARLicenseKey() &&
      getTencentWebARToken(),
  );
}
