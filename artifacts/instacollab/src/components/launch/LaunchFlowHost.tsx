import React, { useEffect } from 'react';
import type { LaunchRoute } from '../../lib/launchRoute';
import { useDB } from '../../lib/useDB';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import { SplashScreen } from './SplashScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { AuthScreen } from './AuthScreen';
import { ProfileSetupScreen } from './ProfileSetupScreen';
import { TrendingScreen } from './TrendingScreen';

export function LaunchFlowHost({ route }: { route: LaunchRoute }) {
  const db = useDB();

  useEffect(() => {
    if (isCloudAuthConfigured()) return;
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
    default:
      return null;
  }
}
