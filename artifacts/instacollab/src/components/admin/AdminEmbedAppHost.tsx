import React, { useEffect, type ReactNode } from 'react';
import { AdminUiPickOverlay } from './AdminUiPickOverlay';
import { startAdminMirrorSync } from '../../lib/adminMirrorSync';
import './admin-embed-app.css';

type AdminEmbedAppShellProps = {
  pickMode?: boolean;
  children: ReactNode;
};

/** Viewport + pick overlay wrapper for admin live UI editor iframe. */
export function AdminEmbedAppShell({ pickMode = true, children }: AdminEmbedAppShellProps) {
  useEffect(() => {
    document.documentElement.classList.add('admin-embed-app-active');
    document.body.classList.add('admin-embed-app-active');
    document.getElementById('boot-shell')?.remove();
    // Live twin lockstep (primary left canvas ↔ Inspect mirror iframe).
    const stopSync = startAdminMirrorSync();
    return () => {
      stopSync();
      document.documentElement.classList.remove('admin-embed-app-active');
      document.body.classList.remove('admin-embed-app-active');
    };
  }, []);

  return (
    <div className="admin-embed-app-root" data-admin-embed-app="">
      {children}
      <AdminUiPickOverlay enabled={pickMode} />
    </div>
  );
}
