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
import { installPersistenceGuards } from './lib/persistSession';
import { bootstrapDocumentTheme } from './lib/theme';
import { clearChunkReloadGuard, installChunkLoadRecovery } from './lib/lazyWithRetry';

bootstrapDocumentTheme();
installChunkLoadRecovery();
registerAppServiceWorker();
initWalletKstarSyncListeners();
installPersistenceGuards();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[app] unhandled rejection:', event.reason);
  });
}

async function bootstrap() {
  await initSupabaseClient();
  clearChunkReloadGuard();

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
