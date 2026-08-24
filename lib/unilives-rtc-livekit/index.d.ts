export function createLiveKitRTCProvider(options?: {
  identity?: string;
  roomType?: import('@unilives/rtc-contracts').UniLiveRoomType;
  roomOptions?: Record<string, unknown>;
}): Promise<import('@unilives/rtc-contracts').UniLivesRTCProvider & { getNativeRoom?(): unknown }>;

export {
  createLiveKitToken,
  ensureLiveKitRoom,
  deleteLiveKitRoom,
  isLiveKitConfigured,
  getLiveKitUrl,
} from '@workspace/livekit';
