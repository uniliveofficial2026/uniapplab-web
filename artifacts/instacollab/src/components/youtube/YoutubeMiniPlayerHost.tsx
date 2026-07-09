import { YoutubeMiniPlayerFloating } from './YoutubeMiniPlayerFloating';
import { YoutubeMiniPlayerPicker } from './YoutubeMiniPlayerPicker';
import { useYoutubeMiniPlayer } from '../../hooks/useYoutubeMiniPlayer';
import { patchYoutubeMiniPlayerState } from '../../lib/youtubeMiniPlayer';

export function YoutubeMiniPlayerHost() {
  const state = useYoutubeMiniPlayer();

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
