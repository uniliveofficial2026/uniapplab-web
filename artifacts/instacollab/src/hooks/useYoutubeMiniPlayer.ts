import { useEffect, useState } from 'react';
import {
  getYoutubeMiniPlayerState,
  initYoutubeMiniPlayerState,
  subscribeYoutubeMiniPlayer,
  type YoutubeMiniPlayerState,
} from '../lib/youtubeMiniPlayer';

export function useYoutubeMiniPlayer(): YoutubeMiniPlayerState {
  const [state, setState] = useState<YoutubeMiniPlayerState>(() => {
    initYoutubeMiniPlayerState();
    return getYoutubeMiniPlayerState();
  });

  useEffect(() => subscribeYoutubeMiniPlayer(setState), []);

  return state;
}
