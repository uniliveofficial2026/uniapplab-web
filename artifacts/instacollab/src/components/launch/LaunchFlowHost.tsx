import React, { useEffect, useLayoutEffect } from 'react';
import type { LaunchRoute } from '../../lib/launchRoute';
import { useDB } from '../../lib/useDB';
import { signalAppShellReady } from '../../lib/appShellReady';
import { forceRemoveBootShell } from '../../lib/bootSplashVideo';
import { SplashScreen } from './SplashScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { AuthScreen } from './AuthScreen';
import { ProfileSetupScreen } from './ProfileSetupScreen';
import { TrendingScreen } from './TrendingScreen';
import { BannedScreen } from '../auth/BannedScreen';
import { AppScreen } from '../layout/AppScreen';
import { ErrorBoundary } from '../common/ErrorBoundary';

/**
 * Launch funnel host.
 * Newcomer path: splash → onboarding → auth → profile_setup → trending → (main in App).
 * First video plays on splash only; second video is reserved for main-app loads.
 * Always edge-to-edge fullscreen with per-route error isolation.
 */
export function LaunchFlowHost({ route }: { route: LaunchRoute }) {
  const db = useDB();

  useLayoutEffect(() => {
    // First video is splash-only. Later funnel screens (profile setup, auth, …)
    // and Activity returns must never keep or replay it.
    if (route !== 'splash') {
      forceRemoveBootShell();
    }
    signalAppShellReady();
  }, [route]);

  useEffect(() => {
    void db.whenReady().then(() => db.ensureDemoAuthAccounts());
  }, [db]);

  let content: React.ReactNode = null;
  switch (route) {
    case 'splash':
      content = <SplashScreen />;
      break;
    case 'onboarding':
      content = <OnboardingScreen />;
      break;
    case 'auth':
      content = <AuthScreen />;
      break;
    case 'profile_setup':
      content = <ProfileSetupScreen />;
      break;
    case 'trending':
      content = <TrendingScreen />;
      break;
    case 'banned':
      content = <BannedScreen />;
      break;
    case 'main':
      content = null;
      break;
    default:
      content = null;
  }

  if (!content) return null;

  return (
    <AppScreen
      immersive
      className="h-vv max-h-vv w-full bg-background"
      data-testid={`launch-route-${route}`}
      data-launch-route={route}
    >
      <ErrorBoundary screen={`launch:${route}`}>{content}</ErrorBoundary>
    </AppScreen>
  );
}
