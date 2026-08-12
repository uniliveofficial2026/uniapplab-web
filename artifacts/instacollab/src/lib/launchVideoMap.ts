/**
 * UniLive’s launch video mapping
 *
 * Newcomer path (first video = boot splash at start):
 *   splash → onboarding → auth → profile_setup → trending → main
 *
 * Returning users (after session splash → onboarding → auth):
 *   → main
 *
 * Second video = in-app loading only inside `main` (never during funnel).
 */

import type { LaunchRoute } from './launchRoute';
import { PRINCESS_BOOT_SPLASH_LOCKED_VIDEO_SRC } from '../components/brand/princessBootSplashAssets';
import { PRINCESS_INAPP_LOADING_LOCKED_VIDEO_SRC } from '../components/brand/princessLoadingRefreshAssets';

export type LaunchVideoKind = 'boot-splash' | 'inapp-loading' | 'none';

/** Ordered newcomer funnel after cold-start session splash/onboarding/auth. */
export const NEWCOMER_POST_AUTH_STEPS: LaunchRoute[] = [
  'profile_setup',
  'trending',
  'main',
];

/** Full newcomer journey including session gates. */
export const NEWCOMER_FULL_FLOW: LaunchRoute[] = [
  'splash',
  'onboarding',
  'auth',
  'profile_setup',
  'trending',
  'main',
];

export const BOOT_SPLASH_VIDEO_SRC = PRINCESS_BOOT_SPLASH_LOCKED_VIDEO_SRC;
export const INAPP_LOADING_VIDEO_SRC = PRINCESS_INAPP_LOADING_LOCKED_VIDEO_SRC;

/**
 * Which video belongs to this launch route.
 * - splash only: first boot video
 * - onboarding / auth / profile_setup / trending: no launch video
 * - main: second in-app loading video
 */
export function launchVideoKindForRoute(route: LaunchRoute): LaunchVideoKind {
  switch (route) {
    case 'splash':
      return 'boot-splash';
    case 'main':
      return 'inapp-loading';
    case 'onboarding':
    case 'auth':
    case 'profile_setup':
    case 'trending':
    case 'banned':
    default:
      return 'none';
  }
}

/** True once the user is past the newcomer funnel and inside the main app. */
export function isInsideMainApp(route: LaunchRoute): boolean {
  return route === 'main';
}

/** Second video may play only here (slow in-app loads; skipped if instant). */
export function shouldUseInAppLoadVideo(route: LaunchRoute): boolean {
  return launchVideoKindForRoute(route) === 'inapp-loading';
}

/** First video plays on cold-start boot splash (start of newcomer / session funnel). */
export function shouldPlayBootSplashVideo(route: LaunchRoute): boolean {
  return route === 'splash';
}
