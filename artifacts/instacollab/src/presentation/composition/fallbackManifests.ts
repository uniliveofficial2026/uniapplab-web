import type { UiExperienceManifest } from './manifestSchema';

/** Bundled last-known-good experiences — reproduce current UniLive’s screen composition. */

export const FALLBACK_MANIFESTS: Record<string, UiExperienceManifest> = {
  login: {
    schemaVersion: 1,
    experienceKey: 'login',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'single',
      slots: [{ id: 'root', componentId: 'auth.login.v1', dataBinding: 'settings.form', titleKey: 'auth.login' }],
    },
  },
  home: {
    schemaVersion: 1,
    experienceKey: 'home',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'single',
      slots: [{ id: 'root', componentId: 'feed.screen.v1', dataBinding: 'profile.header', titleKey: 'nav.home' }],
    },
  },
  chat: {
    schemaVersion: 1,
    experienceKey: 'chat',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'single',
      slots: [{ id: 'root', componentId: 'chat.inbox.v1', dataBinding: 'chat.threadList', titleKey: 'nav.messages', actions: ['chat.openThread'] }],
    },
  },
  profile: {
    schemaVersion: 1,
    experienceKey: 'profile',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'single',
      slots: [{ id: 'root', componentId: 'profile.screen.v1', dataBinding: 'profile.header', titleKey: 'nav.profile' }],
    },
  },
  'live-room': {
    schemaVersion: 1,
    experienceKey: 'live-room',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'stack',
      slots: [
        { id: 'header', componentId: 'live.room-header.v1', dataBinding: 'live.header', actions: ['live.close', 'profile.open'], titleKey: 'nav.live' },
        { id: 'seats', componentId: 'live.video-seat.v1', variant: 'multi-guest', dataBinding: 'live.seats', actions: ['seat.request', 'profile.open'] },
        { id: 'pk', componentId: 'live.pk-scoreboard.v1', dataBinding: 'live.pk', actions: ['pk.invite'] },
        { id: 'gifts', componentId: 'live.gift-panel.v1', variant: 'default', dataBinding: 'live.giftPanel', actions: ['gift.send'], titleKey: 'common.gifts' },
      ],
    },
  },
  wallet: {
    schemaVersion: 1,
    experienceKey: 'wallet',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'stack',
      slots: [
        { id: 'balance', componentId: 'wallet.balance-card.v1', dataBinding: 'wallet.summary', actions: ['wallet.purchase'], titleKey: 'wallet.coins', accessibilityLabelKey: 'wallet.coins' },
        { id: 'packages', componentId: 'wallet.coin-package.v1', dataBinding: 'wallet.packages', actions: ['wallet.purchase'], titleKey: 'wallet.recharge' },
      ],
    },
  },
  'wallet-compact': {
    schemaVersion: 1,
    experienceKey: 'wallet-compact',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'stack',
      slots: [
        { id: 'balance', componentId: 'wallet.balance-card.compact', dataBinding: 'wallet.summary', actions: ['wallet.purchase'], titleKey: 'wallet.coins' },
        { id: 'packages', componentId: 'wallet.coin-package.v1', dataBinding: 'wallet.packages', actions: ['wallet.purchase'] },
      ],
    },
  },
  settings: {
    schemaVersion: 1,
    experienceKey: 'settings',
    version: 1,
    platform: 'all',
    themeVersion: 4,
    layout: {
      type: 'single',
      slots: [{ id: 'root', componentId: 'settings.screen.v1', dataBinding: 'settings.form', titleKey: 'common.settings' }],
    },
  },
};

export function getBundledManifest(experienceKey: string): UiExperienceManifest | null {
  return FALLBACK_MANIFESTS[experienceKey] ?? null;
}
