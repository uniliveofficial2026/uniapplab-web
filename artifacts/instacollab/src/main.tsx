import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { CloudAuthProvider } from './contexts/CloudAuthContext';
import { AuthProvider } from './lib/AuthContext';
import { registerAppServiceWorker } from './lib/pwaRegister';

registerAppServiceWorker();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[app] unhandled rejection:', event.reason);
  });
}
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <CloudAuthProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </CloudAuthProvider>
    </ErrorBoundary>
  );
}
