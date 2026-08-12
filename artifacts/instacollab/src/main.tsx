import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppQueryProvider } from './providers/AppQueryProvider';
import { AuthProvidersHost } from './providers/AuthProvidersHost';
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
import { clearSplashSeenThisSession } from './lib/splashSession';
import {
  ensureBootSplashPlaying,
  isBrowserOnline,
  resetBootSplashWaitState,
  startBootSplashPlay,
} from './lib/bootSplashVideo';

/**
 * `#boot-shell` in HTML = this document must play the first video ~5s.
 * Clear session splash flag so React stays on the splash route until it finishes.
 * (Do not strip the shell early — that was why the video kept skipping.)
 */
if (typeof document !== 'undefined' && document.getElementById('boot-shell')) {
  clearSplashSeenThisSession();
  resetBootSplashWaitState();
  const online = isBrowserOnline();
  ensureBootSplashPlaying({ loop: !online });
  startBootSplashPlay({
    isOnline: isBrowserOnline,
    isReady: () => true,
  });
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
installNativeKeyboardPolicy();

// Instant media: hydrate app-media blobs from localStorage mirrors (feed/chat/k-star).
void import('./lib/mediaInstant').then((m) => m.warmMediaFromLocalStorageMirrors());

// AR / DeepAR / TRTC packages load when camera surfaces open — not on every boot.

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root');
}

// CRITICAL: paint React immediately. Never await network/IDB before first UI.
createRoot(rootEl).render(
  <ErrorBoundary>
    <AppQueryProvider>
      <AuthProvidersHost>
        <App />
        <SpeedInsights />
      </AuthProvidersHost>
    </AppQueryProvider>
  </ErrorBoundary>,
);

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
initAppCloudSystems();
installPresenceHeartbeat();
clearChunkReloadGuard();

// Security: hard-purge same User ID across local accounts + device switcher rows.
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

void import('./lib/instantUiBoot').then((m) => m.startInstantUiBoot());

void import('./lib/cloudSocial/platformAppBrandCloud').then((m) => {
  m.bootstrapPlatformAppBrand();
});

// Cache-first: local IDB paints UI, then live cloud syncs in background.
void import('./lib/cacheFirstSync').then((m) => m.startCacheFirstCloudSync());

void initSupabaseClient().then(() => {
  void import('./lib/preloadAppSurfaces').then((m) => m.preloadCoreAppSurfaces());
});

// Media cache warm is best-effort and never blocks UI.
void initAppMediaStore({ timeoutMs: 0 });

db.subscribe(() => {
  scheduleWarmAppMediaCache();
});
