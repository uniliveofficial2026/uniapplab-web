export function createRtcGrant(input: {
  canonicalUserId: string;
  roomId: string;
  role: import('@unilives/rtc-contracts').RtcRole;
  roomSessionId?: string;
  ttlSec?: number;
}): import('@unilives/rtc-contracts').RtcGrant;

export function mintProviderTokenFromGrant(
  grant: import('@unilives/rtc-contracts').RtcGrant,
  opts?: { roomName?: string; name?: string },
): Promise<{ provider: string; token: string; grant: import('@unilives/rtc-contracts').RtcGrant }>;

export function normalizeProviderWebhook(input: {
  provider: string;
  providerEventId: string;
  type: string;
  roomId?: string;
  participantIdentity?: string;
  occurredAt?: string;
}): any;
