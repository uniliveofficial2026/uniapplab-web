/**
 * Shared domain types for the additive services layer.
 * Existing UI types remain in lib/ and components/ — do not rename them.
 */

export type ServiceResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type MediaFolder =
  | 'avatars'
  | 'posts'
  | 'chat'
  | 'gifts'
  | 'karaoke'
  | 'covers'
  | 'misc';

export type UploadResult = {
  publicUrl: string;
  folder: MediaFolder;
};

export type BeautyProviderId = 'tencent' | 'deepar' | 'banuba' | 'agora';
export type VoiceProviderId = 'agora' | 'tencent' | 'custom';
export type LivestreamProviderId = 'livekit' | 'trtc';
export type PaymentProviderId = 'stripe' | 'apple_pay' | 'google_pay';
