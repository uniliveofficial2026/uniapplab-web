import type { TranslationParams } from '../../lib/i18n/types';

export type ViewStatus = 'loading' | 'ready' | 'error' | 'empty';

export type UserSummaryViewModel = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  verified?: boolean;
};

export type PermissionFlag = {
  allowed: boolean;
  reasonKey?: string;
};

export type WalletSummaryViewModel = {
  userId: string;
  coins: number;
  diamonds: number;
  bonusCoins: number;
  status: ViewStatus;
  titleKey: 'wallet.coins';
  rechargeActionId: 'wallet.purchase';
  permissions: {
    canPurchase: PermissionFlag;
    canTransfer: PermissionFlag;
  };
};

export type GiftPanelItemViewModel = {
  giftId: string;
  nameKey?: string;
  displayName: string;
  price: number;
  thumbnailAssetId: string;
  animationAssetId?: string;
};

export type GiftPanelViewModel = {
  items: GiftPanelItemViewModel[];
  status: ViewStatus;
  sendActionId: 'gift.send';
  permissions: { canSend: PermissionFlag };
};

export type SeatViewModel = {
  seatIndex: number;
  userId: string | null;
  state: 'empty' | 'requested' | 'approved' | 'locked';
  role: 'host' | 'guest' | 'viewer';
  canPublish: boolean;
};

export type PkViewModel = {
  sessionId: string;
  status: 'idle' | 'countdown' | 'active' | 'ended';
  leftScore: number;
  rightScore: number;
  countdownSeconds?: number;
};

export type LiveRoomPermissionsViewModel = {
  canPublish: PermissionFlag;
  canRequestSeat: PermissionFlag;
  canApproveSeat: PermissionFlag;
  canSendGift: PermissionFlag;
  canInvitePk: PermissionFlag;
};

export type LiveRoomViewModel = {
  roomId: string;
  roomType: 'solo_video' | 'solo_audio' | 'audio_party' | 'video_multi' | 'pk_1v1' | 'pk_team' | string;
  title: string;
  host: UserSummaryViewModel;
  viewerCount: number;
  seats: SeatViewModel[];
  pk: PkViewModel | null;
  giftPanel: GiftPanelViewModel;
  permissions: LiveRoomPermissionsViewModel;
  status: ViewStatus;
};

export type ChatThreadRowViewModel = {
  threadId: string;
  title: string;
  previewKey?: string;
  preview?: string;
  unread: number;
  peer: UserSummaryViewModel | null;
};

export type ChatInboxViewModel = {
  threads: ChatThreadRowViewModel[];
  status: ViewStatus;
  openActionId: 'chat.openThread';
};

export type ProfileHeaderViewModel = {
  user: UserSummaryViewModel;
  bio: string;
  followerCount: number;
  followingCount: number;
  decorations: { vip: boolean; svip: boolean; frameAssetId?: string; badgeAssetIds: string[] };
  permissions: { canFollow: PermissionFlag; canEdit: PermissionFlag };
  status: ViewStatus;
};

export type NotificationRowViewModel = {
  id: string;
  translationKey: string;
  params?: TranslationParams;
  read: boolean;
};

export type SettingsViewModel = {
  locale: string;
  theme: string;
  notificationsEnabled: boolean;
  status: ViewStatus;
};
