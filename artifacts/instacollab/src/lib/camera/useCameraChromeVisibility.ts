import { useCallback, useEffect, useRef, useState } from 'react';

export type UseCameraChromeVisibilityOptions = {
  /** Enable auto-hide / tap toggle. */
  enabled?: boolean;
  /** Keep chrome visible (connecting, errors, etc.). */
  pinVisible?: boolean;
  /** Hide chrome while beauty / AR panels are open. */
  forceHidden?: boolean;
  autoHideMs?: number;
};

/** Auto-hide camera chrome; hide immediately when beauty/AR panels open. */
export function useCameraChromeVisibility({
  enabled = true,
  pinVisible = false,
  forceHidden = false,
  autoHideMs = 4000,
}: UseCameraChromeVisibilityOptions = {}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);
  const prevForceHiddenRef = useRef(forceHidden);

  const clearHideTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!enabled || pinVisible || forceHidden) return;
    timerRef.current = window.setTimeout(() => setVisible(false), autoHideMs);
  }, [autoHideMs, clearHideTimer, enabled, forceHidden, pinVisible]);

  const revealControls = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const hideControls = useCallback(() => {
    clearHideTimer();
    setVisible(false);
  }, [clearHideTimer]);

  const toggleControls = useCallback(() => {
    setVisible((prev) => {
      if (prev) {
        clearHideTimer();
        return false;
      }
      scheduleHide();
      return true;
    });
  }, [clearHideTimer, scheduleHide]);

  const handleStageTap = useCallback(() => {
    if (pinVisible) {
      revealControls();
      return;
    }
    toggleControls();
  }, [pinVisible, revealControls, toggleControls]);

  const bumpControls = useCallback(() => {
    revealControls();
  }, [revealControls]);

  useEffect(() => {
    const wasForceHidden = prevForceHiddenRef.current;
    prevForceHiddenRef.current = forceHidden;

    if (!enabled) {
      clearHideTimer();
      setVisible(true);
      return;
    }
    if (forceHidden) {
      clearHideTimer();
      return;
    }
    if (wasForceHidden) {
      setVisible(true);
      if (!pinVisible) scheduleHide();
    }
    if (pinVisible) {
      clearHideTimer();
      setVisible(true);
      return;
    }
    if (visible) scheduleHide();
    return clearHideTimer;
  }, [clearHideTimer, enabled, forceHidden, pinVisible, scheduleHide, visible]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const controlsVisible = (!enabled || pinVisible || visible) && !forceHidden;

  return {
    controlsVisible,
    revealControls,
    hideControls,
    toggleControls,
    bumpControls,
    handleStageTap,
  };
}
