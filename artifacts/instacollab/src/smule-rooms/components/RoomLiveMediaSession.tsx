import type { ReactNode } from 'react';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import type { DeepAREffectSelection } from '../../lib/deepar/deeparEffectSelection';
import type { TencentBodyShapeParams, TencentEffectSelection } from '../../lib/webar/webarTypes';
import { EMPTY_BODY_SHAPE, EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';
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
  effectId?: string;
  effectSelection?: DeepAREffectSelection;
  beautyId?: BeautyPresetId;
  beautyEffects?: TencentEffectSelection;
  bodyShape?: TencentBodyShapeParams;
  beautyPanelOpen?: boolean;
  effectsPanelOpen?: boolean;
  children: (media: RoomLiveMediaBundle) => ReactNode;
};

/**
 * Solo Live + Multi-Guest camera/AR/LiveKit session.
 *
 * Pipeline (Tencent WebAR → LiveKit; TRTC equivalent uses updateLocalVideo):
 *   getUserMedia → ar.getOutput() → updateLiveKitLocalVideoTrack()
 *
 * Local camera paints instantly; LiveKit is a timed background upgrade for
 * remote tiles (viewers subscribe immediately, publishers when seated).
 * Remounting (key={sessionMode}) tears down the previous session cleanly.
 */
export function RoomLiveMediaSession({
  sessionMode,
  roomId,
  userSeatKey,
  userCameraOn,
  userMicOn,
  userMicAdminMuted,
  effectId = 'none',
  effectSelection,
  beautyId = 'none',
  beautyEffects = EMPTY_TENCENT_EFFECT_SELECTION,
  bodyShape = EMPTY_BODY_SHAPE,
  beautyPanelOpen = false,
  effectsPanelOpen = false,
  children,
}: RoomLiveMediaSessionProps) {
  const liveCameraEnabled = Boolean(userSeatKey) && userCameraOn;

  const camera = useMultiGuestCameraEffects({
    enabled: liveCameraEnabled,
    effectId,
    effectSelection,
    beautyId,
    beautyEffects,
    bodyShape,
    beautyPanelOpen,
    effectsPanelOpen,
  });

  const liveKit = useMultiGuestLiveKit({
    roomId,
    active: true,
    sessionMode,
    canPublish: Boolean(userSeatKey),
    publishVideo: Boolean(userSeatKey && userCameraOn),
    publishMic: Boolean(userSeatKey && userMicOn && !userMicAdminMuted),
    cameraTrack: camera.videoTrack,
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
    showBeautyPreview: media.camera.showBeautyPreview,
    beautyCssFilter: media.camera.beautyCssFilter,
    beautyConfigured: media.camera.beautyConfigured,
    beautyLoading: media.camera.beautyLoading,
    beautyError: media.camera.beautyError,
    beautyCatalogs: media.camera.beautyCatalogs,
    effectsConfigured: media.camera.configured,
    effectsLoading: media.camera.arLoading,
    effectsCameraReady: media.camera.cameraReady,
    effectsArReady: media.camera.arReady,
    cameraFacingMode: media.camera.cameraFacingMode,
    onToggleCameraFacing: media.camera.toggleCameraFacing,
  };
}
