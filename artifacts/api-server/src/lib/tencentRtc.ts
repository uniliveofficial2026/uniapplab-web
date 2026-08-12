/**
 * Tencent RTC suite credentials (Call / Conference / Live / Chat / RTC Engine).
 * SDKAppID may be public; SecretKey must stay on the server for UserSig.
 *
 * UserSig = TLSSigAPIv2 (HMAC-SHA256 + zlib + base64url) — implemented inline
 * so the api-server esbuild bundle does not depend on the CJS tls-sig-api-v2 package.
 */
import { createHmac } from "node:crypto";
import { deflateSync } from "node:zlib";

const DEFAULT_EXPIRE_SECONDS = 60 * 60 * 24; // 24h

export function getTencentRtcSdkAppId(): string {
  return String(
    process.env.VITE_TENCENT_RTC_SDK_APP_ID ||
      process.env.TENCENT_RTC_SDK_APP_ID ||
      "",
  ).trim();
}

export function getTencentRtcSecretKey(): string {
  return String(
    process.env.TENCENT_RTC_SECRET_KEY ||
      // Legacy mistake — never ship with VITE_ secret in production.
      process.env.VITE_TENCENT_SECRET_KEY ||
      "",
  ).trim();
}

export function isTencentRtcConfigured(): boolean {
  return Boolean(getTencentRtcSdkAppId() && getTencentRtcSecretKey());
}

function base64UrlEscape(value: string): string {
  return value.replace(/\+/g, "*").replace(/\//g, "-").replace(/=/g, "_");
}

function hmacSha256Base64(
  secretKey: string,
  identifier: string,
  sdkAppId: number,
  currTime: number,
  expire: number,
): string {
  const content =
    `TLS.identifier:${identifier}\n` +
    `TLS.sdkappid:${sdkAppId}\n` +
    `TLS.time:${currTime}\n` +
    `TLS.expire:${expire}\n`;
  return createHmac("sha256", secretKey).update(content).digest("base64");
}

/** TLSSigAPIv2 UserSig for TRTC / IM / Call / Live / Conference. */
export function genTencentRtcUserSig(
  sdkAppId: number,
  secretKey: string,
  userId: string,
  expireSeconds: number,
): string {
  const currTime = Math.floor(Date.now() / 1000);
  const sigDoc = {
    "TLS.ver": "2.0",
    "TLS.identifier": String(userId),
    "TLS.sdkappid": Number(sdkAppId),
    "TLS.time": Number(currTime),
    "TLS.expire": Number(expireSeconds),
    "TLS.sig": hmacSha256Base64(secretKey, userId, sdkAppId, currTime, expireSeconds),
  };
  const compressed = deflateSync(Buffer.from(JSON.stringify(sigDoc), "utf8")).toString(
    "base64",
  );
  return base64UrlEscape(compressed);
}

export type TencentRtcUserSigResult = {
  sdkAppId: number;
  userId: string;
  userSig: string;
  expireSeconds: number;
};

export function createTencentRtcUserSig(
  userId: string,
  expireSeconds = DEFAULT_EXPIRE_SECONDS,
): TencentRtcUserSigResult {
  const sdkAppIdRaw = getTencentRtcSdkAppId();
  const secretKey = getTencentRtcSecretKey();
  if (!sdkAppIdRaw || !secretKey) {
    throw new Error("tencent_rtc_not_configured");
  }
  const sdkAppId = Number(sdkAppIdRaw);
  if (!Number.isFinite(sdkAppId) || sdkAppId <= 0) {
    throw new Error("tencent_rtc_invalid_sdk_app_id");
  }
  const trimmedUserId = String(userId || "").trim();
  if (!trimmedUserId) {
    throw new Error("tencent_rtc_user_id_required");
  }
  const expire = Math.max(60, Math.min(expireSeconds, 60 * 60 * 24 * 7));
  const userSig = genTencentRtcUserSig(sdkAppId, secretKey, trimmedUserId, expire);
  return { sdkAppId, userId: trimmedUserId, userSig, expireSeconds: expire };
}
