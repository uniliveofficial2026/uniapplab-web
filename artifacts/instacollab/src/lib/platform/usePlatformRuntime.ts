import { useEffect, useState } from 'react';
import {
  getPlatformRuntime,
  invalidatePlatformRuntime,
  type PlatformRuntime,
} from './runtime';

/** Live platform runtime for install / shell / media UI. */
export function usePlatformRuntime(): PlatformRuntime {
  const [runtime, setRuntime] = useState(() => getPlatformRuntime());

  useEffect(() => {
    const refresh = () => {
      invalidatePlatformRuntime();
      setRuntime(getPlatformRuntime());
    };

    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', refresh, { passive: true });
    const mqStandalone = window.matchMedia('(display-mode: standalone)');
    const mqFullscreen = window.matchMedia('(display-mode: fullscreen)');
    mqStandalone.addEventListener?.('change', refresh);
    mqFullscreen.addEventListener?.('change', refresh);

    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      mqStandalone.removeEventListener?.('change', refresh);
      mqFullscreen.removeEventListener?.('change', refresh);
    };
  }, []);

  return runtime;
}
