/**
 * Cold-start launch funnel: splash → onboarding → auth.
 * First boot video and onboarding slides are device-once (newcomers only).
 * Session flags still gate auth until the user signs in this session.
 */
import { isAdminStudioEmbed } from './adminStudioEmbed';
const SPLASH_KEY = 'unilives_splash_seen_session';
const ONBOARDING_KEY = 'unilives_onboarding_seen_session';
const AUTH_KEY = 'unilives_auth_gate_seen_session';
/** Survives refresh / new tabs — first locked splash video plays once per device. */
export const DEVICE_BOOT_SPLASH_KEY = 'unilives_boot_splash_seen_device';
/** Survives refresh / logout — onboarding slides play once per device. */
export const DEVICE_ONBOARDING_KEY = 'unilives_onboarding_seen_device';
/** Legacy AuthScreen / ProfileSetup flag — keep in sync with DEVICE_ONBOARDING_KEY. */
export const LEGACY_ONBOARDED_KEY = 'instacollab_has_onboarded';
/** In-app loading clip — marked after play; refresh still replays (gate is per page load). */
export const DEVICE_INTRO_LOADING_KEY = 'unilives_intro_loading_seen_device';

export const LAUNCH_SESSION_EVENT = 'unilives:launch-session';
/** @deprecated use LAUNCH_SESSION_EVENT */
export const SPLASH_SESSION_EVENT = LAUNCH_SESSION_EVENT;

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function readLocalFlag(key: string, value = '1'): boolean {
  try {
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

function writeLocalFlag(key: string, value = '1'): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / unavailable */
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

export function hasSeenBootSplashOnDevice(): boolean {
  return readLocalFlag(DEVICE_BOOT_SPLASH_KEY);
}

export function markBootSplashSeenOnDevice(): void {
  writeLocalFlag(DEVICE_BOOT_SPLASH_KEY);
}

export function hasCompletedOnboardingOnDevice(): boolean {
  return readLocalFlag(DEVICE_ONBOARDING_KEY) || readLocalFlag(LEGACY_ONBOARDED_KEY, 'true');
}

export function markOnboardingSeenOnDevice(): void {
  writeLocalFlag(DEVICE_ONBOARDING_KEY);
  writeLocalFlag(LEGACY_ONBOARDED_KEY, 'true');
}

export function hasSeenIntroLoadingOnDevice(): boolean {
  return readLocalFlag(DEVICE_INTRO_LOADING_KEY);
}

export function markIntroLoadingSeenOnDevice(): void {
  writeLocalFlag(DEVICE_INTRO_LOADING_KEY);
}

export function hasSeenSplashThisSession(): boolean {
  return readSessionFlag(SPLASH_KEY) || hasSeenBootSplashOnDevice();
}

export function markSplashSeenThisSession(): void {
  markBootSplashSeenOnDevice();
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
  return readSessionFlag(ONBOARDING_KEY) || hasCompletedOnboardingOnDevice();
}

export function markOnboardingCompleteThisSession(): void {
  markOnboardingSeenOnDevice();
  writeFlag(ONBOARDING_KEY);
}

export function hasPassedAuthGateThisSession(): boolean {
  return readSessionFlag(AUTH_KEY);
}

export function markAuthGateThisSession(): void {
  writeFlag(AUTH_KEY);
}

/**
 * After login/signup: persist splash + onboarding so later sessions skip both.
 * Auth gate is session-only so logout can return to the sign-in screen.
 */
export function persistLaunchFunnelAfterAuth(): void {
  markSplashSeenThisSession();
  markOnboardingCompleteThisSession();
  markAuthGateThisSession();
}

/** True until splash → onboarding → auth have all been cleared for this session. */
export function isLaunchFunnelPendingThisSession(): boolean {
  if (isAdminStudioEmbed()) return false;
  return (
    !hasSeenSplashThisSession() ||
    !hasCompletedOnboardingThisSession() ||
    !hasPassedAuthGateThisSession()
  );
}
