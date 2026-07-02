/**
 * Realtime thought-note sync via public.profiles — so animated bubbles update
 * across devices and for other viewers without a page reload.
 */
import { db } from './db/localDb';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { withCloudAppStateRemoteApply } from './auth/cloudAppStateFlags';
import { getSupabaseClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';
import { profileRowToUser } from './supabase/profile';
import type { ProfileRow } from './supabase/types';
import { isNetworkOnline, subscribeNetworkStatus } from './networkStatus';
import { dispatchThoughtNoteReplay, normalizeUserThoughtEpoch } from './thoughtNoteLiveSync';
import { isCloudAuthConfigured } from './auth/config';

let installed = false;
let channelUnsub: (() => void) | null = null;

function thoughtPatchFromRow(row: ProfileRow): { note?: string; noteUpdatedAt?: number } {
  const trimmed = (row.note ?? '').trim();
  if (!trimmed) return { note: undefined, noteUpdatedAt: undefined };
  const updatedAt = row.note_updated_at ? Date.parse(row.note_updated_at) : undefined;
  const patch: { note: string; noteUpdatedAt?: number } = { note: trimmed };
  if (Number.isFinite(updatedAt) && (updatedAt as number) > 0) {
    patch.noteUpdatedAt = updatedAt as number;
  }
  return patch;
}

function mergeThoughtPatch(
  userId: string,
  patch: { note?: string; noteUpdatedAt?: number },
): void {
  const existing = db.users.find((u) => u.id === userId);
  const noteChanged = (existing?.note ?? '') !== (patch.note ?? '');
  const tsChanged = (existing?.noteUpdatedAt ?? 0) !== (patch.noteUpdatedAt ?? 0);
  if (!noteChanged && !tsChanged) return;

  withCloudAppStateRemoteApply(() => {
    db.updateUser(userId, (u) =>
      normalizeUserThoughtEpoch({
        ...u,
        note: patch.note,
        noteUpdatedAt:
          patch.noteUpdatedAt ??
          (patch.note && noteChanged ? Date.now() : u.noteUpdatedAt),
      }),
    );
  });
  dispatchThoughtNoteReplay(userId);
}

function applyProfileThoughtRow(row: ProfileRow): void {
  if (!row?.id || !isCloudAuthUserId(row.id)) return;

  const existing = db.users.find((u) => u.id === row.id);
  if (!existing) {
    withCloudAppStateRemoteApply(() => {
      db.cacheDiscoveredUsers([profileRowToUser(row)]);
    });
    return;
  }

  const next = thoughtPatchFromRow(row);
  const sameNote = (existing.note ?? '') === (next.note ?? '');
  const sameTs = (existing.noteUpdatedAt ?? 0) === (next.noteUpdatedAt ?? 0);
  if (sameNote && sameTs) return;

  mergeThoughtPatch(row.id, next);
}

export function initThoughtNoteCloudSync(): void {
  if (typeof window === 'undefined') return;
  if (!isSupabaseConfigured()) return;

  if (!installed) {
    installed = true;
    subscribeNetworkStatus((next) => {
      if (next === 'online') {
        startThoughtNoteChannel();
      } else {
        stopThoughtNoteChannel();
      }
    });
  }

  if (!isNetworkOnline()) return;
  startThoughtNoteChannel();
  startThoughtProfileRefresh();
  void refreshThoughtNotesFromCloud();
}

function startThoughtNoteChannel(): void {
  if (channelUnsub || !isNetworkOnline()) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const instanceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const channel = supabase
    .channel(`profiles:thought-notes:${instanceId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles' },
      (payload) => {
        const row = payload.new as ProfileRow;
        if (row?.id) applyProfileThoughtRow(row);
      },
    )
    .subscribe();

  channelUnsub = () => {
    void supabase.removeChannel(channel);
    channelUnsub = null;
  };
}

function stopThoughtNoteChannel(): void {
  channelUnsub?.();
  channelUnsub = null;
}

export function teardownThoughtNoteCloudSync(): void {
  stopThoughtNoteChannel();
  stopThoughtProfileRefresh();
  installed = false;
}

let profileRefreshInstalled = false;

/** Pull own + followed users' thought notes when app returns to foreground (mobile catch-up). */
function startThoughtProfileRefresh(): void {
  if (profileRefreshInstalled || typeof document === 'undefined') return;
  profileRefreshInstalled = true;

  const refresh = () => {
    if (!isNetworkOnline() || !isSupabaseConfigured()) return;
    void refreshThoughtNotesFromCloud();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  subscribeNetworkStatus((status) => {
    if (status === 'online') refresh();
  });
}

function stopThoughtProfileRefresh(): void {
  profileRefreshInstalled = false;
}

export async function refreshThoughtNotesFromCloud(): Promise<void> {
  if (!isNetworkOnline() || !isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const me = db.currentUser;
  const ids = new Set<string>();
  if (me?.id && isCloudAuthConfigured()) ids.add(me.id);

  for (const user of db.users) {
    if (user?.id && user.note?.trim()) ids.add(user.id);
  }

  const queryIds = [...ids].slice(0, 40);
  if (!queryIds.length) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, note, note_updated_at')
    .in('id', queryIds);

  if (error || !data?.length) {
    if (error && import.meta.env.DEV) {
      console.warn('[thought] profile refresh failed:', error.message);
    }
    return;
  }

  for (const row of data as ProfileRow[]) {
    if (!row?.id) continue;
    applyProfileThoughtRow(row);
  }
}
