import type { UserAppStateKey } from './collectionKeys';

export const CLOUD_APP_STATE_VERSION = 2 as const;
export const CLOUD_APP_STATE_VERSION_LEGACY = 1 as const;

/** v2 — AS-only settings blob; no CU/EP/financial collections. */
export type UserAppStateV2Payload = {
  v: typeof CLOUD_APP_STATE_VERSION;
  revision: number;
  /** Client ms timestamp — LWW for AS fields only */
  updatedAt: number;
  settings: Partial<Record<UserAppStateKey, unknown>>;
};

/** v1 legacy — whole-account collections snapshot (deprecated). */
export type CloudAppStatePayloadV1 = {
  v: typeof CLOUD_APP_STATE_VERSION_LEGACY;
  updatedAt: number;
  collections: Partial<Record<string, unknown>>;
};

export type CloudAppStatePayload = UserAppStateV2Payload | CloudAppStatePayloadV1;

export type CloudAppStateRow = {
  user_id: string;
  payload: CloudAppStatePayload;
  updated_at?: string;
};

export function isUserAppStateV2Payload(
  payload: CloudAppStatePayload | null | undefined,
): payload is UserAppStateV2Payload {
  return Boolean(payload && payload.v === CLOUD_APP_STATE_VERSION);
}

export function isLegacyAppStatePayload(
  payload: CloudAppStatePayload | null | undefined,
): payload is CloudAppStatePayloadV1 {
  return Boolean(payload && payload.v === CLOUD_APP_STATE_VERSION_LEGACY);
}
