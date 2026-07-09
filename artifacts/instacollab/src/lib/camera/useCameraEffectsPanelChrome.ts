import { useCameraChromeVisibility } from './useCameraChromeVisibility';

export function isCameraEffectsPanelOpen(...flags: Array<boolean | undefined>): boolean {
  return flags.some(Boolean);
}

export type UseCameraEffectsPanelChromeOptions = {
  enabled?: boolean;
  pinVisible?: boolean;
  beautyPanelOpen?: boolean;
  effectsPanelOpen?: boolean;
  /** Face AR / DeepAR panel (alias for effectsPanelOpen). */
  arPanelOpen?: boolean;
  autoHideMs?: number;
};

/** Hide screen chrome while beauty or AR trays are open; restore on close. */
export function useCameraEffectsPanelChrome({
  enabled = true,
  pinVisible = false,
  beautyPanelOpen = false,
  effectsPanelOpen = false,
  arPanelOpen = false,
  autoHideMs,
}: UseCameraEffectsPanelChromeOptions = {}) {
  const forceHidden = isCameraEffectsPanelOpen(
    beautyPanelOpen,
    effectsPanelOpen,
    arPanelOpen,
  );

  return useCameraChromeVisibility({
    enabled,
    pinVisible,
    forceHidden,
    autoHideMs,
  });
}
