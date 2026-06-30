import { hasSupabaseSessionForUser } from './auth/activeBackend';
import { isCloudAuthConfigured } from './auth/config';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { getSupabaseClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

const BUCKET = 'karaoke-uploads';

function storagePath(userId: string, songId: string, kind: 'audio' | 'cover', fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${songId}/${kind}/${safeName}`;
}

async function canUseCloudStorage(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;
  return hasSupabaseSessionForUser(userId);
}

export async function uploadKaraokeFileToCloud(
  userId: string,
  songId: string,
  kind: 'audio' | 'cover',
  file: File | Blob,
  fileName: string,
): Promise<string | null> {
  if (!(await canUseCloudStorage(userId))) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const path = storagePath(userId, songId, kind, fileName);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || (kind === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
  });

  if (error) {
    console.warn('[karaoke] cloud upload failed:', error.message);
    return null;
  }

  return path;
}

export async function downloadKaraokeFileFromCloud(path: string): Promise<Blob | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.warn('[karaoke] cloud download failed:', error?.message);
    return null;
  }
  return data;
}

export async function getKaraokeFilePublicUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

function isEligibleKaraokeOwnerId(userId: string | undefined | null): userId is string {
  const id = userId?.trim();
  if (!id) return false;
  if (!isCloudAuthConfigured()) return true;
  return isCloudAuthUserId(id);
}

export function getKaraokeCloudUserId(): string {
  const fromUser = db.currentUser?.id?.trim();
  if (isEligibleKaraokeOwnerId(fromUser)) return fromUser;
  if (!db.isLoggedIn) return isCloudAuthConfigured() ? '' : 'u1';
  const stored = db.load('currentUserId', '')?.trim();
  if (isEligibleKaraokeOwnerId(stored)) return stored;
  return isCloudAuthConfigured() ? '' : 'u1';
}

/** Canonical owner for local My Uploads lists — always matches `useCurrentUser().id`. */
export function getKaraokeUploadOwnerUserId(): string {
  return getKaraokeCloudUserId();
}
