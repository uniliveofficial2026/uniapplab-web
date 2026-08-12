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

/**
 * Launch funnel host.
 * Newcomer path: splash → onboarding → auth → profile_setup → trending → (main in App).
 * First video plays on splash only; second video is reserved for main-app loads.
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

  switch (route) {
    case 'splash':
      return <SplashScreen />;
    case 'onboarding':
      return <OnboardingScreen />;
    case 'auth':
      return <AuthScreen />;
    case 'profile_setup':
      return <ProfileSetupScreen />;
    case 'trending':
      return <TrendingScreen />;
    case 'banned':
      return <BannedScreen />;
    default:
      return null;
  }
}
