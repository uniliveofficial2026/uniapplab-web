import { useEffect, useReducer } from 'react';
import { useDB } from '../lib/useDB';
import { readLaunchRoute, type LaunchRoute } from '../lib/launchRoute';
import { LAUNCH_SESSION_EVENT } from '../lib/splashSession';

/** Re-read launch route when session funnel gates or db launch progress change. */
export function useLaunchRoute(): LaunchRoute {
  const db = useDB();
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const onLaunchSession = () => bump();
    window.addEventListener(LAUNCH_SESSION_EVENT, onLaunchSession);
    return () => window.removeEventListener(LAUNCH_SESSION_EVENT, onLaunchSession);
  }, []);

  return readLaunchRoute(db);
}
