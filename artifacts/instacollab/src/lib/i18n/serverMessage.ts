import type { TranslationParams, TranslatableMessage } from './types';

const CODE_ALIASES: Record<string, string> = {
  insufficient: 'error.insufficient',
  insufficient_balance: 'wallet.insufficientBalance',
  gift_insufficient: 'gift.insufficientCoins',
  'gift not available': 'error.giftNotAvailable',
  gift_not_available: 'error.giftNotAvailable',
  unknown_gift: 'gift.unknown',
  unauthorized: 'error.unauthorized',
  forbidden: 'error.forbidden',
  not_found: 'error.notFound',
  conflict: 'error.conflict',
  rate_limited: 'error.rateLimited',
  invalid_token: 'error.invalidToken',
  muted: 'error.muted',
  not_thread_member: 'error.notThreadMember',
  seat_occupied: 'error.seatOccupied',
  host_required: 'error.hostRequired',
  stream_not_live: 'error.streamNotLive',
  party_room_ended: 'error.partyRoomEnded',
  client_user_id_impersonation_rejected: 'error.impersonation',
  Missing_bearer_token: 'error.unauthorized',
  'Invalid token': 'error.invalidToken',
  'Too many requests': 'error.rateLimited',
  'Not found': 'error.notFound',
  'Internal server error': 'error.server',
  Account_banned: 'moderation.banned',
};

export type ServerErrorBody = {
  code?: string;
  params?: TranslationParams;
  error?: string;
  message?: string;
};

export function serverBodyToMessage(body: ServerErrorBody | null | undefined): TranslatableMessage {
  const code = String(body?.code || body?.error || '').trim();
  const aliased = CODE_ALIASES[code] || CODE_ALIASES[code.replace(/\s+/g, '_')] || (code.includes('.') ? code : '');
  if (aliased) {
    return { translationKey: aliased, params: body?.params };
  }
  return { translationKey: 'common.unknownError' };
}

export function isTranslatableMessage(value: unknown): value is TranslatableMessage {
  return Boolean(value && typeof value === 'object' && typeof (value as TranslatableMessage).translationKey === 'string');
}
