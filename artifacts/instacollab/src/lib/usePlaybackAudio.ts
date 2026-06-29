import { useSyncExternalStore } from 'react';
import { getActivePlaybackId, subscribePlayback } from './playbackAudio';

export function useActivePlaybackId(): string | null {
  return useSyncExternalStore(subscribePlayback, getActivePlaybackId, () => null);
}

export function useIsPlaybackActive(playbackId: string): boolean {
  const activeId = useActivePlaybackId();
  return activeId === playbackId;
}
