import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LiveLikeTapper } from '../hooks/useLiveRoomBus';

export type LiveLikeOrigin = {
  xPct: number;
  yPct: number;
};

export type LiveLikeContextValue = {
  likeCount: number;
  likeTappers: LiveLikeTapper[];
  tapLike: (origin?: LiveLikeOrigin) => void;
};

const LiveLikeContext = createContext<LiveLikeContextValue | null>(null);

export function LiveLikeProvider({
  likeCount,
  likeTappers,
  tapLike,
  children,
}: LiveLikeContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ likeCount, likeTappers, tapLike }),
    [likeCount, likeTappers, tapLike],
  );
  return <LiveLikeContext.Provider value={value}>{children}</LiveLikeContext.Provider>;
}

export function useOptionalLiveLike(): LiveLikeContextValue | null {
  return useContext(LiveLikeContext);
}
