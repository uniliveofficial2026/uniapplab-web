/**
 * UniLive’s UI access runtime.
 * Human edits live in config/ui-catalog/. Generated files are not the edit location.
 */
export { uiAccess, listAccessExperiences } from './accessMapLoader';
export { UiAccessProvider, useUiAccessContext } from './UiAccessProvider';
export { UiSessionProvider, useUiSessionContext } from './UiSessionProvider';
export { resolveExperience } from './experienceResolver';
export { resolveNode } from './nodeResolver';
export { resolveComponent } from './componentResolver';
export { resolveElement } from './elementResolver';
export { resolveLayout } from './layoutResolver';
export { resolveAsset } from './assetResolver';
export { resolveTheme } from './themeResolver';
export { resolveTokens } from './tokenResolver';
export { resolveMotion } from './motionResolver';
export { resolveAction } from './actionResolver';
export { resolveBinding } from './bindingResolver';
export { resolveTranslationKey } from './translationResolver';
export { resolveAccessibility } from './accessibilityResolver';
export { resolveFallbackSnapshot } from './fallbackResolver';
export { resolveContract } from './contractResolver';
export { resolveContent } from './contentResolver';
export { applyNodeOverride, independenceProof } from './nodeOverride';
export { assertSafeUiJson } from './schemas';
export { CALL_UI_CONTRACT_ID } from '../presentation/calls/callSurfaceContract';
export { useUiExperience } from './hooks/useUiExperience';
export { useUiSession } from './hooks/useUiSession';
export { useUiSnapshot } from './hooks/useUiSnapshot';
export { useUiNode } from './hooks/useUiNode';
export { useUiComponent } from './hooks/useUiComponent';
export { useUiElement } from './hooks/useUiElement';
export { useUiLayout } from './hooks/useUiLayout';
export { useUiAsset } from './hooks/useUiAsset';
export { useUiTheme } from './hooks/useUiTheme';
export { useUiTokens } from './hooks/useUiTokens';
export { useUiMotion } from './hooks/useUiMotion';
export { useUiAction } from './hooks/useUiAction';
export type { UiAccess, ActiveUiSession, ActiveUiSnapshot, ResolvedExperience, ResolvedUiNode } from './types';
export { RuntimeBundleProvider, useRuntimeBundle } from './runtime/RuntimeBundleProvider';
export { detectCapability, selectTier } from './runtime/capabilityProfile';
export { EffectScheduler } from './effects/EffectScheduler';
export { resolveGiftRenderer } from './renderers/giftRendererRegistry';
export { resolveFaceEffectRenderer, faceEffectFailureFallback } from './renderers/faceEffectRendererRegistry';
export { resolveAnimationRenderer } from './renderers/animationRendererRegistry';
export {
  LIVE_EXPERIENCE_IDS,
  isLiveExperienceId,
  liveInstanceKey,
  listLiveExperiences,
  getLiveExperience,
  liveExperienceForCanonicalRoomType,
  listLiveNodes,
  getLiveNode,
  listLiveLayouts,
  listLiveActions,
  listLiveBindings,
  resolveLiveExperience,
  resolveLiveExperienceSnapshot,
  applyPendingLiveSnapshot,
  canApplyStructuralLiveUpdate,
  fallbackLiveSnapshot,
  validateLiveManifest,
  publishedLiveRuntimeBundle,
  LiveRoomKernel,
  LiveExperienceHost,
  LiveRoomPresentationTree,
  liveKernelMustNotRemount,
  assertLiveActionCompatible,
  assertLiveBindingCompatible,
} from './live';

