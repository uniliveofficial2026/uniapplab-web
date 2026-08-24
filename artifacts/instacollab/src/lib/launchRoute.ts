import type { LaunchProgress } from './dbTypes';
import type { LocalDB } from './db/localDbType';
import { isAdminStudioEmbed } from './adminStudioEmbed';
import { shouldSkipLaunchFunnelForDemoBootstrap } from './devSessionUser';
import {
  hasCompletedOnboardingThisSession,
  hasPassedAuthGateThisSession,
  hasSeenSplashThisSession,
  markOnboardingCompleteThisSession,
  markSplashSeenThisSession,
  persistLaunchFunnelAfterAuth,
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

  if (isAdminStudioEmbed() || shouldSkipLaunchFunnelForDemoBootstrap()) return 'main';

  // Completed accounts skip marketing funnel even if this session's flags were cleared (logout / new tab).
  if (isReturningLaunchUser(progress, isLoggedIn)) return 'main';

  // First locked video: newcomers only (never replayed after device splash).
  if (!hasSeenSplashThisSession() && !progress.hasSeenSplash) return 'splash';
  if (!hasCompletedOnboardingThisSession() && !progress.hasCompletedOnboarding) return 'onboarding';
  if (!isLoggedIn) return 'auth';
  if (!hasPassedAuthGateThisSession()) return 'auth';

  // Newcomer after auth: profile creation → trending → main.
  if (!progress.hasCompletedOnboarding && !hasCompletedOnboardingThisSession()) return 'onboarding';
  if (!progress.legalAgreementAccepted || !progress.profileSetupComplete) return 'profile_setup';
  if (!progress.hasSeenTrending) return 'trending';
  return 'main';
}

/** After IDB restore — persist device onboarding flags for returning sessions. */
export function healLaunchProgressForReturningUser(db: LocalDB): void {
  const progress = db.getLaunchProgress();
  // Migrate IndexedDB completion onto device localStorage so later cold starts skip the funnel.
  if (progress.hasSeenSplash) markSplashSeenThisSession();
  if (progress.hasCompletedOnboarding) markOnboardingCompleteThisSession();

  if (!db.isLoggedIn || !db.currentUserId) return;
  if (!isReturningLaunchUser(progress, true)) return;
  persistLaunchFunnelAfterAuth();
  if (!progress.hasCompletedOnboarding) db.completeOnboarding();
}

export function readLaunchRoute(db: LocalDB): LaunchRoute {
  return resolveLaunchRoute(db.getLaunchProgress(), db.isLoggedIn, db);
}
