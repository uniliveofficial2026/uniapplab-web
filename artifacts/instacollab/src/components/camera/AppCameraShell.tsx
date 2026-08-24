import type { ReactNode } from 'react';
import { ToastProvider } from '../../lib/ToastContext';
import { AppCameraProvider } from '../../contexts/AppCameraContext';
import { I18nProvider } from '../../lib/i18n/I18nContext';

/** Root shell: one locale + toast + one global fullscreen camera overlay. */
export function AppCameraShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppCameraProvider>{children}</AppCameraProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
