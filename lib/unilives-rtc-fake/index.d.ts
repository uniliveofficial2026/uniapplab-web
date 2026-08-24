export function createFakeRTCProvider(options?: {
  identity?: string;
  role?: import('@unilives/rtc-contracts').RtcRole;
  roomType?: import('@unilives/rtc-contracts').UniLiveRoomType;
  unavailable?: boolean;
}): import('@unilives/rtc-contracts').UniLivesRTCProvider & {
  _setConnectionState?(next: import('@unilives/rtc-contracts').RtcConnectionState): void;
  _getPublishProfile?(): import('@unilives/rtc-contracts').PublishProfile;
  _getSubscriptionProfile?(): import('@unilives/rtc-contracts').SubscriptionProfile;
};
