/**
 * Unified camera pipeline — TRTC CallKit + BeautyKit pattern for every screen.
 *
 * ## Official Tencent flow (no-freeze)
 * 1. **One** device camera via `appCameraOwner` (all surfaces share one lease stream)
 * 2. Paint **raw** stream to preview immediately (never wait on SDK/network)
 * 3. Warm Beauty AR singleton (`keepWarm` / `persistent`) in background — no second GUM
 * 4. On `ready` + `useVideoFrameReady`, swap display/publish to TRTC output
 * 5. Publish processed track via LiveKit replaceTrack
 *
 * Priority: DeepAR canvas → Tencent TRTC output → raw camera (only when TRTC absent).
 *
 * Used by: RoomLiveMediaSession (useLiveTrtcPipeline), ChatCallVideoEffectsHost (useChatCallTrtcPipeline).
 */
export {
  useLiveTrtcPipeline,
  type LiveTrtcPipelineState,
  isLiveTrtcConfigured,
} from './useLiveTrtcPipeline';

export {
  useLiveTrtcPipeline as useAppCameraPipeline,
  type LiveTrtcPipelineState as AppCameraPipelineState,
} from './useLiveTrtcPipeline';

export {
  isLiveVideoStream,
  resolveCameraReady,
  useTrtcCameraInput,
} from './trtcCameraPipeline';

export {
  WEBAR_CAMERA_IDEAL,
  WEBAR_CAMERA_FRAME_RATE,
  WEBAR_CAMERA_WIDTH,
  WEBAR_CAMERA_HEIGHT,
  WEBAR_OUTPUT_FPS,
} from '../webar/webarCameraConfig';

export { useStreamBeauty, karaokeFilterToBeautyId } from '../ar/useStreamBeauty';
export { useCameraStream, captureVideoFrame, type CameraFacingMode } from './useCameraStream';
export {
  acquireAppCamera,
  getAppCameraStream,
  releaseAppCamera,
  setAppCameraFacing,
  subscribeAppCamera,
} from './appCameraOwner';
export { useVideoFrameReady } from './useVideoFrameReady';
export { attachMediaStreamToVideo, bindMediaStreamToVideo, keepMediaStreamOnVideo } from './bindMediaStreamToVideo';
export { prepareProcessedVideoTrackForLiveKit, updateLiveKitLocalVideoTrack } from '../livekit/liveKitVideoPublish';
export { preloadTencentWebARModule, warmTencentWebARForVideoCall } from '../webar/useTencentWebAR';
