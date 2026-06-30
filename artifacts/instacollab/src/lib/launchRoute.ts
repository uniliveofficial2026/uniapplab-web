import type { LaunchProgress } from './dbTypes';
import type { LocalDB } from './db/localDbType';

export type LaunchRoute =
  | 'splash'
  | 'onboarding'
  | 'auth'
  | 'profile_setup'
  | 'trending'
  | 'main';

/** Logged-in user who already finished profile and/or trending — skip marketing funnel. */
export function isReturningLaunchUser(progress: LaunchProgress, isLoggedIn: boolean): boolean {
  return isLoggedIn && (progress.profileSetupComplete || progress.hasSeenTrending);
}

export function resolveLaunchRoute(
  progress: LaunchProgress,
  isLoggedIn: boolean
): LaunchRoute {
  if (isReturningLaunchUser(progress, isLoggedIn)) return 'main';

  if (!progress.hasSeenSplash) return 'splash';
  if (!progress.hasCompletedOnboarding) return 'onboarding';
  if (!isLoggedIn) return 'auth';
  if (!progress.profileSetupComplete) return 'profile_setup';
  if (!progress.hasSeenTrending) return 'trending';
  return 'main';
}

/** After IDB restore — persist device splash/onboarding flags for returning sessions. */
export function healLaunchProgressForReturningUser(db: LocalDB): void {
  if (!db.isLoggedIn || !db.currentUserId) return;
  const progress = db.getLaunchProgress();
  if (!isReturningLaunchUser(progress, true)) return;
  if (!progress.hasSeenSplash) db.markSplashSeen();
  if (!progress.hasCompletedOnboarding) db.completeOnboarding();
}

export function readLaunchRoute(db: LocalDB): LaunchRoute {
  return resolveLaunchRoute(db.getLaunchProgress(), db.isLoggedIn);
}
