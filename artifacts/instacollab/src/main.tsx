import { createRoot } from 'react-dom/client';
import './lib/adminMirrorRole';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppQueryProvider } from './providers/AppQueryProvider';
import { AuthProvidersHost } from './providers/AuthProvidersHost';
import { AppViewportProvider } from './contexts/AppViewportContext';
import { PublicRuntimeConfigProvider } from './runtime-config/PublicRuntimeConfigProvider';
import { registerAppServiceWorker } from './lib/pwaRegister';
import { bootNativeShell } from './lib/bootNativeShell';
import { initSupabaseClient } from './lib/supabase/client';
import { initWalletKstarSyncListeners } from './lib/walletKstarSync';
import { initAppCloudSystems } from './lib/appCloudSystems';
import { initAppMediaStore, scheduleWarmAppMediaCache } from './lib/appMediaStore';
import { db } from './lib/db/localDb';
import { installPersistenceGuards } from './lib/persistSession';
import { bootstrapDocumentTheme } from './lib/theme';
import { clearChunkReloadGuard, installChunkLoadRecovery } from './lib/lazyWithRetry';
import { installRuntimeGuards } from './lib/runtimeGuards';
import { startThermalGovernor } from './lib/performance/thermalGovernor';
import { installRuntimeSelfHeal } from './lib/selfHeal';
import { initRuntimeAutoHeal } from './lib/runtimeAutoHeal';
import { initSupabaseResilience } from './lib/auth/supabaseResilience';
import { installUxTelemetry } from './lib/uxTelemetry';
import { installAppSecurity } from './lib/security/installAppSecurity';
import { installPresenceHeartbeat } from './lib/presenceHeartbeat';
import { installNativeKeyboardPolicy } from './lib/nativeKeyboardPolicy';
import { installAppSafeArea } from './lib/safeArea';
import { bootstrapSupabaseAuthState } from './lib/auth/providerState';
import { blockLivePresenceCloudQueries } from './lib/supabase/livePresenceGuard';
import { onAppShellReady } from './lib/appShellReady';
import { initAppBrandRuntime } from './lib/appBrandRuntime';
import { initAppAutopilot } from './lib/initAppAutopilot';
import { isAdminStudioEmbed } from './lib/adminStudioEmbed';
import { readSessionCache } from './lib/sessionCache';
import {
  clearSplashSeenThisSession,
  hasCompletedOnboardingOnDevice,
  hasSeenBootSplashOnDevice,
  markAuthGateThisSession,
  markOnboardingCompleteThisSession,
  markSplashSeenThisSession,
} from './lib/splashSession';
import {
  ensureBootSplashPlaying,
  isBrowserOnline,
  resetBootSplashWaitState,
  startBootSplashPlay,
} from './lib/bootSplashVideo';

/**
 * First video (`#boot-shell`) is for newcomers only.
 * Returning devices skip it; the second in-app loading video covers refresh / normal loads.
 */
if (typeof document !== 'undefined') {
  if (isAdminStudioEmbed()) {
    document.getElementById('boot-shell')?.remove();
    document.documentElement.classList.add('admin-live-embed');
    markSplashSeenThisSession();
    markOnboardingCompleteThisSession();
    markAuthGateThisSession();
  } else if (hasSeenBootSplashOnDevice()) {
    document.getElementById('boot-shell')?.remove();
    markSplashSeenThisSession();
    if (hasCompletedOnboardingOnDevice()) {
      markOnboardingCompleteThisSession();
    }
    if (readSessionCache()) {
      markOnboardingCompleteThisSession();
      markAuthGateThisSession();
    }
  } else if (document.getElementById('boot-shell')) {
    clearSplashSeenThisSession();
    resetBootSplashWaitState();
    const online = isBrowserOnline();
    ensureBootSplashPlaying({ loop: !online });
    startBootSplashPlay({
      isOnline: isBrowserOnline,
      isReady: () => true,
    });
  }
}

// Sync-only setup (no network / IDB waits).
bootstrapSupabaseAuthState();
// Firebase config/SDK loads only when AuthProvidersHost hydrates backup/legacy paths.
blockLivePresenceCloudQueries();
bootstrapDocumentTheme();
initAppBrandRuntime();
initAppAutopilot();
installAppSafeArea();
installChunkLoadRecovery();
installPersistenceGuards();
installRuntimeGuards();
startThermalGovernor();
// Clear stale Firestore multi-tab localStorage before any Firebase SDK touch —
// QuotaExceeded there previously crashed Karaoke via INTERNAL ASSERTION.
void import('./lib/firebase/app')
  .then((m) => {
    try {
      const probe = `__fs_boot_probe_${Date.now()}`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
    } catch {
      m.purgeFirestoreWebStorage();
      return;
    }
    let firestoreKeys = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && /^firestore_/i.test(key)) firestoreKeys += 1;
      }
    } catch {
      firestoreKeys = 99;
    }
    if (firestoreKeys >= 24) m.purgeFirestoreWebStorage();
  })
  .catch(() => {
    /* ignore */
  });
installAppSecurity();
installRuntimeSelfHeal();
initRuntimeAutoHeal();
initSupabaseResilience();
installUxTelemetry();
if (import.meta.env.DEV || import.meta.env.VITE_PERF_TRACE === '1') {
  void import('./lib/performance').then((m) => {
    m.installWebVitalsObserver();
    m.installLongTaskObserver();
  });
}
installNativeKeyboardPolicy();

// Instant media: hydrate app-media blobs from localStorage mirrors (feed/chat/k-star).
void import('./lib/mediaInstant').then((m) => m.warmMediaFromLocalStorageMirrors());

// AR / DeepAR / TRTC packages load when camera surfaces open — not on every boot.

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root');
}

const liveToolsProbe = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('live_tools_v13_probe')
  : null;

if (liveToolsProbe) {
  document.getElementById('boot-shell')?.remove();
  void import('./dev/LiveToolsV13VisualProbe').then((m) => m.mountLiveToolsV13Probe());
} else {
// CRITICAL: paint React immediately. Never await network/IDB before first UI.
createRoot(rootEl).render(
  <ErrorBoundary>
    <AppQueryProvider>
      <PublicRuntimeConfigProvider>
        <AuthProvidersHost>
          <AppViewportProvider>
            <App />
          </AppViewportProvider>
        </AuthProvidersHost>
      </PublicRuntimeConfigProvider>
    </AppQueryProvider>
  </ErrorBoundary>,
);
}

// Remove HTML boot shell once React has painted — never while ~5s play is active.
onAppShellReady(() => {
  void import('./lib/bootSplashVideo').then(({ isBootSplashPlayActive, removeBootShell, getBootShell }) => {
    if (isBootSplashPlayActive()) return;
    if (getBootShell() && sessionStorage.getItem('unilives_splash_seen_session') !== '1') return;
    removeBootShell();
  });
});
window.setTimeout(() => {
  void import('./lib/bootSplashVideo').then(({ isBootSplashPlayActive, removeBootShell }) => {
    if (isBootSplashPlayActive()) return;
    if (document.getElementById('root')?.childElementCount) removeBootShell();
  });
}, 20_000);


// Background services — must not block first paint.
void bootNativeShell();
registerAppServiceWorker();
initWalletKstarSyncListeners();

function scheduleDeferredBoot(fn: () => void, timeoutMs = 5_000): void {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback;
  if (ric) {
    ric(fn, { timeout: timeoutMs });
    return;
  }
  window.setTimeout(fn, Math.min(timeoutMs, 2_000));
}

scheduleDeferredBoot(() => {
  initAppCloudSystems();
  installPresenceHeartbeat();
}, 2_500);

clearChunkReloadGuard();

scheduleDeferredBoot(() => {
  void import('./lib/auth/identityDedupe').then(async (m) => {
  try {
    const result = await m.runLocalIdentitySecurityCleanup({
      users: db.users ?? [],
      currentUserId: db.currentUserId,
      save: (key, value) => db.save(key, value),
      deleteAccountSnapshot: (userId) => db.deleteAccountSnapshot(userId),
      whenStorageReady: () => db.whenStorageReady(),
    });
    if (result.removedUsers || result.collapsedDeviceAccounts || result.clearedLocalProfiles) {
      console.info('[security] identity purge', result);
    }
  } catch (err) {
    console.warn('[security] local identity purge failed', err);
  }
  try {
    const { isFirebaseConfigured } = await import('./lib/firebase/config');
    if (isFirebaseConfigured()) {
      const { dedupeFirebaseProfilePublicUserIds } = await import(
        './lib/firebase/dedupePublicUserIds'
      );
      const fb = await dedupeFirebaseProfilePublicUserIds();
      if (fb.deleted) console.info('[security] firebase identity purge', fb);
    }
  } catch (err) {
    console.warn('[security] firebase identity purge failed', err);
  }
  });
}, 6_000);

void import('./lib/instantUiBoot').then((m) => m.startInstantUiBoot());

// QA-only: temporal visual/animation probe (localStorage UNILIVE_QA_VISUAL=1 or ?qaVisual=1).
void import('./lib/qa/visualRuntimeProbe').then((m) => m.startQaVisualProbeLoop());

void import('./lib/cloudSocial/platformAppBrandCloud').then((m) => {
  m.bootstrapPlatformAppBrand();
});

// Cache-first: local IDB paints UI, then live cloud syncs in background.
void import('./lib/cacheFirstSync').then((m) => m.startCacheFirstCloudSync());

void initSupabaseClient().then(() => {
  const warm = () => {
    void import('./lib/preloadAppSurfaces').then((m) => m.preloadCoreAppSurfaces());
  };
  const idle = typeof window !== 'undefined' ? window.requestIdleCallback : undefined;
  if (typeof idle === 'function') {
    idle.call(window, warm, { timeout: 5_000 });
  } else {
    globalThis.setTimeout(warm, 1_500);
  }
});

// Media cache warm is best-effort and never blocks UI.
void initAppMediaStore({ timeoutMs: 0 });

db.subscribe(() => {
  scheduleWarmAppMediaCache();
});
