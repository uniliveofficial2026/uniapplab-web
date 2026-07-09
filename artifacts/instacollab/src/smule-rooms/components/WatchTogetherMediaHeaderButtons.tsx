import { Link2, Upload, Youtube } from 'lucide-react';
import type { WatchTogetherMediaKind } from '../utils/watchTogetherMedia';

export type WatchTogetherMediaPanel = 'url' | 'youtube' | 'upload';

type WatchTogetherMediaHeaderButtonsProps = {
  activeKind?: WatchTogetherMediaKind;
  isCustom?: boolean;
  onOpenPanel: (panel: WatchTogetherMediaPanel) => void;
};

function headerBtnClass(active: boolean, accent: 'pink' | 'red' | 'cyan'): string {
  const accents = {
    pink: active
      ? 'border-pink-400/50 bg-pink-500/20 text-pink-100'
      : 'border-white/10 bg-black/30 text-gray-300 hover:border-pink-400/35 hover:bg-pink-500/10 hover:text-pink-100',
    red: active
      ? 'border-red-400/50 bg-red-500/20 text-red-100'
      : 'border-white/10 bg-black/30 text-gray-300 hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-100',
    cyan: active
      ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
      : 'border-white/10 bg-black/30 text-gray-300 hover:border-cyan-400/35 hover:bg-cyan-500/10 hover:text-cyan-100',
  };
  return `flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border transition active:scale-90 ${accents[accent]}`;
}

export function WatchTogetherMediaHeaderButtons({
  activeKind,
  isCustom = false,
  onOpenPanel,
}: WatchTogetherMediaHeaderButtonsProps) {
  const urlActive = isCustom && activeKind !== 'youtube' && activeKind !== undefined;
  const youtubeActive = activeKind === 'youtube';
  const uploadActive = false;

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      role="toolbar"
      aria-label="Change room media source"
    >
      <button
        type="button"
        onClick={() => onOpenPanel('url')}
        className={headerBtnClass(urlActive, 'pink')}
        title="Media URL"
        aria-label="Set media URL"
      >
        <Link2 size={15} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onOpenPanel('youtube')}
        className={headerBtnClass(youtubeActive, 'red')}
        title="YouTube"
        aria-label="Search YouTube"
      >
        <Youtube size={15} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onOpenPanel('upload')}
        className={headerBtnClass(uploadActive, 'cyan')}
        title="Upload video or audio"
        aria-label="Upload media file"
      >
        <Upload size={15} aria-hidden />
      </button>
    </div>
  );
}
