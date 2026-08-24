import { useCallback, useEffect, useState } from 'react';
import {
  fetchPkChallengeInbox,
  type LivePkChallengeInbox,
} from '../lib/platformApi';

const EMPTY: LivePkChallengeInbox = {
  incoming: null,
  outgoing: null,
  activePk: null,
};

export function usePkChallengeInbox(enabled: boolean, pollMs = 2000) {
  const [inbox, setInbox] = useState<LivePkChallengeInbox>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return EMPTY;
    try {
      const next = await fetchPkChallengeInbox();
      setInbox(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'inbox_failed');
      return inbox;
    }
  }, [enabled, inbox]);

  useEffect(() => {
    if (!enabled) {
      setInbox(EMPTY);
      return;
    }
    let cancelled = false;
    const tick = () => {
      void fetchPkChallengeInbox()
        .then((next) => {
          if (!cancelled) {
            setInbox(next);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'inbox_failed');
        });
    };
    tick();
    const id = window.setInterval(tick, Math.max(1000, pollMs));
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, pollMs]);

  return { inbox, error, refresh };
}
