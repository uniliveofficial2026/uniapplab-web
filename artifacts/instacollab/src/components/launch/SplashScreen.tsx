import React, { useEffect, useRef } from 'react';
import { useDB } from '../../lib/useDB';
import { markSplashSeenThisSession } from '../../lib/splashSession';
import { useIsOnline } from '../../hooks/useNetworkStatus';
import {
  waitBootSplashUntilReady,
  dismissBootShellNow,
  ensureBootSplashPlaying,
  BOOT_SPLASH_MS,
} from '../../lib/bootSplashVideo';

/**
 * Boot splash host — first video plays full ~5s online.
 * Shell cannot be removed mid-play (that was the skip).
 */
export function SplashScreen() {
  const db = useDB();
  const isOnline = useIsOnline();
  const dbReadyRef = useRef(false);
  const onlineRef = useRef(isOnline);
  onlineRef.current = isOnline;
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(db.whenReady?.())
      .then(() => {
        if (!cancelled) dbReadyRef.current = true;
      })
      .catch(() => {
        if (!cancelled) dbReadyRef.current = true;
      });
    const t = window.setTimeout(() => {
      dbReadyRef.current = true;
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [db]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    ensureBootSplashPlaying({ loop: !onlineRef.current });

    waitBootSplashUntilReady(
      () => {
        markSplashSeenThisSession();
        try {
          db.markSplashSeen();
        } catch {
          /* ignore */
        }
        dismissBootShellNow();
      },
      {
        playMs: BOOT_SPLASH_MS,
        isReady: () => dbReadyRef.current,
        isOnline: () => onlineRef.current,
      },
    );
  }, [db]);

  return null;
}
