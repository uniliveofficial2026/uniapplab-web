/**
 * Unified camera pipeline — TRTC CallKit + BeautyKit pattern for every screen.
 *
 * ## Official Tencent flow (no-freeze)
 * 1. **One** getUserMedia at 1280×720 @ 30fps (`WEBAR_CAMERA_IDEAL`)
 * 2. Paint **raw** stream to preview immediately (never wait on SDK/network)
 * 3. Warm Beauty AR singleton (`keepWarm` / `persistent`) in background
 * 4. On `ready` + `useVideoFrameReady`, swap display/publish to `ar.getOutput(30)`
 * 5. Publish processed track via `updateLiveKitLocalVideoTrack` (TRTC: `updateLocalVideo`)
 *
 * Priority: DeepAR canvas → Tencent beauty output → raw camera.
 *
 * Used by: RoomLiveMediaSession, ChatCallVideoEffectsHost.
 * Import this hook for karaoke, stories, AR capture, platform live, etc.
 */
export {
  useMultiGuestCameraEffects as useAppCameraPipeline,
  type MultiGuestCameraEffectsState as AppCameraPipelineState,
} from '../../smule-rooms/hooks/useMultiGuestCameraEffects';

export {
  WEBAR_CAMERA_IDEAL,
  WEBAR_CAMERA_FRAME_RATE,
  WEBAR_CAMERA_WIDTH,
  WEBAR_CAMERA_HEIGHT,
  WEBAR_OUTPUT_FPS,
} from '../webar/webarCameraConfig';

export { useStreamBeauty, karaokeFilterToBeautyId } from '../ar/useStreamBeauty';
export { useCameraStream, captureVideoFrame, type CameraFacingMode } from './useCameraStream';
export { useVideoFrameReady } from './useVideoFrameReady';
export { attachMediaStreamToVideo, bindMediaStreamToVideo, keepMediaStreamOnVideo } from './bindMediaStreamToVideo';
export { prepareProcessedVideoTrackForLiveKit, updateLiveKitLocalVideoTrack } from '../livekit/liveKitVideoPublish';
export { preloadTencentWebARModule, warmTencentWebARForVideoCall } from '../webar/useTencentWebAR';
