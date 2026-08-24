/**
 * Stable view-model bindings. Manifests may not use arbitrary JSONPath.
 */

export const BINDING_IDS = [
  'profile.header',
  'profile.actions',
  'chat.threadList',
  'chat.activeThread',
  'live.header',
  'live.seats',
  'live.pk',
  'live.giftPanel',
  'wallet.summary',
  'wallet.packages',
  'notifications.list',
  'settings.form',
  'auth.login.email',
  'auth.login.password',
  'auth.login.form-state',
  'chat.composer.text',
  'call.active.participants',
  'call.active.duration',
  'call.incoming.caller',
  'live.viewer-count',
  'wallet.balance',
  'gift.selected',
] as const;

export type BindingId = (typeof BINDING_IDS)[number];

export type BindingDefinition = {
  id: BindingId;
  domain: string;
  viewModelType: string;
  allowedComponentIds: string[];
  privacy: 'public' | 'same-user' | 'thread-member' | 'room-member';
};

export const BINDING_REGISTRY: Record<BindingId, BindingDefinition> = {
  'profile.header': {
    id: 'profile.header',
    domain: 'profile',
    viewModelType: 'ProfileHeaderViewModel',
    allowedComponentIds: ['profile.header.v1', 'profile.card.v1', 'profile.screen.v1'],
    privacy: 'public',
  },
  'profile.actions': {
    id: 'profile.actions',
    domain: 'profile',
    viewModelType: 'ProfileHeaderViewModel',
    allowedComponentIds: ['profile.header.v1', 'profile.card.v1'],
    privacy: 'same-user',
  },
  'chat.threadList': {
    id: 'chat.threadList',
    domain: 'chat',
    viewModelType: 'ChatInboxViewModel',
    allowedComponentIds: ['chat.thread-row.v1', 'chat.inbox.v1'],
    privacy: 'same-user',
  },
  'chat.activeThread': {
    id: 'chat.activeThread',
    domain: 'chat',
    viewModelType: 'ChatInboxViewModel',
    allowedComponentIds: ['chat.message-bubble.v1', 'chat.inbox.v1'],
    privacy: 'thread-member',
  },
  'live.header': {
    id: 'live.header',
    domain: 'live',
    viewModelType: 'LiveRoomViewModel',
    allowedComponentIds: ['live.room-header.v1', 'live.viewer-counter.v1', 'live.screen.v1'],
    privacy: 'room-member',
  },
  'live.seats': {
    id: 'live.seats',
    domain: 'seats',
    viewModelType: 'LiveRoomViewModel',
    allowedComponentIds: ['live.audio-seat.v1', 'live.video-seat.v1', 'live.screen.v1'],
    privacy: 'room-member',
  },
  'live.pk': {
    id: 'live.pk',
    domain: 'pk',
    viewModelType: 'PkViewModel',
    allowedComponentIds: ['live.pk-scoreboard.v1', 'live.screen.v1'],
    privacy: 'room-member',
  },
  'live.giftPanel': {
    id: 'live.giftPanel',
    domain: 'gifts',
    viewModelType: 'GiftPanelViewModel',
    allowedComponentIds: ['live.gift-panel.v1', 'live.screen.v1'],
    privacy: 'room-member',
  },
  'wallet.summary': {
    id: 'wallet.summary',
    domain: 'wallet',
    viewModelType: 'WalletSummaryViewModel',
    allowedComponentIds: ['wallet.balance-card.v1', 'wallet.balance-card.compact', 'wallet.screen.v1'],
    privacy: 'same-user',
  },
  'wallet.packages': {
    id: 'wallet.packages',
    domain: 'wallet',
    viewModelType: 'WalletSummaryViewModel',
    allowedComponentIds: ['wallet.coin-package.v1', 'wallet.screen.v1'],
    privacy: 'same-user',
  },
  'notifications.list': {
    id: 'notifications.list',
    domain: 'notifications',
    viewModelType: 'NotificationRowViewModel[]',
    allowedComponentIds: ['notifications.list.v1'],
    privacy: 'same-user',
  },
  'settings.form': {
    id: 'settings.form',
    domain: 'settings',
    viewModelType: 'SettingsViewModel',
    allowedComponentIds: ['settings.screen.v1'],
    privacy: 'same-user',
  },
  'auth.login.email': {
    id: 'auth.login.email',
    domain: 'auth',
    viewModelType: 'AuthLoginViewModel',
    allowedComponentIds: ['primitive.input.v1', 'auth.login.v1'],
    privacy: 'same-user',
  },
  'auth.login.password': {
    id: 'auth.login.password',
    domain: 'auth',
    viewModelType: 'AuthLoginViewModel',
    allowedComponentIds: ['primitive.input.v1', 'auth.login.v1'],
    privacy: 'same-user',
  },
  'auth.login.form-state': {
    id: 'auth.login.form-state',
    domain: 'auth',
    viewModelType: 'AuthLoginViewModel',
    allowedComponentIds: ['auth.login.v1', 'auth.signup.v1', 'primitive.button.v1'],
    privacy: 'same-user',
  },
  'chat.composer.text': {
    id: 'chat.composer.text',
    domain: 'chat',
    viewModelType: 'ChatComposerViewModel',
    allowedComponentIds: ['primitive.input.v1', 'chat.inbox.v1'],
    privacy: 'thread-member',
  },
  'call.active.participants': {
    id: 'call.active.participants',
    domain: 'call',
    viewModelType: 'CallSurfaceViewModel',
    allowedComponentIds: ['call.active.v1', 'call.participant-tile.v1', 'call.participant-grid.v1', 'call.screen.v1'],
    privacy: 'thread-member',
  },
  'call.active.duration': {
    id: 'call.active.duration',
    domain: 'call',
    viewModelType: 'CallSurfaceViewModel',
    allowedComponentIds: ['call.active.v1', 'primitive.label.v1', 'call.screen.v1'],
    privacy: 'thread-member',
  },
  'call.incoming.caller': {
    id: 'call.incoming.caller',
    domain: 'call',
    viewModelType: 'CallSurfaceViewModel',
    allowedComponentIds: ['call.incoming.v1', 'primitive.avatar.v1', 'primitive.button.v1'],
    privacy: 'same-user',
  },
  'live.viewer-count': {
    id: 'live.viewer-count',
    domain: 'live',
    viewModelType: 'LiveRoomViewModel',
    allowedComponentIds: ['live.viewer-counter.v1', 'live.room-header.v1'],
    privacy: 'room-member',
  },
  'wallet.balance': {
    id: 'wallet.balance',
    domain: 'wallet',
    viewModelType: 'WalletSummaryViewModel',
    allowedComponentIds: ['wallet.balance-card.v1', 'wallet.balance-card.compact', 'wallet.screen.v1'],
    privacy: 'same-user',
  },
  'gift.selected': {
    id: 'gift.selected',
    domain: 'gifts',
    viewModelType: 'GiftPanelViewModel',
    allowedComponentIds: ['live.gift-panel.v1', 'primitive.button.v1', 'primitive.image.v1', 'primitive.label.v1'],
    privacy: 'room-member',
  },
};

export function isBindingId(value: string): value is BindingId {
  return value in BINDING_REGISTRY;
}
