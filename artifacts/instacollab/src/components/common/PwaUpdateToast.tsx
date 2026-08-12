import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyPwaUpdate } from '../../lib/pwaRegister';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';

const IDLE_MS = 45_000;

/**
 * When a new service worker is waiting, show a restart toast only after the user
 * is idle (or when the tab was backgrounded) — never force a mid-session reload.
 */
export function PwaUpdateToast() {
  const [visible, setVisible] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    const clearIdle = () => {
      if (idleTimer.current != null) {
        window.clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    };

    const armIdle = () => {
      clearIdle();
      if (!pending.current || visible) return;
      idleTimer.current = window.setTimeout(() => {
        setVisible(true);
      }, IDLE_MS);
    };

    const onNeedRefresh = () => {
      pending.current = true;
      if (document.visibilityState === 'hidden') {
        setVisible(true);
        return;
      }
      armIdle();
    };

    const onActivity = () => {
      if (!pending.current || visible) return;
      armIdle();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && pending.current) {
        setVisible(true);
      }
    };

    window.addEventListener('pwa-need-refresh', onNeedRefresh);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);

    return () => {
      clearIdle();
      window.removeEventListener('pwa-need-refresh', onNeedRefresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-[calc(58px+var(--app-safe-bottom))] left-3 right-3 z-[121] md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Update ready</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A newer {APP_DISPLAY_NAME} build is ready. Restart to apply it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Dismiss update prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => applyPwaUpdate()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          Restart to update
        </button>
      </div>
    </div>
  );
}
