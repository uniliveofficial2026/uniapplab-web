import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { CloudAuthProvider } from './contexts/CloudAuthContext';
import { AuthProvider } from './lib/AuthContext';
import { registerAppServiceWorker } from './lib/pwaRegister';
import { initSupabaseClient } from './lib/supabase/client';
import { initWalletKstarSyncListeners } from './lib/walletKstarSync';
import { initAppCloudSystems } from './lib/appCloudSystems';
import { initAppMediaStore } from './lib/appMediaStore';
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
import { unblockLivePresenceCloudQueries } from './lib/supabase/livePresenceGuard';
import { ensureBundledFirebaseConfig } from './lib/firebase/runtimeAuthConfig';

// Sync-only setup (no network / IDB waits).
bootstrapSupabaseAuthState();
ensureBundledFirebaseConfig();
// Clear stale circuit-breaker from older builds; liveDiscovery blocks only on real schema errors.
unblockLivePresenceCloudQueries();
bootstrapDocumentTheme();
installAppSafeArea();
installChunkLoadRecovery();
installPersistenceGuards();
installRuntimeGuards();
installAppSecurity();
installRuntimeSelfHeal();
initRuntimeAutoHeal();
initSupabaseResilience();
installUxTelemetry();
installNativeKeyboardPolicy();

// Instant media: hydrate app-media blobs from localStorage mirrors (feed/chat/k-star).
const scheduleBootMediaWarm = () => {
  void import('./lib/mediaInstant').then((m) => m.warmMediaFromLocalStorageMirrors());
};
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => scheduleBootMediaWarm(), { timeout: 4_000 });
} else {
  window.setTimeout(scheduleBootMediaWarm, 1_500);
}

// AR / DeepAR packages load when camera surfaces open — not on every boot.

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root');
}

// CRITICAL: paint React immediately. Never await network/IDB before first UI.
createRoot(rootEl).render(
  <ErrorBoundary>
    <CloudAuthProvider>
      <AuthProvider>
        <App />
        <SpeedInsights />
      </AuthProvider>
    </CloudAuthProvider>
  </ErrorBoundary>,
);

// Remove HTML boot shell once React has mounted.
queueMicrotask(() => {
  document.getElementById('boot-shell')?.remove();
});

// Background services — must not block first paint.
registerAppServiceWorker();
initWalletKstarSyncListeners();
initAppCloudSystems();
installPresenceHeartbeat();
clearChunkReloadGuard();

// Cache-first: local IDB paints UI, then live cloud syncs in background.
void import('./lib/cacheFirstSync').then((m) => m.startCacheFirstCloudSync());

void initSupabaseClient().then(() => {
  void import('./lib/preloadAppSurfaces').then((m) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => m.preloadCoreAppSurfaces(), { timeout: 5000 });
    } else {
      window.setTimeout(() => m.preloadCoreAppSurfaces(), 2000);
    }
  });
});

void import('./lib/firebase/app').then((m) => {
  m.getFirebaseApp();
});

// Media cache warm runs once at boot (initAppMediaStore) — not on every db.save.
void initAppMediaStore({ timeoutMs: 0 });
