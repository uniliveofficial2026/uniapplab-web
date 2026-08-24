/**
 * Allowed LiveKit import sites for Stage B CI.
 * Feature/UI/orchestrator code MUST NOT import livekit-client or livekit-server-sdk
 * outside this allowlist.
 */
export const LIVEKIT_CLIENT_IMPORT_ALLOWLIST = [
  'lib/unilives-rtc-livekit/',
  'artifacts/instacollab/src/lib/rtc/livekitCompatibilityBoundary.ts',
];

export const LIVEKIT_SERVER_IMPORT_ALLOWLIST = [
  'lib/unilives-rtc-livekit/',
  'lib/unilives-rtc-server/',
  'lib/livekit/',
  'artifacts/api-server/src/routes/livekit.ts',
  'artifacts/api-server/src/lib/livekit.ts',
  'artifacts/api-server/src/domain/live-lifecycle/',
  'supabase/functions/livekit/',
];
