import { createContext, useContext } from 'react';

/** True when this screen’s KeepAliveTab is the visible shell tab. */
export const KeepAliveTabActiveContext = createContext(true);

export function useKeepAliveTabActive(): boolean {
  return useContext(KeepAliveTabActiveContext);
}
