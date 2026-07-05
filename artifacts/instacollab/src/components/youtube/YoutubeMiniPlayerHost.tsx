import { YoutubeMiniPlayerFloating } from './YoutubeMiniPlayerFloating';
import { YoutubeMiniPlayerPicker } from './YoutubeMiniPlayerPicker';
import { useYoutubeMiniPlayer } from '../../hooks/useYoutubeMiniPlayer';
import { initYoutubeMiniPlayerState, patchYoutubeMiniPlayerState } from '../../lib/youtubeMiniPlayer';
import { useEffect } from 'react';

export function YoutubeMiniPlayerHost() {
  const state = useYoutubeMiniPlayer();

  useEffect(() => {
    initYoutubeMiniPlayerState();
  }, []);

  return (
    <>
      <YoutubeMiniPlayerFloating />
      <YoutubeMiniPlayerPicker
        open={state.pickerOpen}
        onClose={() => patchYoutubeMiniPlayerState({ pickerOpen: false })}
      />
    </>
  );
}
