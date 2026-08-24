import { isUserAppStateKey, USER_APP_STATE_KEYS } from './collectionKeys';
import {
  CLOUD_APP_STATE_VERSION,
  type CloudAppStatePayload,
  type CloudAppStatePayloadV1,
  type UserAppStateV2Payload,
  isLegacyAppStatePayload,
  isUserAppStateV2Payload,
} from './types';

/** Extract only AS-allowed fields from a legacy v1 collections bag. */
export function extractAllowedSettings(
  collections: Partial<Record<string, unknown>> | null | undefined,
): Partial<Record<(typeof USER_APP_STATE_KEYS)[number], unknown>> {
  const settings: Partial<Record<(typeof USER_APP_STATE_KEYS)[number], unknown>> = {};
  if (!collections || typeof collections !== 'object') return settings;
  for (const [key, value] of Object.entries(collections)) {
    if (isUserAppStateKey(key) && value !== undefined) {
      settings[key] = value;
    }
  }
  return settings;
}

/** Normalize any stored payload to v2 AS-only settings (ignores forbidden CU/EP keys). */
export function normalizeToUserAppStateV2(
  raw: CloudAppStatePayload | null | undefined,
): UserAppStateV2Payload | null {
  if (!raw || typeof raw !== 'object') return null;

  if (isUserAppStateV2Payload(raw)) {
    return {
      v: CLOUD_APP_STATE_VERSION,
      revision: typeof raw.revision === 'number' ? raw.revision : raw.updatedAt,
      updatedAt: raw.updatedAt,
      settings: extractAllowedSettings(raw.settings),
    };
  }

  if (isLegacyAppStatePayload(raw)) {
    return {
      v: CLOUD_APP_STATE_VERSION,
      revision: raw.updatedAt,
      updatedAt: raw.updatedAt,
      settings: extractAllowedSettings(raw.collections),
    };
  }

  return null;
}

export function buildUserAppStateV2FromLocal(
  settings: Partial<Record<(typeof USER_APP_STATE_KEYS)[number], unknown>>,
  revision: number,
): UserAppStateV2Payload {
  const updatedAt = Date.now();
  return {
    v: CLOUD_APP_STATE_VERSION,
    revision: Math.max(revision, updatedAt),
    updatedAt,
    settings: extractAllowedSettings(settings),
  };
}

/** @deprecated v1 shape for one-time read paths */
export type LegacyCollectionsPayload = CloudAppStatePayloadV1;
