/**
 * Live camera + TRTC beauty for party rooms — delegates to useLiveTrtcPipeline.
 * @see lib/camera/useLiveTrtcPipeline.ts
 */
export {
  useLiveTrtcPipeline as useMultiGuestCameraEffects,
  type LiveTrtcPipelineState as MultiGuestCameraEffectsState,
  type UseLiveTrtcPipelineOptions as UseMultiGuestCameraEffectsOptions,
} from '../../lib/camera/useLiveTrtcPipeline';
