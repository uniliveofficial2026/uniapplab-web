import React from 'react';
import { UniLivesSpinner } from '../../ui/Spinner';

type Props = {
  label?: string;
  className?: string;
};

export function UniLivesGiftLoadingState({
  label = 'Loading gifts…',
  className = 'flex flex-col items-center justify-center gap-2 py-6 text-xs text-white/60',
}: Props) {
  return (
    <div className={className} data-unilives-gift-loading="" role="status" aria-live="polite">
      <UniLivesSpinner className="h-5 w-5 border-white/30 border-t-white" />
      <span>{label}</span>
    </div>
  );
}
