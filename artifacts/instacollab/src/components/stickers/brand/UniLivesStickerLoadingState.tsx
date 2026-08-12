import React from 'react';
import { UniLivesSpinner } from '../../ui/Spinner';

export function UniLivesStickerLoadingState({
  label = 'Loading stickers…',
  className = 'flex flex-col items-center justify-center gap-2 py-6 text-xs text-white/60',
}: { label?: string; className?: string }) {
  return (
    <div className={className} data-unilives-sticker-loading="" role="status" aria-live="polite">
      <UniLivesSpinner className="h-5 w-5 border-white/30 border-t-white" />
      <span>{label}</span>
    </div>
  );
}
