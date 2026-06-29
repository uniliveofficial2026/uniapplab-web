import type { User } from '../../types';
import type { Session } from '@supabase/supabase-js';
import { mapProfileSaveError } from '../auth/profileErrors';
import { getSupabaseClient } from './client';
import {
  normalizePublicUserId,
  profileRowPublicUserIdChangedMs,
} from '../publicUserId';
import type { ProfileRow } from './types';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

export function profileRowToUser(row: ProfileRow, _email?: string | null): User {
  return {
    id: row.id,
    publicUserId: row.public_user_id || row.username,
    publicUserIdChangedAt: profileRowPublicUserIdChangedMs(row),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || DEFAULT_AVATAR,
    bio: row.bio || '',
    followers: 0,
    following: 0,
    status: 'none',
  };
}

export function userToProfilePatch(user: Partial<User>): Partial<ProfileRow> {
  const patch: Partial<ProfileRow> = {
    username: user.username,
    display_name: user.displayName,
    avatar_url: user.avatarUrl ?? null,
    bio: user.bio ?? '',
  };
  if (user.publicUserId !== undefined) {
    patch.public_user_id = normalizePublicUserId(user.publicUserId);
  }
  if (user.publicUserIdChangedAt !== undefined) {
    patch.public_user_id_changed_at = new Date(user.publicUserIdChangedAt).toISOString();
  }
  return patch;
}

/** Live profile row updates (requires profiles in supabase_realtime publication). */
export function subscribeProfileRow(
  userId: string,
  onRow: (row: ProfileRow) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`profile:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as ProfileRow;
        if (row?.id === userId) onRow(row);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(row: ProfileRow): Promise<ProfileRow> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const payload = {
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio ?? '',
    profile_setup_complete: row.profile_setup_complete,
    public_user_id: row.public_user_id ?? null,
    public_user_id_changed_at: row.public_user_id_changed_at ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data: existing, error: readError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', row.id)
      .maybeSingle();
    if (readError) throw readError;

    if (existing?.id) {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', row.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: row.id, ...payload })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    throw mapProfileSaveError(err);
  }
}

export async function isPublicUserIdAvailable(
  publicUserId: string,
  exceptUserId?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return true;
  const normalized = normalizePublicUserId(publicUserId);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('public_user_id', normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true;
  return exceptUserId ? data.id === exceptUserId : false;
}

export async function isUsernameAvailable(username: string, exceptUserId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return true;
  const normalized = username.trim().toLowerCase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true;
  return exceptUserId ? data.id === exceptUserId : false;
}

function metaString(meta: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function displayNameFromMeta(meta: Record<string, unknown>): string | undefined {
  const direct = metaString(meta, 'display_name', 'full_name');
  if (direct) return direct;
  const name = meta.name;
  if (typeof name === 'string' && name.trim()) return name;
  if (name && typeof name === 'object') {
    const parts = name as { firstName?: string; lastName?: string };
    const full = [parts.firstName, parts.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
  }
  return undefined;
}

export function userFromSession(session: Session, profile: ProfileRow | null): User {
  const meta = (session.user.user_metadata || {}) as Record<string, unknown>;
  if (profile) return profileRowToUser(profile, session.user.email);
  const fallbackUsername =
    metaString(meta, 'username') ||
    (session.user.email?.split('@')[0] || 'user').replace(/[^a-z0-9_]/gi, '_');
  const displayName = displayNameFromMeta(meta) || fallbackUsername;
  const avatarUrl = metaString(meta, 'avatar_url', 'picture') || DEFAULT_AVATAR;
  const publicUserId =
    metaString(meta, 'public_user_id') || normalizePublicUserId(fallbackUsername);
  return {
    id: session.user.id,
    publicUserId,
    username: fallbackUsername,
    displayName,
    avatarUrl,
    bio: '',
    followers: 0,
    following: 0,
    status: 'none',
  };
}
