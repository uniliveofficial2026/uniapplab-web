import type { UiFragmentContent } from './uiNodeSchema';

export const EXPERIENCE_KEYS = [
  'auth.login',
  'auth.signup',
  'home.discovery',
  'profile.view',
  'profile.edit',
  'chat.inbox',
  'chat.thread',
  'live.solo-audio',
  'live.solo-video',
  'live.multi-audio',
  'live.multi-video',
  'live.party',
  'live.pk-one-v-one',
  'live.pk-team',
  'wallet.home',
  'wallet.purchase',
  'settings.main',
  'settings.language',
  'notifications.list',
] as const;

export type ExperienceKey = (typeof EXPERIENCE_KEYS)[number];

export const FRAGMENT_KEYS = [
  'navigation.bottom',
  'auth.login',
  'auth.signup',
  'home.discovery',
  'profile.header',
  'profile.card',
  'profile.view',
  'profile.edit',
  'chat.inbox',
  'chat.thread-row',
  'chat.message-bubble',
  'chat.thread',
  'live.room-header',
  'live.viewer-counter',
  'live.seat-grid',
  'live.gift-panel',
  'live.pk-scoreboard',
  'live.solo-audio',
  'live.solo-video',
  'live.multi-audio',
  'live.multi-video',
  'live.party',
  'live.pk-one-v-one',
  'live.pk-team',
  'wallet.balance-card',
  'wallet.coin-package',
  'wallet.home',
  'wallet.purchase',
  'settings.main',
  'settings.language',
  'notifications.list',
  'state.loading',
  'state.empty',
  'state.error',
] as const;

export type FragmentKey = (typeof FRAGMENT_KEYS)[number];

function node(
  nodeId: string,
  componentId: string,
  extra: Partial<UiFragmentContent['root']> = {},
): UiFragmentContent['root'] {
  return {
    nodeId,
    componentId,
    componentVersion: 1,
    variant: extra.variant || 'default',
    ...extra,
  };
}

export const BUNDLED_FRAGMENTS: Record<FragmentKey, UiFragmentContent> = {
  'navigation.bottom': {
    schemaVersion: 1,
    fragmentKey: 'navigation.bottom',
    version: 1,
    requiredTranslationKeys: ['nav.home', 'nav.live', 'nav.messages', 'nav.profile'],
    root: node('navigation.bottom', 'navigation.bottom.v1', {
      actions: [{ actionId: 'navigation.open' }],
      slots: {
        tabs: [
          node('navigation.bottom.tab.home', 'primitive.tab.v1', { translationKeys: { label: 'nav.home' }, actions: [{ actionId: 'navigation.open', params: { tab: 'home' } }] }),
          node('navigation.bottom.tab.live', 'primitive.tab.v1', { translationKeys: { label: 'nav.live' }, actions: [{ actionId: 'navigation.open', params: { tab: 'rooms' } }] }),
          node('navigation.bottom.tab.messages', 'primitive.tab.v1', { translationKeys: { label: 'nav.messages' }, actions: [{ actionId: 'navigation.open', params: { tab: 'messages' } }] }),
          node('navigation.bottom.tab.profile', 'primitive.tab.v1', { translationKeys: { label: 'nav.profile' }, actions: [{ actionId: 'navigation.open', params: { tab: 'profile' } }] }),
        ],
      },
    }),
  },
  'auth.login': {
    schemaVersion: 1,
    fragmentKey: 'auth.login',
    version: 1,
    requiredTranslationKeys: ['auth.login'],
    root: node('auth.login.root', 'auth.login.v1', {
      translationKeys: { title: 'auth.login' },
      slots: {
        header: [node('auth.login.header', 'primitive.header.v1', { translationKeys: { title: 'auth.login' } })],
        form: [
          node('auth.login.email', 'primitive.input.v1', { translationKeys: { label: 'common.email', placeholder: 'common.email' } }),
          node('auth.login.password', 'primitive.input.v1', { translationKeys: { label: 'common.password', placeholder: 'common.password' } }),
          node('auth.login.submit', 'primitive.button.v1', { translationKeys: { label: 'auth.login' } }),
        ],
        empty: [node('auth.login.empty', 'state.empty.v1')],
        error: [node('auth.login.error', 'state.error.v1', { translationKeys: { title: 'common.error' } })],
      },
    }),
  },
  'auth.signup': {
    schemaVersion: 1,
    fragmentKey: 'auth.signup',
    version: 1,
    requiredTranslationKeys: ['common.continue'],
    root: node('auth.signup.root', 'auth.signup.v1', {
      translationKeys: { title: 'common.continue' },
      slots: {
        form: [
          node('auth.signup.username', 'primitive.input.v1', { translationKeys: { label: 'common.username' } }),
          node('auth.signup.submit', 'primitive.button.v1', { translationKeys: { label: 'common.continue' } }),
        ],
      },
    }),
  },
  'home.discovery': {
    schemaVersion: 1,
    fragmentKey: 'home.discovery',
    version: 1,
    requiredTranslationKeys: ['nav.home'],
    root: node('home.discovery.root', 'feed.screen.v1', {
      translationKeys: { title: 'nav.home' },
      slots: {
        header: [node('home.discovery.header', 'primitive.header.v1', { translationKeys: { title: 'nav.home' } })],
        grid: [node('home.discovery.grid', 'primitive.grid.v1', { responsive: { columns: 2, breakpoint: 'phone' } })],
        card: [node('home.discovery.card', 'feed.post-card.v1', { actions: [{ actionId: 'profile.open' }] })],
        loading: [node('home.discovery.loading', 'state.loading.v1')],
        empty: [node('home.discovery.empty', 'state.empty.v1')],
      },
    }),
  },
  'profile.header': {
    schemaVersion: 1,
    fragmentKey: 'profile.header',
    version: 1,
    requiredTranslationKeys: ['common.profile', 'common.follow'],
    root: node('profile.header.root', 'profile.header.v1', {
      dataBinding: 'profile.header',
      actions: [{ actionId: 'profile.follow' }, { actionId: 'profile.open' }],
      slots: {
        avatar: [
          node('profile.header.avatar', 'primitive.avatar.v1', { assetBindings: { image: 'brand.logo.primary' }, actions: [{ actionId: 'profile.open' }] }),
          node('profile.header.avatar-ring', 'primitive.ring.v1'),
          node('profile.header.frame', 'primitive.frame.v1', { assetBindings: { frame: 'frame.profile.svip' } }),
        ],
        badge: [node('profile.header.badge.vip', 'primitive.badge.v1', { translationKeys: { label: 'common.vip' } })],
        follow: [node('profile.header.follow', 'primitive.button.v1', { translationKeys: { label: 'common.follow' }, actions: [{ actionId: 'profile.follow' }] })],
      },
    }),
  },
  'profile.card': {
    schemaVersion: 1,
    fragmentKey: 'profile.card',
    version: 1,
    requiredTranslationKeys: ['common.profile'],
    root: node('profile.card.root', 'profile.card.v1', {
      dataBinding: 'profile.header',
      actions: [{ actionId: 'profile.open' }],
    }),
  },
  'profile.view': {
    schemaVersion: 1,
    fragmentKey: 'profile.view',
    version: 1,
    requiredTranslationKeys: ['nav.profile'],
    root: node('profile.view.root', 'profile.screen.v1', {
      dataBinding: 'profile.header',
      translationKeys: { title: 'nav.profile' },
      slots: {
        header: [node('profile.view.header', 'profile.header.v1', { dataBinding: 'profile.header' })],
        tabs: [node('profile.view.tabs', 'primitive.tab.v1')],
        empty: [node('profile.view.empty', 'state.empty.v1')],
      },
    }),
  },
  'profile.edit': {
    schemaVersion: 1,
    fragmentKey: 'profile.edit',
    version: 1,
    requiredTranslationKeys: ['common.edit', 'common.save'],
    root: node('profile.edit.root', 'settings.screen.v1', {
      dataBinding: 'settings.form',
      slots: {
        displayName: [node('profile.edit.display-name', 'primitive.input.v1', { translationKeys: { label: 'common.displayName' } })],
        save: [node('profile.edit.save', 'primitive.button.v1', { translationKeys: { label: 'common.save' } })],
      },
    }),
  },
  'chat.inbox': {
    schemaVersion: 1,
    fragmentKey: 'chat.inbox',
    version: 1,
    requiredTranslationKeys: ['nav.messages'],
    root: node('chat.inbox.root', 'chat.inbox.v1', {
      dataBinding: 'chat.threadList',
      actions: [{ actionId: 'chat.openThread' }],
      slots: {
        list: [node('chat.inbox.list', 'primitive.list.v1')],
        row: [node('chat.inbox.row', 'chat.thread-row.v1', { dataBinding: 'chat.threadList', actions: [{ actionId: 'chat.openThread' }] })],
        empty: [node('chat.inbox.empty', 'state.empty.v1')],
      },
    }),
  },
  'chat.thread-row': {
    schemaVersion: 1,
    fragmentKey: 'chat.thread-row',
    version: 1,
    requiredTranslationKeys: ['nav.messages'],
    root: node('chat.thread-row.root', 'chat.thread-row.v1', {
      dataBinding: 'chat.threadList',
      actions: [{ actionId: 'chat.openThread' }],
      slots: {
        avatar: [node('chat.thread-row.avatar', 'primitive.avatar.v1')],
      },
    }),
  },
  'chat.message-bubble': {
    schemaVersion: 1,
    fragmentKey: 'chat.message-bubble',
    version: 1,
    requiredTranslationKeys: ['common.send'],
    root: node('chat.message-bubble.root', 'chat.message-bubble.v1', {
      dataBinding: 'chat.activeThread',
      slots: {
        timestamp: [node('chat.message-bubble.timestamp', 'primitive.label.v1')],
      },
    }),
  },
  'chat.thread': {
    schemaVersion: 1,
    fragmentKey: 'chat.thread',
    version: 1,
    requiredTranslationKeys: ['common.sendMessage'],
    root: node('chat.thread.root', 'chat.inbox.v1', {
      dataBinding: 'chat.activeThread',
      actions: [{ actionId: 'chat.sendMessage' }],
      slots: {
        bubble: [node('chat.thread.bubble', 'chat.message-bubble.v1', { dataBinding: 'chat.activeThread' })],
        composer: [node('chat.thread.composer', 'primitive.input.v1', { translationKeys: { placeholder: 'common.sayHi' } })],
        send: [node('chat.thread.send', 'primitive.icon-button.v1', { translationKeys: { label: 'common.send' }, actions: [{ actionId: 'chat.sendMessage' }] })],
      },
    }),
  },
  'live.room-header': {
    schemaVersion: 1,
    fragmentKey: 'live.room-header',
    version: 1,
    requiredTranslationKeys: ['nav.live', 'common.close'],
    compatibleRoomTypes: ['solo_audio', 'solo_video', 'audio_party', 'video_multi', 'pk_1v1', 'pk_team'],
    root: node('live.room-header.root', 'live.room-header.v1', {
      dataBinding: 'live.header',
      actions: [{ actionId: 'live.close' }, { actionId: 'profile.open' }],
      slots: {
        close: [node('live.room-header.close-button', 'primitive.icon-button.v1', { translationKeys: { label: 'common.close' }, actions: [{ actionId: 'live.close' }] })],
        title: [node('live.room-header.title', 'primitive.label.v1', { translationKeys: { label: 'nav.live' } })],
      },
    }),
  },
  'live.viewer-counter': {
    schemaVersion: 1,
    fragmentKey: 'live.viewer-counter',
    version: 1,
    requiredTranslationKeys: ['common.viewer'],
    root: node('live.viewer-counter.root', 'live.viewer-counter.v1', { dataBinding: 'live.header' }),
  },
  'live.seat-grid': {
    schemaVersion: 1,
    fragmentKey: 'live.seat-grid',
    version: 1,
    requiredTranslationKeys: ['common.guest'],
    compatibleRoomTypes: ['audio_party', 'video_multi', 'pk_1v1', 'pk_team'],
    root: node('live.seat-grid.root', 'live.video-seat.v1', {
      variant: 'multi-guest',
      dataBinding: 'live.seats',
      actions: [{ actionId: 'seat.request' }, { actionId: 'profile.open' }],
      slots: {
        seat0: [
          node('live.seat-grid.seat.0', 'live.video-seat.v1', { dataBinding: 'live.seats' }),
          node('live.seat-grid.seat.0.avatar-ring', 'primitive.ring.v1'),
        ],
      },
    }),
  },
  'live.gift-panel': {
    schemaVersion: 1,
    fragmentKey: 'live.gift-panel',
    version: 1,
    requiredTranslationKeys: ['common.gifts'],
    root: node('live.gift-panel.root', 'live.gift-panel.v1', {
      dataBinding: 'live.giftPanel',
      actions: [{ actionId: 'gift.send' }],
      slots: {
        send: [node('live.gift-panel.send-button', 'primitive.button.v1', { translationKeys: { label: 'common.send' }, actions: [{ actionId: 'gift.send' }] })],
        effect: [node('live.gift-panel.effect', 'primitive.animation.v1', { assetBindings: { animation: 'gift.rose.animation' } })],
      },
    }),
  },
  'live.pk-scoreboard': {
    schemaVersion: 1,
    fragmentKey: 'live.pk-scoreboard',
    version: 1,
    requiredTranslationKeys: ['common.live'],
    compatibleRoomTypes: ['pk_1v1', 'pk_team'],
    root: node('live.pk-scoreboard.root', 'live.pk-scoreboard.v1', {
      dataBinding: 'live.pk',
      actions: [{ actionId: 'pk.invite' }, { actionId: 'pk.accept' }],
    }),
  },
  'live.solo-audio': {
    schemaVersion: 1,
    fragmentKey: 'live.solo-audio',
    version: 1,
    requiredTranslationKeys: ['nav.live'],
    compatibleRoomTypes: ['solo_audio'],
    root: node('live.solo-audio.root', 'live.screen.v1', {
      dataBinding: 'live.header',
      slots: {
        header: [node('live.solo-audio.header', 'live.room-header.v1', { dataBinding: 'live.header' })],
        seat: [node('live.solo-audio.seat', 'live.audio-seat.v1', { dataBinding: 'live.seats' })],
        gifts: [node('live.solo-audio.gifts', 'live.gift-panel.v1', { dataBinding: 'live.giftPanel' })],
      },
    }),
  },
  'live.solo-video': {
    schemaVersion: 1,
    fragmentKey: 'live.solo-video',
    version: 1,
    requiredTranslationKeys: ['nav.live'],
    compatibleRoomTypes: ['solo_video'],
    root: node('live.solo-video.root', 'live.screen.v1', {
      dataBinding: 'live.header',
      slots: {
        header: [node('live.solo-video.header', 'live.room-header.v1', { dataBinding: 'live.header' })],
        seat: [node('live.solo-video.seat', 'live.video-seat.v1', { dataBinding: 'live.seats' })],
        gifts: [node('live.solo-video.gifts', 'live.gift-panel.v1', { dataBinding: 'live.giftPanel' })],
      },
    }),
  },
  'live.multi-audio': {
    schemaVersion: 1,
    fragmentKey: 'live.multi-audio',
    version: 1,
    requiredTranslationKeys: ['nav.live'],
    compatibleRoomTypes: ['audio_party'],
    root: node('live.multi-audio.root', 'live.screen.v1', {
      dataBinding: 'live.header',
      slots: {
        header: [node('live.multi-audio.header', 'live.room-header.v1', { dataBinding: 'live.header' })],
        seats: [node('live.multi-audio.seats', 'live.audio-seat.v1', { variant: 'round', dataBinding: 'live.seats' })],
        gifts: [node('live.multi-audio.gifts', 'live.gift-panel.v1', { dataBinding: 'live.giftPanel' })],
      },
    }),
  },
  'live.multi-video': {
    schemaVersion: 1,
    fragmentKey: 'live.multi-video',
    version: 1,
    requiredTranslationKeys: ['nav.live'],
    compatibleRoomTypes: ['video_multi'],
    root: node('live.multi-video.root', 'live.screen.v1', {
      dataBinding: 'live.header',
      slots: {
        header: [node('live.multi-video.header', 'live.room-header.v1', { dataBinding: 'live.header' })],
        seats: [node('live.multi-video.seats', 'live.video-seat.v1', { variant: 'square', dataBinding: 'live.seats' })],
        gifts: [node('live.multi-video.gifts', 'live.gift-panel.v1', { dataBinding: 'live.giftPanel' })],
      },
    }),
  },
  'live.party': {
    schemaVersion: 1,
    fragmentKey: 'live.party',
    version: 1,
    requiredTranslationKeys: ['nav.live'],
    compatibleRoomTypes: ['audio_party', 'video_multi'],
    root: node('live.party.root', 'live.screen.v1', {
      dataBinding: 'live.header',
      slots: {
        header: [node('live.party.header', 'live.room-header.v1', { dataBinding: 'live.header' })],
        seats: [node('live.party.seats', 'live.audio-seat.v1', { dataBinding: 'live.seats' })],
        gifts: [node('live.party.gifts', 'live.gift-panel.v1', { dataBinding: 'live.giftPanel' })],
      },
    }),
  },
  'live.pk-one-v-one': {
    schemaVersion: 1,
    fragmentKey: 'live.pk-one-v-one',
    version: 1,
    requiredTranslationKeys: ['nav.live'],
    compatibleRoomTypes: ['pk_1v1'],
    root: node('live.pk-one-v-one.root', 'live.screen.v1', {
      dataBinding: 'live.header',
      slots: {
        header: [node('live.pk-one-v-one.header', 'live.room-header.v1', { dataBinding: 'live.header' })],
        pk: [node('live.pk-one-v-one.scoreboard', 'live.pk-scoreboard.v1', { dataBinding: 'live.pk' })],
        seats: [node('live.pk-one-v-one.seats', 'live.video-seat.v1', { dataBinding: 'live.seats' })],
        gifts: [node('live.pk-one-v-one.gifts', 'live.gift-panel.v1', { dataBinding: 'live.giftPanel' })],
      },
    }),
  },
  'live.pk-team': {
    schemaVersion: 1,
    fragmentKey: 'live.pk-team',
    version: 1,
    requiredTranslationKeys: ['nav.live'],
    compatibleRoomTypes: ['pk_team'],
    root: node('live.pk-team.root', 'live.screen.v1', {
      dataBinding: 'live.header',
      slots: {
        header: [node('live.pk-team.header', 'live.room-header.v1', { dataBinding: 'live.header' })],
        pk: [node('live.pk-team.scoreboard', 'live.pk-scoreboard.v1', { dataBinding: 'live.pk' })],
        seats: [node('live.pk-team.seats', 'live.video-seat.v1', { dataBinding: 'live.seats' })],
        gifts: [node('live.pk-team.gifts', 'live.gift-panel.v1', { dataBinding: 'live.giftPanel' })],
      },
    }),
  },
  'wallet.balance-card': {
    schemaVersion: 1,
    fragmentKey: 'wallet.balance-card',
    version: 1,
    requiredTranslationKeys: ['wallet.coins'],
    root: node('wallet.balance-card.root', 'wallet.balance-card.v1', {
      dataBinding: 'wallet.summary',
      translationKeys: { title: 'wallet.coins', amount: 'wallet.coins' },
      actions: [{ actionId: 'wallet.purchase' }],
      slots: {
        amount: [node('wallet.balance-card.amount', 'primitive.label.v1', { translationKeys: { label: 'wallet.coins' } })],
        recharge: [node('wallet.balance-card.recharge', 'primitive.button.v1', { translationKeys: { label: 'wallet.recharge' }, actions: [{ actionId: 'wallet.purchase' }] })],
      },
    }),
  },
  'wallet.coin-package': {
    schemaVersion: 1,
    fragmentKey: 'wallet.coin-package',
    version: 1,
    requiredTranslationKeys: ['wallet.recharge'],
    root: node('wallet.coin-package.root', 'wallet.coin-package.v1', {
      dataBinding: 'wallet.packages',
      actions: [{ actionId: 'wallet.purchase' }],
    }),
  },
  'wallet.home': {
    schemaVersion: 1,
    fragmentKey: 'wallet.home',
    version: 1,
    requiredTranslationKeys: ['wallet.coins', 'wallet.recharge'],
    root: node('wallet.home.root', 'wallet.screen.v1', {
      dataBinding: 'wallet.summary',
      slots: {
        card: [node('wallet.home.card', 'wallet.balance-card.v1', { dataBinding: 'wallet.summary' })],
        packages: [node('wallet.home.packages', 'wallet.coin-package.v1', { dataBinding: 'wallet.packages' })],
      },
    }),
  },
  'wallet.purchase': {
    schemaVersion: 1,
    fragmentKey: 'wallet.purchase',
    version: 1,
    requiredTranslationKeys: ['wallet.recharge'],
    root: node('wallet.purchase.root', 'wallet.screen.v1', {
      dataBinding: 'wallet.packages',
      actions: [{ actionId: 'wallet.purchase' }],
      slots: {
        confirm: [node('wallet.purchase.confirm', 'primitive.dialog.v1', { translationKeys: { title: 'wallet.recharge' } })],
      },
    }),
  },
  'settings.main': {
    schemaVersion: 1,
    fragmentKey: 'settings.main',
    version: 1,
    requiredTranslationKeys: ['common.settings'],
    root: node('settings.main.root', 'settings.screen.v1', {
      dataBinding: 'settings.form',
      translationKeys: { title: 'common.settings' },
      slots: {
        notifications: [node('settings.main.notifications', 'primitive.toggle.v1', { translationKeys: { label: 'common.notifications' } })],
        language: [node('settings.main.language', 'primitive.button.v1', { translationKeys: { label: 'common.language' } })],
      },
    }),
  },
  'settings.language': {
    schemaVersion: 1,
    fragmentKey: 'settings.language',
    version: 1,
    requiredTranslationKeys: ['common.language'],
    root: node('settings.language.root', 'settings.screen.v1', {
      dataBinding: 'settings.form',
      translationKeys: { title: 'common.language' },
      slots: {
        list: [node('settings.language.list', 'primitive.list.v1')],
      },
    }),
  },
  'notifications.list': {
    schemaVersion: 1,
    fragmentKey: 'notifications.list',
    version: 1,
    requiredTranslationKeys: ['common.notifications'],
    root: node('notifications.list.root', 'notifications.list.v1', {
      dataBinding: 'notifications.list',
      actions: [{ actionId: 'notification.markRead' }],
    }),
  },
  'state.loading': {
    schemaVersion: 1,
    fragmentKey: 'state.loading',
    version: 1,
    requiredTranslationKeys: ['common.loading'],
    root: node('state.loading.root', 'state.loading.v1', { translationKeys: { title: 'common.loading' } }),
  },
  'state.empty': {
    schemaVersion: 1,
    fragmentKey: 'state.empty',
    version: 1,
    requiredTranslationKeys: ['common.ok'],
    root: node('state.empty.root', 'state.empty.v1'),
  },
  'state.error': {
    schemaVersion: 1,
    fragmentKey: 'state.error',
    version: 1,
    requiredTranslationKeys: ['common.error', 'common.retry'],
    root: node('state.error.root', 'state.error.v1', {
      translationKeys: { title: 'common.error', retry: 'common.retry' },
    }),
  },
};

export const BUNDLED_SNAPSHOT_ID = 'bundled.unilives.v1';
