/**
 * Capacitor plugin boot — safe no-op on web/PWA.
 */
import { Capacitor } from '@capacitor/core';
import { isNativeShell } from './nativeShell';
import { updateAppSafeArea } from './safeArea';

let booted = false;
const nativeUnsubs: Array<() => void> = [];

export async function bootNativeShell(): Promise<void> {
  if (booted || typeof window === 'undefined' || !isNativeShell()) return;
  booted = true;

  document.documentElement.dataset.nativeShell = Capacitor.getPlatform();
  document.documentElement.classList.add('native-shell');
  document.body?.classList.add('native-shell');

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Draw under the status bar; CSS safe-area insets keep chrome clear of notch/cutout.
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#020617' }).catch(() => undefined);
  } catch {
    /* plugin optional on web */
  }

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    // Body resize + safe-area update avoids keyboard covering inputs / bottom nav overflow.
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => undefined);
    const k1 = await Keyboard.addListener('keyboardWillShow', () => updateAppSafeArea());
    const k2 = await Keyboard.addListener('keyboardDidShow', () => updateAppSafeArea());
    const k3 = await Keyboard.addListener('keyboardWillHide', () => updateAppSafeArea());
    const k4 = await Keyboard.addListener('keyboardDidHide', () => updateAppSafeArea());
    nativeUnsubs.push(() => { void k1.remove(); void k2.remove(); void k3.remove(); void k4.remove(); });
  } catch {
    /* optional */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide().catch(() => undefined);
  } catch {
    /* optional */
  }

  try {
    const { App } = await import('@capacitor/app');
    const back = await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void App.exitApp();
      }
    });
    nativeUnsubs.push(() => { void back.remove(); });

    // After splash finished, Activity resume must not leave a stale shell.
    // Never interrupt an active ~5s play.
    const state = await App.addListener('appStateChange', ({ isActive }) => {
      void import('./camera/hostMediaSession').then((m) => {
        if (isActive) void m.resumeHostMedia();
        else void m.suspendHostMedia();
      });
      if (!isActive) return;
      void import('./bootSplashVideo').then(({ isBootSplashPlayActive, removeBootShell }) => {
        if (isBootSplashPlayActive()) return;
        void import('./splashSession').then(({ hasSeenSplashThisSession, hasSeenBootSplashOnDevice }) => {
          if (hasSeenSplashThisSession() || hasSeenBootSplashOnDevice()) removeBootShell();
        });
      });
    });

    // Google/Apple OAuth returns via com.uniapplab.unilive://auth/callback?code=…
    nativeUnsubs.push(() => { void state.remove(); });

    const urlOpen = await App.addListener('appUrlOpen', ({ url }) => {
      void import('./auth/nativeOAuth').then(({ handleNativeOAuthDeepLink }) => {
        void handleNativeOAuthDeepLink(url);
      });
    });
    nativeUnsubs.push(() => { void urlOpen.remove(); });

    // Cold start: app launched from OAuth deep link.
    const launch = await App.getLaunchUrl().catch(() => null);
    if (launch?.url) {
      const { handleNativeOAuthDeepLink } = await import('./auth/nativeOAuth');
      await handleNativeOAuthDeepLink(launch.url);
    }
  } catch {
    /* optional */
  }

  // Probe native incoming-call readiness (always not-ready until CallKit/Telecom lands).
  void import('./chat/nativeIncomingCallBridge').then((m) => {
    m.hydrateNativeIncomingCallFlagsFromEnv();
    m.assessNativeIncomingCallReadiness();
  }).catch(() => undefined);

  // Re-measure after StatusBar overlay settles (env(safe-area-*) becomes accurate).
  requestAnimationFrame(() => {
    updateAppSafeArea();
    window.setTimeout(updateAppSafeArea, 50);
    window.setTimeout(updateAppSafeArea, 250);
  });

  window.addEventListener(
    'pagehide',
    () => {
      nativeUnsubs.splice(0).forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      booted = false;
    },
    { once: true },
  );
}
