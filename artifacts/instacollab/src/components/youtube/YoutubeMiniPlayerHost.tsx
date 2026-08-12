import { YoutubeMiniPlayerFloating } from './YoutubeMiniPlayerFloating';
import { YoutubeMiniPlayerPicker } from './YoutubeMiniPlayerPicker';
import { useYoutubeMiniPlayer } from '../../hooks/useYoutubeMiniPlayer';
import { patchYoutubeMiniPlayerState } from '../../lib/youtubeMiniPlayer';
import type { Tab } from '../../types';

type YoutubeMiniPlayerHostProps = {
  /** App shell tab — hide floating mini player on the full YouTube screen. */
  currentTab?: Tab | null;
};

export function YoutubeMiniPlayerHost({ currentTab = null }: YoutubeMiniPlayerHostProps) {
  const state = useYoutubeMiniPlayer();
  const hideFloating = currentTab === 'youtube';

  return (
    <>
      {hideFloating ? null : <YoutubeMiniPlayerFloating />}
      <YoutubeMiniPlayerPicker
        open={state.pickerOpen && !hideFloating}
        onClose={() => patchYoutubeMiniPlayerState({ pickerOpen: false })}
      />
    </>
  );
}
