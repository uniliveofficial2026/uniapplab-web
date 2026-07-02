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

let installed = false;
let channelUnsub: (() => void) | null = null;

function thoughtPatchFromRow(row: ProfileRow): { note?: string; noteUpdatedAt?: number } {
  const trimmed = (row.note ?? '').trim();
  if (!trimmed) return { note: undefined, noteUpdatedAt: undefined };
  const updatedAt = row.note_updated_at ? Date.parse(row.note_updated_at) : undefined;
  return {
    note: trimmed,
    ...(Number.isFinite(updatedAt) ? { noteUpdatedAt: updatedAt } : {}),
  };
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

  withCloudAppStateRemoteApply(() => {
    db.updateUser(row.id, (u) => ({
      ...u,
      note: next.note,
      noteUpdatedAt: next.noteUpdatedAt,
    }));
  });
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
  installed = false;
}
