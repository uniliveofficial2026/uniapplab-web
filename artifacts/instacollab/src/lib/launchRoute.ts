import type { LaunchProgress } from './dbTypes';
import type { LocalDB } from './db/localDbType';
import { shouldSkipLaunchFunnelForDemoBootstrap } from './devSessionUser';
import {
  hasCompletedOnboardingThisSession,
  hasPassedAuthGateThisSession,
  hasSeenSplashThisSession,
} from './splashSession';

export type LaunchRoute =
  | 'splash'
  | 'onboarding'
  | 'auth'
  | 'profile_setup'
  | 'trending'
  | 'banned'
  | 'main';

/** Logged-in user who already finished legal + profile and/or trending — skip marketing funnel. */
export function isReturningLaunchUser(progress: LaunchProgress, isLoggedIn: boolean): boolean {
  return (
    isLoggedIn &&
    progress.legalAgreementAccepted === true &&
    (progress.profileSetupComplete || progress.hasSeenTrending)
  );
}

export function isUserBanned(db: LocalDB): boolean {
  const me = db.currentUser;
  return Boolean(me?.bannedAt && me.bannedAt > 0);
}

export function resolveLaunchRoute(
  progress: LaunchProgress,
  isLoggedIn: boolean,
  db?: LocalDB,
): LaunchRoute {
  if (db && isLoggedIn && isUserBanned(db)) return 'banned';

  if (shouldSkipLaunchFunnelForDemoBootstrap()) return 'main';

  // Cold-start session gates (every open): splash → onboarding → auth.
  // First video (boot splash) plays on `splash`.
  if (!hasSeenSplashThisSession()) return 'splash';
  if (!hasCompletedOnboardingThisSession()) return 'onboarding';
  if (!hasPassedAuthGateThisSession()) return 'auth';

  // Returning users → main (second video only for in-app loads there).
  if (isReturningLaunchUser(progress, isLoggedIn)) return 'main';

  // Newcomer after auth: profile creation → trending → main.
  if (!progress.hasCompletedOnboarding) return 'onboarding';
  if (!isLoggedIn) return 'auth';
  if (!progress.legalAgreementAccepted || !progress.profileSetupComplete) return 'profile_setup';
  if (!progress.hasSeenTrending) return 'trending';
  return 'main';
}

/** After IDB restore — persist device onboarding flags for returning sessions. */
export function healLaunchProgressForReturningUser(db: LocalDB): void {
  if (!db.isLoggedIn || !db.currentUserId) return;
  const progress = db.getLaunchProgress();
  if (!isReturningLaunchUser(progress, true)) return;
  // Do not clear the session funnel — splash/onboarding/auth still play once per open.
  if (!progress.hasCompletedOnboarding) db.completeOnboarding();
}

export function readLaunchRoute(db: LocalDB): LaunchRoute {
  return resolveLaunchRoute(db.getLaunchProgress(), db.isLoggedIn, db);
}
