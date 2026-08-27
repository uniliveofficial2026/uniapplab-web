import { useEffect } from 'react';
import { useCurrentUser } from '../lib/useCurrentUser';
import { hydrateWalletFromServer } from '../lib/walletCloud';
import { isCloudAuthUserId } from '../lib/auth/cloudProfile';
import { isPlatformApiAvailable } from '../lib/platformApi';

/** Keeps wallet surfaces synced with the server ledger while the tab is open. */
export function useWalletServerHydration(active = true): void {
  const appUser = useCurrentUser();

  useEffect(() => {
    if (!active) return;
    const id = appUser?.id?.trim();
    if (!id || id === 'unknown') return;
    if (!isPlatformApiAvailable() || !isCloudAuthUserId(id)) return;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void hydrateWalletFromServer(id);
    };

    run();
    const onWalletUpdated = () => run();
    window.addEventListener('wallet-coins-updated', onWalletUpdated);
    const timer = window.setInterval(run, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener('wallet-coins-updated', onWalletUpdated);
      window.clearInterval(timer);
    };
  }, [active, appUser?.id]);
}
