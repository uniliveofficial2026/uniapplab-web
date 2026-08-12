/**
 * Cold-start launch funnel: splash → onboarding → auth, once per JS session.
 * Persistent hasSeenSplash / hasCompletedOnboarding alone must not skip this path.
 */
const SPLASH_KEY = 'unilives_splash_seen_session';
const ONBOARDING_KEY = 'unilives_onboarding_seen_session';
const AUTH_KEY = 'unilives_auth_gate_seen_session';

export const LAUNCH_SESSION_EVENT = 'unilives:launch-session';
/** @deprecated use LAUNCH_SESSION_EVENT */
export const SPLASH_SESSION_EVENT = LAUNCH_SESSION_EVENT;

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* private mode / unavailable */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LAUNCH_SESSION_EVENT));
  }
}

export function hasSeenSplashThisSession(): boolean {
  return readFlag(SPLASH_KEY);
}

export function markSplashSeenThisSession(): void {
  writeFlag(SPLASH_KEY);
}

/** Clear splash gate for a new document that still has `#boot-shell` (must play video). */
export function clearSplashSeenThisSession(): void {
  try {
    sessionStorage.removeItem(SPLASH_KEY);
  } catch {
    /* private mode / unavailable */
  }
}

export function hasCompletedOnboardingThisSession(): boolean {
  return readFlag(ONBOARDING_KEY);
}

export function markOnboardingCompleteThisSession(): void {
  writeFlag(ONBOARDING_KEY);
}

export function hasPassedAuthGateThisSession(): boolean {
  return readFlag(AUTH_KEY);
}

export function markAuthGateThisSession(): void {
  writeFlag(AUTH_KEY);
}

/** True until splash → onboarding → auth have all been cleared for this session. */
export function isLaunchFunnelPendingThisSession(): boolean {
  return (
    !hasSeenSplashThisSession() ||
    !hasCompletedOnboardingThisSession() ||
    !hasPassedAuthGateThisSession()
  );
}
