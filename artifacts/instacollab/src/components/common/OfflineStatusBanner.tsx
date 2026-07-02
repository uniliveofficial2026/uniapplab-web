import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

type OfflineStatusBannerProps = {
  /** When true, banner sits below mobile top nav (main shell). */
  insetBelowNav?: boolean;
};

/**
 * Non-blocking offline indicator — app UI stays visible; explains limited connectivity.
 */
export function OfflineStatusBanner({ insetBelowNav = false }: OfflineStatusBannerProps) {
  const network = useNetworkStatus();
  if (network === 'online') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-[200] flex justify-center px-3 ${
        insetBelowNav ? 'top-[calc(env(safe-area-inset-top)+3.25rem)]' : 'top-[max(env(safe-area-inset-top),0.5rem)]'
      }`}
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3.5 py-2 text-[12px] font-semibold text-amber-950 shadow-lg backdrop-blur-md dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100">
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Offline — viewing your saved content. Changes sync when you reconnect.</span>
      </div>
    </div>
  );
}
