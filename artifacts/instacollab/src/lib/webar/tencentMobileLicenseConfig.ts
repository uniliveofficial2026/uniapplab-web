/**
 * Tencent Effect / Beauty AR **native Mobile** license (iOS / Android SDK).
 *
 * These credentials are NOT used by `tencentcloud-webar` (Web&H5). Phone browsers
 * on app.uniapplab.com still use `VITE_TENCENT_WEBAR_*`. Native apps call
 * TELicenseCheck / XMagic setLicense(url, key) with the values below.
 *
 * Console: RT-Cube → License management → Mobile Licenses
 *   VITE_TENCENT_APP_ID=          (usually same account APPID as Web)
 *   VITE_TENCENT_LICENSE_URL=     (https://….sdk-license.com/…/v_cube.license)
 *   VITE_TENCENT_LICENSE_KEY=     (license key for that Mobile package)
 *   VITE_TENCENT_BUNDLE_ID=       (iOS bundle id / Android package name)
 *
 * @see https://www.tencentcloud.com/document/product/1143/50806
 */

import { readIntegrationEnv } from '../integrationEnv';

export function getTencentEffectMobileAppId(): string {
  return readIntegrationEnv('VITE_TENCENT_APP_ID') || readIntegrationEnv('VITE_TENCENT_WEBAR_APP_ID');
}

export function getTencentEffectMobileLicenseUrl(): string {
  return readIntegrationEnv('VITE_TENCENT_LICENSE_URL');
}

export function getTencentEffectMobileLicenseKey(): string {
  return readIntegrationEnv('VITE_TENCENT_LICENSE_KEY');
}

export function getTencentEffectMobileBundleId(): string {
  return readIntegrationEnv('VITE_TENCENT_BUNDLE_ID');
}

/** True when native Mobile license fields are present (for future iOS/Android / Capacitor). */
export function isTencentEffectMobileLicenseConfigured(): boolean {
  return Boolean(
    getTencentEffectMobileAppId() &&
      getTencentEffectMobileLicenseUrl() &&
      getTencentEffectMobileLicenseKey(),
  );
}

/** Snapshot for native bridges / admin — never log the full key in production UI. */
export function getTencentEffectMobileLicenseSnapshot(): {
  configured: boolean;
  appId: string;
  bundleId: string;
  licenseUrl: string;
  hasLicenseKey: boolean;
} {
  const licenseKey = getTencentEffectMobileLicenseKey();
  return {
    configured: isTencentEffectMobileLicenseConfigured(),
    appId: getTencentEffectMobileAppId(),
    bundleId: getTencentEffectMobileBundleId(),
    licenseUrl: getTencentEffectMobileLicenseUrl(),
    hasLicenseKey: Boolean(licenseKey),
  };
}
