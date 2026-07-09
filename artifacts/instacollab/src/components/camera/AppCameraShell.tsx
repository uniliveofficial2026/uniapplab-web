import type { ReactNode } from 'react';
import { ToastProvider } from '../../lib/ToastContext';
import { AppCameraProvider } from '../../contexts/AppCameraContext';

/** Root shell: toast + one global fullscreen camera overlay for the whole app. */
export function AppCameraShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppCameraProvider>{children}</AppCameraProvider>
    </ToastProvider>
  );
}
