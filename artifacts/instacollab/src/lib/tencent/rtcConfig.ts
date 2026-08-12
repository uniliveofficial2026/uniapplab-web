/**
 * Tencent RTC suite credentials — **optional backup for a future migration**.
 *
 * Call / Conference / Live / Chat / RTC Engine SDKAppID + server UserSig are stored
 * and health-checkable, but this app’s A/V transport remains **LiveKit**. Do not
 * switch Call/Live/Chat surfaces to Tencent RTC unless product explicitly opts in.
 *
 * UserSig: `POST /api/tencent/rtc/usersig` (server-only secret).
 * Never put TENCENT_RTC_SECRET_KEY in VITE_* env.
 */

import { readIntegrationEnv } from '../integrationEnv';
import { apiFetch } from '../platformApi';

export const TENCENT_RTC_PRODUCTS = [
  'call',
  'conference',
  'live',
  'chat',
  'rtc_engine',
] as const;

export type TencentRtcProduct = (typeof TENCENT_RTC_PRODUCTS)[number];

/** Standby flag — credentials may exist without enabling Tencent A/V. */
export const TENCENT_RTC_TRANSPORT_ENABLED =
  String(import.meta.env.VITE_TENCENT_RTC_TRANSPORT || '').trim().toLowerCase() ===
  'true';

export function getTencentRtcSdkAppId(): string {
  return readIntegrationEnv('VITE_TENCENT_RTC_SDK_APP_ID');
}

/** True when the public SDKAppID is present (UserSig still needs server secret). */
export function isTencentRtcSdkAppIdConfigured(): boolean {
  return Boolean(getTencentRtcSdkAppId());
}

/**
 * Whether product surfaces should use Tencent RTC instead of LiveKit.
 * Always false unless `VITE_TENCENT_RTC_TRANSPORT=true` is set later.
 */
export function isTencentRtcTransportEnabled(): boolean {
  return TENCENT_RTC_TRANSPORT_ENABLED && isTencentRtcSdkAppIdConfigured();
}

export type TencentRtcUserSigResponse = {
  sdkAppId: number;
  userId: string;
  userSig: string;
  expireSeconds: number;
  products: TencentRtcProduct[];
};

export async function fetchTencentRtcUserSig(options?: {
  expireSeconds?: number;
}): Promise<TencentRtcUserSigResponse> {
  return apiFetch('/api/tencent/rtc/usersig', {
    method: 'POST',
    body: JSON.stringify({
      expireSeconds: options?.expireSeconds,
    }),
  });
}

export async function fetchTencentRtcHealth(): Promise<{
  ok: boolean;
  configured: boolean;
  sdkAppId: string | null;
  products: TencentRtcProduct[];
}> {
  return apiFetch('/api/tencent/rtc/health');
}
