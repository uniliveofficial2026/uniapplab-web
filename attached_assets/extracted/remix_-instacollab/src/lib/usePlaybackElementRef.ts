import { useCallback, type RefObject } from 'react';
import { PLAYBACK_SCOPE } from './playbackScope';
import {
  registerPlaybackElement,
  requestPlaybackReconcile,
} from './playbackAudio';

/** Binds a media element to the playback coordinator when it mounts (incl. portals). */
export function usePlaybackElementRef(
  playbackId: string,
  intentKey: string,
  mediaRef: RefObject<HTMLMediaElement | null>,
  wantsPlay: boolean
) {
  const setRef = useCallback(
    (el: HTMLMediaElement | null) => {
      if (mediaRef && 'current' in mediaRef) {
        (mediaRef as { current: HTMLMediaElement | null }).current = el;
      }
      if (el instanceof HTMLVideoElement) {
        el.dataset.playbackScope = PLAYBACK_SCOPE.MANAGED;
      }
      registerPlaybackElement(playbackId, intentKey, el);
      if (el && wantsPlay) {
        requestPlaybackReconcile();
      }
    },
    [playbackId, intentKey, mediaRef, wantsPlay]
  );

  return setRef;
}
