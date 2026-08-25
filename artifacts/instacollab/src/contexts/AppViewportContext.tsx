/**
 * Thin React bridge over the CSS/JS viewport SSOT in lib/safeArea.ts.
 * Do not add per-screen window.visualViewport listeners — subscribe here.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getAppViewportSnapshot,
  subscribeAppViewport,
  type AppViewportSnapshot,
} from '../lib/safeArea';

const AppViewportContext = createContext<AppViewportSnapshot>(
  getAppViewportSnapshot(),
);

export function AppViewportProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppViewportSnapshot>(() =>
    getAppViewportSnapshot(),
  );

  useEffect(() => subscribeAppViewport(setSnapshot), []);

  return (
    <AppViewportContext.Provider value={snapshot}>
      {children}
    </AppViewportContext.Provider>
  );
}

export function useAppViewport(): AppViewportSnapshot {
  return useContext(AppViewportContext);
}
