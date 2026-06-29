import { useDB } from '../lib/useDB';
import { readLaunchRoute, type LaunchRoute } from '../lib/launchRoute';

export function useLaunchRoute(): LaunchRoute {
  const db = useDB();
  return readLaunchRoute(db);
}
