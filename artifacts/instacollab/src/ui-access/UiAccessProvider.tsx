import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { uiAccess } from './accessMapLoader';
import { getActiveSnapshot } from './activeSnapshot';
import type { ActiveUiSnapshot, UiAccess } from './types';

const Ctx = createContext<{ access: UiAccess; snapshot: ActiveUiSnapshot } | null>(null);

export function UiAccessProvider({ children }: { children: ReactNode }) {
  const snapshot = getActiveSnapshot();
  const value = useMemo(
    () => ({ access: uiAccess, snapshot }),
    [snapshot.snapshotId, snapshot.checksum],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiAccessContext() {
  return useContext(Ctx);
}
