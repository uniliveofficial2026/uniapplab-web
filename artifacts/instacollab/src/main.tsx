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
import { initLiveSessionSync } from './lib/liveSessionSync';
import { initThoughtNoteLiveSync } from './lib/thoughtNoteLiveSync';
import { initAppMediaStore, scheduleWarmAppMediaCache } from './lib/appMediaStore';
import { db } from './lib/db/localDb';
import { installPersistenceGuards } from './lib/persistSession';
import { bootstrapDocumentTheme } from './lib/theme';
import { clearChunkReloadGuard, installChunkLoadRecovery } from './lib/lazyWithRetry';
import { installRuntimeGuards } from './lib/runtimeGuards';

bootstrapDocumentTheme();
installChunkLoadRecovery();
registerAppServiceWorker();
initWalletKstarSyncListeners();
initLiveSessionSync();
initThoughtNoteLiveSync();
installPersistenceGuards();
installRuntimeGuards();

async function bootstrap() {
  await initSupabaseClient();
  await initAppMediaStore();
  clearChunkReloadGuard();

  db.subscribe(() => {
    scheduleWarmAppMediaCache();
  });

  const rootEl = document.getElementById('root');
  if (!rootEl) return;

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
}

void bootstrap();
