/**
 * Platform services barrel — additive facades over existing lib/ implementations.
 * UI may keep importing lib/* until an approved migration.
 */
export { authService, getCanonicalAccessToken, type AuthService } from './AuthService';
export { uploadService, type UploadService } from './UploadService';
export { walletService, type WalletService } from './WalletService';
export { giftService, type GiftService } from './GiftService';
export { roomService, type RoomService } from './RoomService';
export { userService, type UserService } from './UserService';
export { notificationService, type NotificationService } from './NotificationService';
export { beautyService, type BeautyService } from './BeautyService';
export { voiceService, type VoiceService } from './VoiceService';
export { leaderboardService, type LeaderboardService } from './LeaderboardService';

/** Keep existing YouTube helper accessible from the services package. */
export * from './youtube';
