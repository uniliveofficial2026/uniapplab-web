import { useEffect, type ReactNode } from 'react';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import type { BodyShapeParams } from '../../lib/ar/bodyShape';
import type { DeepAREffectSelection } from '../../lib/deepar/deeparEffectSelection';
import type { TencentEffectSelection } from '../../lib/webar/webarTypes';
import {
  startHostMediaPrejoin,
  stopHostMediaPrejoin,
} from '../../lib/camera/hostMediaSession';
import { useMultiGuestCameraEffects, type MultiGuestCameraEffectsState } from '../hooks/useMultiGuestCameraEffects';
import {
  useMultiGuestLiveKit,
  type MultiGuestLiveKitState,
} from '../hooks/useMultiGuestLiveKit';

export type RoomLiveMediaBundle = {
  camera: MultiGuestCameraEffectsState;
  liveKit: MultiGuestLiveKitState;
};

type RoomLiveMediaSessionProps = {
  /** Drives full teardown when switching Solo Live ↔ Multi-Guest (use as React key). */
  sessionMode: 'SoloLive' | 'MultiGuest';
  roomId: string;
  userSeatKey: string | null;
  userCameraOn: boolean;
  userMicOn: boolean;
  userMicAdminMuted: boolean;
  publishMic?: boolean;
  processedAudioTrack?: MediaStreamTrack | null;
  effectId?: string;
  effectSelection?: DeepAREffectSelection;
  beautyId?: BeautyPresetId;
  beautyEffects?: TencentEffectSelection;
  bodyShape?: BodyShapeParams;
  beautyPanelOpen?: boolean;
  effectsPanelOpen?: boolean;
  beautifyOverride?: import('../../lib/webar/webarTypes').TencentBeautifyParams | null;
  /** Platform-admin silent watch — LiveKit hidden grant. */
  hiddenLiveKit?: boolean;
  children: (media: RoomLiveMediaBundle) => ReactNode;
};

/**
 * Isolated camera + AR + LiveKit session for a single live room layout.
 * Remounting this component (e.g. key={sessionMode}) destroys the previous
 * camera stream, DeepAR instance, and LiveKit connection before starting fresh.
 */
export function RoomLiveMediaSession({
  sessionMode,
  roomId,
  userSeatKey,
  userCameraOn,
  userMicOn,
  userMicAdminMuted,
  publishMic,
  processedAudioTrack = null,
  effectId = 'none',
  effectSelection,
  beautyId,
  beautyEffects,
  bodyShape,
  beautyPanelOpen,
  effectsPanelOpen,
  beautifyOverride = null,
  hiddenLiveKit = false,
  children,
}: RoomLiveMediaSessionProps) {
  const liveCameraEnabled = Boolean(userSeatKey) && userCameraOn;

  useEffect(() => {
    void startHostMediaPrejoin({
      roomId,
      canPublish: hiddenLiveKit ? false : Boolean(userSeatKey),
      hidden: hiddenLiveKit,
    });
    return () => {
      stopHostMediaPrejoin(roomId);
    };
  }, [roomId, userSeatKey, hiddenLiveKit]);

  const camera = useMultiGuestCameraEffects({
    enabled: liveCameraEnabled,
    effectId,
    effectSelection,
    beautyId,
    beautyEffects,
    bodyShape,
    beautyPanelOpen,
    effectsPanelOpen,
    beautifyOverride,
  });

  const liveKit = useMultiGuestLiveKit({
    roomId,
    active: true,
    sessionMode,
    canPublish: hiddenLiveKit ? false : Boolean(userSeatKey),
    publishVideo: hiddenLiveKit ? false : Boolean(userSeatKey && userCameraOn),
    publishMic:
      hiddenLiveKit
        ? false
        : (publishMic ?? Boolean(userSeatKey && userMicOn && !userMicAdminMuted)),
    processedAudioTrack: hiddenLiveKit ? null : processedAudioTrack,
    cameraTrack: hiddenLiveKit ? null : camera.videoTrack,
    hidden: hiddenLiveKit,
  });

  return <>{children({ camera, liveKit })}</>;
}

/** Shared live-camera props for SoloLiveView / MultiGuestView. */
export function buildLiveViewMediaProps(media: RoomLiveMediaBundle) {
  return {
    multiGuestLiveKit: media.liveKit,
    rawVideoRef: media.camera.rawVideoRef,
    deeparPreviewRef: media.camera.previewRef,
    beautyVideoRef: media.camera.beautyVideoRef,
    showDeeparPreview: media.camera.showDeeparPreview,
    showBeautyPreview:
      media.camera.showBeautyPreview || media.camera.showProcessedPreview,
    beautyVideoReady: media.camera.beautyVideoReady,
    effectsConfigured: media.camera.configured,
    effectsLoading: media.camera.arLoading,
    effectsCameraReady: media.camera.cameraReady,
    cameraError: media.camera.cameraError,
    cameraPermissionDenied: media.camera.cameraPermissionDenied,
    onRetryCamera: media.camera.retryCamera,
    effectsArReady: media.camera.arReady,
    beautyConfigured: media.camera.beautyConfigured,
    beautyReady: media.camera.beautyReady,
    beautyLoading: media.camera.beautyLoading,
    beautyError: media.camera.beautyError,
    beautyCssFilter: media.camera.beautyCssFilter,
    beautyCatalogs: media.camera.beautyCatalogs,
    readyEffectIds: media.camera.readyEffectIds,
    cameraFacingMode: media.camera.cameraFacingMode,
    cameraGeneration: media.camera.cameraGeneration,
    cameraTrackDiag: media.camera.cameraTrackDiag,
    onToggleCameraFacing: media.camera.toggleCameraFacing,
  };
}
