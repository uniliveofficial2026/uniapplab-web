import { Youtube } from 'lucide-react';
import {
  getYoutubeMiniPlayerState,
  openYoutubeMiniPlayerPicker,
  toggleYoutubeMiniPlayerMinimized,
} from '../../lib/youtubeMiniPlayer';
import { useYoutubeMiniPlayer } from '../../hooks/useYoutubeMiniPlayer';

export function RoomHeaderYoutubeMiniButton({ className = '' }: { className?: string }) {
  const state = useYoutubeMiniPlayer();
  const active = state.open && Boolean(state.videoId);

  return (
    <button
      type="button"
      onClick={() => {
        const current = getYoutubeMiniPlayerState();
        if (!current.videoId) {
          openYoutubeMiniPlayerPicker();
          return;
        }
        toggleYoutubeMiniPlayerMinimized();
      }}
      aria-label={active ? 'YouTube mini player' : 'Open YouTube mini player'}
      title={active ? 'YouTube mini player' : 'YouTube mini player'}
      className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border transition active:scale-90 ${
        active
          ? 'border-red-400/50 bg-red-500/20 text-red-100 hover:border-red-300/60 hover:bg-red-500/30'
          : 'border-white/10 bg-black/30 text-gray-300 hover:border-purple-400/40 hover:bg-purple-500/20 hover:text-purple-100'
      } ${className}`}
    >
      <Youtube size={16} aria-hidden />
    </button>
  );
}
