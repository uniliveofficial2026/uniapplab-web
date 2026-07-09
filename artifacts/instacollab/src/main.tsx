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
import { ensureBundledFirebaseConfig } from './lib/firebase/runtimeAuthConfig';
import { onAppShellReady } from './lib/appShellReady';
import { initAppBrandRuntime } from './lib/appBrandRuntime';
import { initAppAutopilot } from './lib/initAppAutopilot';

// Sync-only setup (no network / IDB waits).
bootstrapSupabaseAuthState();
ensureBundledFirebaseConfig();
blockLivePresenceCloudQueries();
bootstrapDocumentTheme();
initAppBrandRuntime();
initAppAutopilot();
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
void import('./lib/mediaInstant').then((m) => m.warmMediaFromLocalStorageMirrors());

// AR / DeepAR / TRTC packages load when camera surfaces open — not on every boot.

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

// Remove HTML boot shell once Shell has painted (not on first React commit).
onAppShellReady(() => {
  document.getElementById('boot-shell')?.remove();
});
window.setTimeout(() => {
  document.getElementById('boot-shell')?.remove();
}, 12_000);

// Background services — must not block first paint.
registerAppServiceWorker();
initWalletKstarSyncListeners();
initAppCloudSystems();
installPresenceHeartbeat();
clearChunkReloadGuard();

void import('./lib/instantUiBoot').then((m) => m.startInstantUiBoot());

void import('./lib/cloudSocial/platformAppBrandCloud').then((m) => {
  m.bootstrapPlatformAppBrand();
});

// Cache-first: local IDB paints UI, then live cloud syncs in background.
void import('./lib/cacheFirstSync').then((m) => m.startCacheFirstCloudSync());

void initSupabaseClient().then(() => {
  void import('./lib/preloadAppSurfaces').then((m) => m.preloadCoreAppSurfaces());
});

void import('./lib/firebase/app').then((m) => {
  m.getFirebaseApp();
});

// Media cache warm is best-effort and never blocks UI.
void initAppMediaStore({ timeoutMs: 0 });

db.subscribe(() => {
  scheduleWarmAppMediaCache();
});
