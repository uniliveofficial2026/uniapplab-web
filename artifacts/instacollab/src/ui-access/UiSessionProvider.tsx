import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getActiveSession } from './activeSnapshot';
import type { ActiveUiSession } from './types';

const Ctx = createContext<ActiveUiSession | null>(null);

export function UiSessionProvider({ children }: { children: ReactNode }) {
  const session = useMemo(() => getActiveSession(), []);
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export function useUiSessionContext() {
  return useContext(Ctx);
}
