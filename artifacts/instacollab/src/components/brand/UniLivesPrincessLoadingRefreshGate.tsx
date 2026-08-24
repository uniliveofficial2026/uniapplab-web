import React, { useEffect, useState } from 'react';
import { useIsOnline } from '../../hooks/useNetworkStatus';
import { UniLivesPrincessLoadingRefreshLayout } from './UniLivesPrincessLoadingRefreshLayout';
import { PRINCESS_LOADING_REFRESH_DURATION_MS } from './princessLoadingRefreshAssets';
import {
  armFixedPlay,
  isFixedPlayActive,
  isFixedPlayDone,
  resetFixedPlay,
} from '../../lib/fixedPlay';
import { markIntroLoadingSeenOnDevice } from '../../lib/splashSession';

type Props = {
  /** Play the second video when true (main app entry). */
  enabled?: boolean;
};

const PLAY_MS = PRINCESS_LOADING_REFRESH_DURATION_MS;
/** Unique per document load — refresh remounts JS and gets a fresh key. */
const PLAY_KEY = `inapp-loading:main-entry:${typeof performance !== 'undefined' ? Math.floor(performance.timeOrigin) : Date.now()}`;

/** Survives React Strict Mode remounts — prevents cancel/restart skip. */
let mainEntryArmed = false;
let mainEntryVisible = false;
const visibilityListeners = new Set<(show: boolean) => void>();

function setMainEntryVisible(show: boolean) {
  mainEntryVisible = show;
  for (const fn of visibilityListeners) fn(show);
}

/**
 * In-app loading — full ~5s on every normal main load / refresh.
 * Module-level arm so Strict Mode / auth flicker cannot kill the play.
 * Does not use a device-once flag (that blocked refresh playback).
 */
export function UniLivesPrincessLoadingRefreshGate({ enabled = false }: Props) {
  const [showVideo, setShowVideo] = useState(mainEntryVisible && enabled);
  const isOnline = useIsOnline();

  useEffect(() => {
    const onVis = (show: boolean) => setShowVideo(Boolean(show && enabled));
    visibilityListeners.add(onVis);
    setShowVideo(Boolean(mainEntryVisible && enabled));
    return () => {
      visibilityListeners.delete(onVis);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      mainEntryArmed = false;
      setMainEntryVisible(false);
      resetFixedPlay(PLAY_KEY);
      return;
    }

    // Already finished for this document load — stay dismissed (SPA remounts).
    if (isFixedPlayDone(PLAY_KEY) && !isFixedPlayActive(PLAY_KEY)) {
      markIntroLoadingSeenOnDevice();
      setMainEntryVisible(false);
      return;
    }

    const onComplete = () => {
      mainEntryArmed = false;
      markIntroLoadingSeenOnDevice();
      setMainEntryVisible(false);
    };

    if (mainEntryArmed || isFixedPlayActive(PLAY_KEY)) {
      setMainEntryVisible(true);
      armFixedPlay({
        key: PLAY_KEY,
        playMs: PLAY_MS,
        onComplete,
      });
      return;
    }

    mainEntryArmed = true;
    setMainEntryVisible(true);
    armFixedPlay({
      key: PLAY_KEY,
      playMs: PLAY_MS,
      onComplete,
    });

    return () => undefined;
  }, [enabled]);

  if (!enabled || !showVideo) return null;

  return (
    <UniLivesPrincessLoadingRefreshLayout
      overlay
      loop={!isOnline}
      staticPoster={false}
      onVideoEnded={() => undefined}
      onVideoError={() => undefined}
    />
  );
}
