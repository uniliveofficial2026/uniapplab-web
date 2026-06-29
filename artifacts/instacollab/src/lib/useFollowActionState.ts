import { useMemo } from 'react';
import { db } from './db/localDb';
import { useDbRevision } from './useDB';
import type { FollowActionState } from './followPrivacy';

export function useFollowActionState(targetUserId: string | undefined): FollowActionState | null {
  const revision = useDbRevision();
  return useMemo(() => {
    if (!targetUserId) return null;
    void revision;
    return db.getFollowActionState(targetUserId);
  }, [targetUserId, revision]);
}
