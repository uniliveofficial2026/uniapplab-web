import React from 'react';

export function UniLivesSeatInteractionErrorState({
  message = 'Interaction media unavailable',
  onRetry,
  className = 'flex flex-col items-center justify-center gap-2 py-6 text-xs text-white/70',
}: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={className} data-unilives-seat-interaction-error="" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-bold text-white unilives-focus-ring">
          Retry
        </button>
      ) : null}
    </div>
  );
}
