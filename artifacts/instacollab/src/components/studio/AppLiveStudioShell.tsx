import React, { useEffect, useState, type ReactNode } from 'react';
import { AdminUiPickOverlay } from '../admin/AdminUiPickOverlay';
import { AppLiveStudioPanel } from './AppLiveStudioPanel';
import type { AdminUiPickSelection } from '../../lib/adminUiPickProtocol';
import './app-live-studio.css';

type AppLiveStudioShellProps = {
  children: ReactNode;
};

/** Full-viewport real app + pick overlay + edit panel (not admin control plane UI). */
export function AppLiveStudioShell({ children }: AppLiveStudioShellProps) {
  const [pick, setPick] = useState<AdminUiPickSelection | null>(null);
  const [pickEnabled, setPickEnabled] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('app-live-studio-active');
    document.body.classList.add('app-live-studio-active');
    document.getElementById('boot-shell')?.remove();

    const params = new URLSearchParams(window.location.search);
    if (!params.get('launch') && !params.get('force_demo')) {
      params.set('force_demo', '1');
      params.set('launch', 'main');
      params.set('as', 'u1');
      const next = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(window.history.state, '', next);
    }

    return () => {
      document.documentElement.classList.remove('app-live-studio-active');
      document.body.classList.remove('app-live-studio-active');
    };
  }, []);

  return (
    <div className="app-live-studio" data-app-live-studio="">
      <div className="app-live-studio-app">
        {children}
        <AdminUiPickOverlay
          enabled={pickEnabled}
          mode="studio"
          onSelect={(selection) => setPick(selection)}
        />
      </div>
      <AppLiveStudioPanel
        pick={pick}
        pickEnabled={pickEnabled}
        onPickEnabledChange={setPickEnabled}
      />
    </div>
  );
}
