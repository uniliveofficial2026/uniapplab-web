import React from 'react';
import { ShareIcon } from '../../components/common/ShareIcon';

type RoomShareButtonProps = {
  onClick: () => void;
  className?: string;
};

export function RoomShareButton({ onClick, className = '' }: RoomShareButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Share room with users"
      aria-label="Share room with users"
      className={`group flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-gray-300 transition hover:border-indigo-500/40 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-90 ${className}`}
    >
      <ShareIcon size="room" tone="inherit" className="text-current group-hover:text-indigo-200" />
    </button>
  );
}
