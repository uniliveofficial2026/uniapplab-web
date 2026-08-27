import { useEffect } from 'react';
import { useCurrentUser } from '../lib/useCurrentUser';
import { hydrateWalletFromServer } from '../lib/walletCloud';
import { isCloudAuthUserId } from '../lib/auth/cloudProfile';
import { isPlatformApiAvailable } from '../lib/platformApi';
import { useCloudAuth } from '../contexts/cloudAuthStore';

/** Keeps wallet surfaces synced with the server ledger while the tab is open. */
export function useWalletServerHydration(active = true): void {
  const appUser = useCurrentUser();
  const { authReady } = useCloudAuth();

  useEffect(() => {
    if (!active || !authReady) return;
    const id = appUser?.id?.trim();
    if (!id || id === 'unknown') return;
    if (!isPlatformApiAvailable() || !isCloudAuthUserId(id)) return;

    let cancelled = false;
    const retryTimers: number[] = [];

    const run = () => {
      if (cancelled) return;
      void hydrateWalletFromServer(id);
    };

    run();
    // Auth bearer can lag first paint — retry until session + wallet pull succeed.
    for (const delayMs of [800, 2000, 5000]) {
      retryTimers.push(
        window.setTimeout(() => {
          if (!cancelled) run();
        }, delayMs),
      );
    }

    const onWalletUpdated = () => run();
    const onFocus = () => run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    window.addEventListener('wallet-coins-updated', onWalletUpdated);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(run, 30_000);

    return () => {
      cancelled = true;
      for (const t of retryTimers) window.clearTimeout(t);
      window.removeEventListener('wallet-coins-updated', onWalletUpdated);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [active, authReady, appUser?.id]);
}
