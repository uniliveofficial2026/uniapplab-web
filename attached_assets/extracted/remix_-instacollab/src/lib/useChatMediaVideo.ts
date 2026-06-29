import { useCallback, useEffect, type RefObject } from 'react';
import {
  beginChatMediaPlayback,
  registerChatMediaPlayer,
} from './chatMediaPlayback';

/** Register an inline `<video>` with the messages single-playback coordinator. */
export function useChatMediaVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled = true
) {
  const pauseSelf = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);

  useEffect(() => {
    if (!enabled) return;
    return registerChatMediaPlayer(pauseSelf);
  }, [pauseSelf, enabled]);

  const onPlay = useCallback(() => {
    beginChatMediaPlayback(pauseSelf);
  }, [pauseSelf]);

  const onBeforeAutoplay = onPlay;

  return { onPlay, onBeforeAutoplay, pauseSelf };
}
