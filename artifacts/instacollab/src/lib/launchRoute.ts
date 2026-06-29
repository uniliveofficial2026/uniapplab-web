import type { LaunchProgress } from './dbTypes';
import type { LocalDB } from './db/localDbType';

export type LaunchRoute =
  | 'splash'
  | 'onboarding'
  | 'auth'
  | 'profile_setup'
  | 'trending'
  | 'main';

export function resolveLaunchRoute(
  progress: LaunchProgress,
  isLoggedIn: boolean
): LaunchRoute {
  if (!progress.hasSeenSplash) return 'splash';
  if (!progress.hasCompletedOnboarding) return 'onboarding';
  if (!isLoggedIn) return 'auth';
  if (!progress.profileSetupComplete) return 'profile_setup';
  if (!progress.hasSeenTrending) return 'trending';
  return 'main';
}

export function readLaunchRoute(db: LocalDB): LaunchRoute {
  return resolveLaunchRoute(db.getLaunchProgress(), db.isLoggedIn);
}
