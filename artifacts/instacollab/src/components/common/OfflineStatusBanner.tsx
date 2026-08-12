import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

type OfflineStatusBannerProps = {
  /** When true, banner sits below mobile top nav (main shell). */
  insetBelowNav?: boolean;
};

/**
 * Non-blocking offline indicator — never covers or replaces app UI.
 * Shell, tabs, and local content stay fully interactive underneath.
 */
export function OfflineStatusBanner({ insetBelowNav = false }: OfflineStatusBannerProps) {
  const network = useNetworkStatus();
  if (network === 'online') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-3 ${
        insetBelowNav ? 'top-[calc(var(--app-safe-top)+3.25rem)]' : 'top-[max(var(--app-safe-top),0.5rem)]'
      }`}
    >
      <div className="pointer-events-none flex max-w-md items-center gap-2 rounded-[var(--radius-unilives-pill)] border border-[color:var(--color-unilives-warning)]/30 bg-[color:var(--color-unilives-warning)]/15 px-3.5 py-2 text-[12px] font-semibold text-[color:var(--color-unilives-text)] shadow-[var(--shadow-unilives-md)] backdrop-blur-md">
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Offline — all saved UI stays available. Syncs when you reconnect.</span>
      </div>
    </div>
  );
}
