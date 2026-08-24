/**
 * Typed presentation actions. Components emit IDs; domain services execute commands.
 * Manifests may enable an action slot — they cannot grant permission.
 */

export const ACTION_IDS = [
  'navigation.open',
  'profile.follow',
  'profile.block',
  'profile.open',
  'chat.openThread',
  'chat.sendMessage',
  'live.join',
  'live.leave',
  'live.close',
  'seat.request',
  'seat.accept',
  'seat.leave',
  'pk.invite',
  'pk.accept',
  'gift.send',
  'wallet.purchase',
  'notification.markRead',
  'auth.login.submit',
  'auth.signup.submit',
  'call.accept',
  'call.reject',
  'call.end',
  'call.toggleMic',
  'call.toggleCamera',
  'call.switchCamera',
  'call.toggleSpeaker',
  'call.invite',
  'call.minimize',
  'call.retry',
  'call.shareScreen',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export type ActionDefinition = {
  id: ActionId;
  domain:
    | 'navigation'
    | 'profile'
    | 'chat'
    | 'live'
    | 'seats'
    | 'pk'
    | 'gifts'
    | 'wallet'
    | 'notifications'
    | 'auth'
    | 'call';
  paramsSchema: Record<string, 'string' | 'number' | 'boolean'>;
};

export const ACTION_REGISTRY: Record<ActionId, ActionDefinition> = {
  'navigation.open': { id: 'navigation.open', domain: 'navigation', paramsSchema: { tab: 'string' } },
  'profile.follow': { id: 'profile.follow', domain: 'profile', paramsSchema: { userId: 'string' } },
  'profile.block': { id: 'profile.block', domain: 'profile', paramsSchema: { userId: 'string' } },
  'profile.open': { id: 'profile.open', domain: 'profile', paramsSchema: { userId: 'string' } },
  'chat.openThread': { id: 'chat.openThread', domain: 'chat', paramsSchema: { threadId: 'string' } },
  'chat.sendMessage': { id: 'chat.sendMessage', domain: 'chat', paramsSchema: { threadId: 'string', clientId: 'string' } },
  'live.join': { id: 'live.join', domain: 'live', paramsSchema: { roomId: 'string' } },
  'live.leave': { id: 'live.leave', domain: 'live', paramsSchema: { roomId: 'string' } },
  'live.close': { id: 'live.close', domain: 'live', paramsSchema: { roomId: 'string' } },
  'seat.request': { id: 'seat.request', domain: 'seats', paramsSchema: { roomId: 'string', seatIndex: 'number' } },
  'seat.accept': { id: 'seat.accept', domain: 'seats', paramsSchema: { roomId: 'string', seatIndex: 'number' } },
  'seat.leave': { id: 'seat.leave', domain: 'seats', paramsSchema: { roomId: 'string', seatIndex: 'number' } },
  'pk.invite': { id: 'pk.invite', domain: 'pk', paramsSchema: { roomId: 'string', targetUserId: 'string' } },
  'pk.accept': { id: 'pk.accept', domain: 'pk', paramsSchema: { sessionId: 'string' } },
  'gift.send': { id: 'gift.send', domain: 'gifts', paramsSchema: { giftId: 'string', receiverId: 'string', clientRequestId: 'string' } },
  'wallet.purchase': { id: 'wallet.purchase', domain: 'wallet', paramsSchema: { packageId: 'string' } },
  'notification.markRead': { id: 'notification.markRead', domain: 'notifications', paramsSchema: { notificationId: 'string' } },
  'auth.login.submit': { id: 'auth.login.submit', domain: 'auth', paramsSchema: {} },
  'auth.signup.submit': { id: 'auth.signup.submit', domain: 'auth', paramsSchema: {} },
  'call.accept': { id: 'call.accept', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.reject': { id: 'call.reject', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.end': { id: 'call.end', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.toggleMic': { id: 'call.toggleMic', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.toggleCamera': { id: 'call.toggleCamera', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.switchCamera': { id: 'call.switchCamera', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.toggleSpeaker': { id: 'call.toggleSpeaker', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.invite': { id: 'call.invite', domain: 'call', paramsSchema: { callId: 'string', userId: 'string' } },
  'call.minimize': { id: 'call.minimize', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.retry': { id: 'call.retry', domain: 'call', paramsSchema: { callId: 'string' } },
  'call.shareScreen': { id: 'call.shareScreen', domain: 'call', paramsSchema: { callId: 'string' } },
};

export function isActionId(value: string): value is ActionId {
  return value in ACTION_REGISTRY;
}

export function validateActionParams(id: ActionId, params: Record<string, unknown>): string[] {
  const schema = ACTION_REGISTRY[id].paramsSchema;
  const errors: string[] = [];
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in params)) errors.push(`missing:${key}`);
    else if (typeof params[key] !== type) errors.push(`type:${key}`);
  }
  return errors;
}
