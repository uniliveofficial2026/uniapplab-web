/**
 * Canonical identity layers for UniLive’s.
 *
 * PERSON — application / Supabase auth user id (primary key for business state)
 * DEVICE — local device installation id (not a person)
 * APP_SESSION — signed-in browser/app session
 * RTC_PARTICIPANT_SESSION — LiveKit participant SID / connection (ephemeral)
 * ROOM_SESSION — party/live/call room session id
 *
 * Provider IDs are aliases/projections — never the person primary key.
 */

export type IdentityLayer =
  | 'PERSON'
  | 'DEVICE'
  | 'APP_SESSION'
  | 'RTC_PARTICIPANT_SESSION'
  | 'ROOM_SESSION';

export type CanonicalPersonId = string & { readonly __brand: 'CanonicalPersonId' };
export type DeviceId = string & { readonly __brand: 'DeviceId' };
export type AppSessionId = string & { readonly __brand: 'AppSessionId' };
export type RtcParticipantSessionId = string & { readonly __brand: 'RtcParticipantSessionId' };
export type RoomSessionId = string & { readonly __brand: 'RoomSessionId' };

export function asPersonId(id: string): CanonicalPersonId {
  return id.trim() as CanonicalPersonId;
}

/** LiveKit participant SID is a realtime session id — not PERSON. */
export function isLiveKitParticipantSid(value: string): boolean {
  return /^PA_[A-Za-z0-9]+$/.test(value.trim()) || /^[A-Za-z0-9]{12,}$/.test(value) && value.startsWith('PA_');
}

/** Hidden admin watcher identities are projections, not roster people. */
export function isHiddenWatcherIdentity(identity: string): boolean {
  return identity.trim().startsWith('aw_');
}

/**
 * Resolve business person id from an RTC participant identity.
 * Watcher aliases must not be treated as the signed-in person.
 */
export function personIdFromRtcIdentity(identity: string): string | null {
  const id = identity.trim();
  if (!id || isHiddenWatcherIdentity(id)) return null;
  if (isLiveKitParticipantSid(id)) return null;
  return id;
}

export type IdentityClearanceReason =
  | 'logout'
  | 'account_switch'
  | 'session_expired'
  | 'reinstall';

/**
 * Keys / stores that MUST be cleared on logout / account switch.
 * Expand carefully — do not clear unrelated device preferences.
 */
export const IDENTITY_SCOPED_STORAGE_PREFIXES = [
  'unilives.auth.',
  'unilives.session.',
  'unilives.wallet.',
  'ic.auth.',
  'ic.session.',
  'sb-',
  'unilive.push.person.',
] as const;
