import { useEffect, useMemo, useState } from 'react';
import { db } from '../lib/db/localDb';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { isFirebaseConfigured } from '../lib/firebase/config';
import {
  filterLocalUsers,
  mergeUserSearchResults,
  searchCloudProfiles,
} from '../lib/userSearch';
import type { User } from '../types';

const DEBOUNCE_MS = 280;

function cloudSearchEnabled(): boolean {
  return isSupabaseConfigured() || isFirebaseConfigured();
}

/**
 * Local demo users + cloud profiles for Search / mention pickers.
 * Cloud hits are cached into db.users so follow + profile preview work offline.
 */
export function useDiscoverableUserSearch(query: string): {
  results: User[];
  loading: boolean;
} {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const unsub = db.subscribe(() => setRevision((r) => r + 1));
    return () => {
      unsub();
    };
  }, []);

  const [cloudUsers, setCloudUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const localMatches = useMemo(
    () => filterLocalUsers(db.users, query),
    [query, revision],
  );

  useEffect(() => {
    const term = query.trim();
    if (!term || !cloudSearchEnabled()) {
      setCloudUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchCloudProfiles(term)
        .then((found) => {
          if (cancelled) return;
          setCloudUsers(found);
          if (found.length > 0) {
            db.cacheDiscoveredUsers(found);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.warn('[search] cloud profile search failed:', err);
            setCloudUsers([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const results = useMemo(
    () => mergeUserSearchResults(localMatches, cloudUsers),
    [localMatches, cloudUsers],
  );

  return { results, loading };
}
