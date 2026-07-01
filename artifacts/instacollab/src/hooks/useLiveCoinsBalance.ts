import { useMemo } from 'react';
import { getLiveCoinsBalance } from '../lib/walletKstarSync';
import { useDbRevision } from '../lib/useDB';

/** Reactive spendable coins — updates when wallet / K-Star rows change (all session modes). */
export function useLiveCoinsBalance(userId: string): number {
  const revision = useDbRevision();
  return useMemo(() => getLiveCoinsBalance(userId), [userId, revision]);
}
