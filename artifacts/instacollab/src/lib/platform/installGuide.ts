/**
 * Platform-aware install copy for PWA home-screen / desktop install.
 */
import {
  getPlatformRuntime,
  type PlatformOs,
  type PlatformRuntime,
} from './runtime';
import {
  getIosInstallInstructions,
  isIosChrome,
  isPwaInstallableHost,
  isPrivateDevHost,
  isStandaloneDisplayMode,
} from '../pwaRegister';
import { APP_DISPLAY_NAME } from '../appBrand';

export type InstallGuide = {
  title: string;
  body: string;
  steps?: string;
  note?: string;
  /** Primary CTA label */
  cta: string;
  /** Show Share → Add to Home Screen expandable steps */
  showAppleSteps: boolean;
};

export function getInstallGuide(runtime: PlatformRuntime = getPlatformRuntime()): InstallGuide {
  const { os, form, capabilities } = runtime;

  if (os === 'ios') {
    const ios = getIosInstallInstructions();
    return {
      title: 'Install on iPhone / iPad',
      body: `Add ${APP_DISPLAY_NAME} to your Home Screen for a full-screen app experience.`,
      steps: ios.steps,
      note: ios.note,
      cta: isIosChrome() ? 'Show install steps' : 'Install steps',
      showAppleSteps: true,
    };
  }

  if (os === 'android') {
    return {
      title: 'Install on Android',
      body: `Install ${APP_DISPLAY_NAME} for quicker launch and a full-screen app window.`,
      cta: 'Install app',
      showAppleSteps: false,
    };
  }

  if (os === 'windows') {
    return {
      title: 'Install on Windows',
      body: `Install ${APP_DISPLAY_NAME} from the browser for a desktop app window (Chrome or Edge).`,
      cta: 'Install app',
      showAppleSteps: false,
      note: capabilities.supportsBeforeInstallPrompt
        ? undefined
        : 'If Install is unavailable, open the browser menu → Apps → Install this site as an app.',
    };
  }

  if (os === 'mac') {
    return {
      title: 'Install on Mac',
      body: `Install ${APP_DISPLAY_NAME} from Chrome or Edge for a desktop app window. Safari uses File → Add to Dock on newer macOS.`,
      cta: 'Install app',
      showAppleSteps: false,
      note: capabilities.supportsBeforeInstallPrompt
        ? undefined
        : 'In Safari: File → Add to Dock. In Chrome/Edge: use Install app when offered.',
    };
  }

  return {
    title: form === 'desktop' ? 'Install desktop app' : 'Install app',
    body: `Add ${APP_DISPLAY_NAME} to your device for a full-screen app experience.`,
    cta: 'Install app',
    showAppleSteps: capabilities.usesAppleInstallHints,
  };
}

export function shouldShowInstallBanner(runtime: PlatformRuntime = getPlatformRuntime()): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandaloneDisplayMode() || runtime.shell === 'standalone_pwa' || runtime.shell === 'native') return false;
  if (!isPwaInstallableHost()) return false;
  return runtime.capabilities.canInstallPwa || runtime.capabilities.usesAppleInstallHints;
}

export function shouldShowPrivateDevIosHint(runtime: PlatformRuntime = getPlatformRuntime()): boolean {
  if (typeof window === 'undefined') return false;
  if (runtime.shell === 'standalone_pwa' || runtime.shell === 'native') return false;
  return runtime.os === 'ios' && isPrivateDevHost(window.location.hostname);
}

export function osLabel(os: PlatformOs): string {
  switch (os) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'mac':
      return 'Mac';
    case 'windows':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return 'this device';
  }
}
