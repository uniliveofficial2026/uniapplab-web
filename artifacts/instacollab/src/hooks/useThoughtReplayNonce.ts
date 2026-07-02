import { useEffect, useState } from 'react';
import { subscribeThoughtNoteLive } from '../lib/thoughtNoteLiveSync';

/** Bumps when a user's thought changes locally or from cloud — forces animation replay. */
export function useThoughtReplayNonce(userId: string | null | undefined): number {
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!userId) return;
    return subscribeThoughtNoteLive((detail) => {
      if (!detail.changedUserIds.length || detail.changedUserIds.includes(userId)) {
        setNonce((n) => n + 1);
      }
    });
  }, [userId]);

  return nonce;
}
