/**
 * Tencent Cloud Beauty AR Web&H5 credentials (desktop + mobile browsers).
 * Set in `.env` (repo root or artifacts/instacollab):
 *   VITE_TENCENT_WEBAR_APP_ID=
 *   VITE_TENCENT_WEBAR_LICENSE_KEY=
 *   VITE_TENCENT_WEBAR_TOKEN=
 *
 * Use a **Web** license (RT-Cube → Web Licenses), bound to your site domain
 * (e.g. app.uniapplab.com). That same license unlocks phones (Safari/Chrome)
 * on that domain — no separate Mobile license for H5. localhost is always allowed;
 * 127.0.0.1 is NOT treated as localhost by the license check.
 * Native iOS/Android apps need a different Mobile license + native SDK.
 *
 * Token is used client-side for local/dev only (matches quick-start demo).
 * For production, move signature generation to the API server.
 *
 * Native iOS/Android: see `tencentMobileLicenseConfig.ts` (`VITE_TENCENT_LICENSE_URL` / `VITE_TENCENT_LICENSE_KEY`).
 *
 * @see https://www.tencentcloud.com/document/product/1143/50099 (license + signature)
 * @see https://www.tencentcloud.com/document/product/1143/54277 (bind / renew Web license domain)
 * @see https://www.tencentcloud.com/document/product/1143/51233 (FAQ: project does not exist)
 */

import { readIntegrationEnv } from '../integrationEnv';
import { isBeautyRuntimeSupported } from '../platform/runtime';

/** Console where Web License domains are bound. */
export const TENCENT_WEBAR_LICENSE_CONSOLE =
  'https://console.tencentcloud.com/x-rtc/effect/web-license';

/** Production hostname that must match the Web License “Domain” field. */
export const TENCENT_WEBAR_PRODUCTION_HOST = 'app.uniapplab.com';

/**
 * Tencent WebAR allows `localhost` without binding it on the license.
 * Loopback IPs (`127.0.0.1`, `[::1]`) are a different host and fail domain checks.
 * Redirect once so local beauty works without editing the license.
 */
export function ensureTencentWebARAllowedHostname(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, protocol, port, pathname, search, hash } = window.location;
  if (hostname !== '127.0.0.1' && hostname !== '[::1]') return false;
  const portPart = port ? `:${port}` : '';
  const next = `${protocol}//localhost${portPart}${pathname}${search}${hash}`;
  window.location.replace(next);
  return true;
}

/** Current page host for license-domain error messages. */
export function getTencentWebARPageHostname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
}

export function getTencentWebARAppId(): string {
  return readIntegrationEnv('VITE_TENCENT_WEBAR_APP_ID');
}

export function getTencentWebARLicenseKey(): string {
  return readIntegrationEnv('VITE_TENCENT_WEBAR_LICENSE_KEY');
}

export function getTencentWebARToken(): string {
  return readIntegrationEnv('VITE_TENCENT_WEBAR_TOKEN');
}

export function isTencentWebARConfigured(): boolean {
  return Boolean(
    getTencentWebARAppId() &&
      getTencentWebARLicenseKey() &&
      getTencentWebARToken(),
  );
}

/**
 * True when credentials exist AND this browser can run WebAR (secure + WebGL).
 * Prefer this over `isTencentWebARConfigured` for starting GPU pipelines.
 */
export function isTencentWebARRunnable(): boolean {
  return isTencentWebARConfigured() && isBeautyRuntimeSupported();
}

/** Host-facing copy when WebAR license/domain is not usable. */
export const TENCENT_WEBAR_COMING_SOON = 'Coming soon...';

/**
 * True when the beauty engine cannot run because credentials are missing
 * or Tencent rejected the Web license / domain / signature.
 */
export function isTencentWebARLicenseUnavailable(error?: string | null): boolean {
  if (!isTencentWebARConfigured()) return true;
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('domain mismatch') ||
    lower.includes('web license') ||
    lower.includes('license key') ||
    lower.includes('license project') ||
    lower.includes('project does not exist') ||
    lower.includes('referer') ||
    lower.includes('signature') ||
    /\b2007\b/.test(lower) ||
    /\b104\b/.test(lower) ||
    lower.includes('failed to initialize') ||
    (lower.includes('license') && (lower.includes('not found') || lower.includes('does not exist') || lower.includes('expired')))
  );
}

/**
 * Map Tencent Beauty AR auth / business errors to actionable text.
 * Code 2007 ("The project does not exist.") means the license record is missing,
 * expired, or the License Key / Token / AppId do not belong together — not a
 * camera or SDK load failure.
 */
export function explainTencentWebARAuthError(raw: unknown): string {
  const message =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && 'message' in raw
        ? String((raw as { message?: unknown }).message ?? '')
        : '';
  const code =
    raw && typeof raw === 'object' && 'code' in raw
      ? Number((raw as { code?: unknown }).code)
      : NaN;
  const lower = message.toLowerCase();

  if (
    code === 2007 ||
    lower.includes('project does not exist') ||
    (lower.includes('license') && lower.includes('does not exist'))
  ) {
    return (
      'Tencent WebAR license project not found (API 2007). ' +
      'In RT-Cube → License management → Web Licenses (Web&H5, not Mobile): ' +
      'renew or recreate the license, bind domain app.uniapplab.com ' +
      '(covers desktop + phone browsers), confirm App ID is the account APPID, ' +
      'and ensure License Key / Token are not swapped. Trial licenses expire after 14 days (max 28).'
    );
  }

  if (code === 104 || lower.includes('referer') || lower.includes('domain')) {
    const host = getTencentWebARPageHostname();
    if (host === '127.0.0.1' || host === '[::1]') {
      return (
        'Tencent WebAR domain mismatch: open the app at http://localhost ' +
        '(not 127.0.0.1). localhost is always allowed on Web Licenses. ' +
        'Your License Key/Token can be correct and still fail on the wrong hostname.'
      );
    }
    const boundHint = host
      ? `Bind “${host}”`
      : `Bind “${TENCENT_WEBAR_PRODUCTION_HOST}”`;
    return (
      `Tencent WebAR domain mismatch (not a bad License Key). ${boundHint} on the ` +
      `Web License Domain in RT-Cube → License management → Web Licenses. ` +
      `Key/Token authenticate the project; Domain is a separate allowlist. ` +
      `localhost is always allowed; official license domains cannot change after create. ` +
      TENCENT_WEBAR_LICENSE_CONSOLE
    );
  }

  if (code === 101 || lower.includes('signature timeout') || lower.includes('signature')) {
    return (
      'Tencent WebAR signature rejected. Check VITE_TENCENT_WEBAR_TOKEN + App ID, ' +
      'and that the device clock is accurate (signatures expire in 5 minutes).'
    );
  }

  if (message.trim()) return message;
  return 'Tencent WebAR failed to initialize';
}
