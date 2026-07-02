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

function profileRowThoughtNote(row: ProfileRow): Pick<User, 'note' | 'noteUpdatedAt'> {
  const trimmed = (row.note ?? '').trim();
  if (!trimmed) return {};
  const updatedAt = row.note_updated_at ? Date.parse(row.note_updated_at) : undefined;
  return {
    note: trimmed,
    ...(Number.isFinite(updatedAt) ? { noteUpdatedAt: updatedAt } : {}),
  };
}

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
    role: row.role ?? 'user',
    bannedAt: row.banned_at ? Date.parse(row.banned_at) : undefined,
    banReason: row.ban_reason ?? undefined,
    mutedUntil: row.muted_until ? Date.parse(row.muted_until) : undefined,
    ...profileRowThoughtNote(row),
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

  const instanceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const channel = supabase
    .channel(`profile:${userId}:${instanceId}`)
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

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
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

export type EnsureProfileOverrides = {
  username?: string;
  displayName?: string;
  publicUserId?: string;
};

function usernameFromSessionMeta(
  meta: Record<string, unknown>,
  email: string | undefined,
  userId: string,
): string {
  const direct = metaString(meta, 'username');
  if (direct) {
    const slug = direct.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (slug.length >= 3) return slug.slice(0, 24);
  }
  const fromEmail = (email?.split('@')[0] || 'user').replace(/[^a-z0-9_]/gi, '_');
  if (fromEmail.length >= 3) return fromEmail.slice(0, 24);
  return `user_${userId.replace(/-/g, '').slice(0, 8)}`;
}

/**
 * Guarantee a profiles row exists after Supabase Auth sign-in/sign-up.
 * Covers projects where the auth trigger is missing or lagging.
 */
export async function ensureProfileFromSession(
  session: Session,
  overrides?: EnsureProfileOverrides,
): Promise<ProfileRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let existing: ProfileRow | null = null;
  try {
    existing = await fetchProfile(session.user.id);
  } catch {
    existing = null;
  }

  const meta = (session.user.user_metadata || {}) as Record<string, unknown>;
  const username =
    overrides?.username?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
    existing?.username ||
    usernameFromSessionMeta(meta, session.user.email, session.user.id);
  const displayName =
    overrides?.displayName?.trim() ||
    existing?.display_name ||
    displayNameFromMeta(meta) ||
    username;
  const publicUserId =
    overrides?.publicUserId ||
    existing?.public_user_id ||
    normalizePublicUserId(username);
  const now = new Date().toISOString();

  const row: ProfileRow = {
    id: session.user.id,
    username,
    display_name: displayName,
    avatar_url:
      existing?.avatar_url ?? metaString(meta, 'avatar_url', 'picture') ?? null,
    bio: existing?.bio ?? '',
    profile_setup_complete: existing?.profile_setup_complete ?? false,
    public_user_id: publicUserId,
    public_user_id_changed_at: existing?.public_user_id_changed_at ?? now,
  };

  if (
    existing &&
    existing.username === row.username &&
    existing.display_name === row.display_name &&
    existing.public_user_id === row.public_user_id
  ) {
    return existing;
  }

  try {
    return await upsertProfile(row);
  } catch (err) {
    console.warn('[auth] ensureProfileFromSession failed:', err);
    return existing;
  }
}

export async function upsertProfile(row: ProfileRow): Promise<ProfileRow> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const thought = (row.note ?? '').trim();
  const payload = {
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio ?? '',
    profile_setup_complete: row.profile_setup_complete,
    public_user_id: row.public_user_id ?? null,
    public_user_id_changed_at: row.public_user_id_changed_at ?? null,
    note: thought,
    note_updated_at: thought ? row.note_updated_at ?? new Date().toISOString() : null,
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
