/**
 * Upload gift SVGA / video effect assets for Creation Studio.
 * Primary: Cloudflare R2. Fallback: Supabase Storage → Firebase Storage (dev only).
 */
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { getFirebaseStorage } from './firebase/app';
import { isFirebaseConfigured } from './firebase/config';
import { uploadBlobToR2 } from './media/r2Upload';
import { getSupabaseClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

const SUPABASE_BUCKET = 'post-media';
const FIREBASE_PREFIX = 'gift-assets';

function guessExt(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const t = file.type || '';
  if (t.includes('svga') || file.name.toLowerCase().endsWith('.svga')) return 'svga';
  if (t.includes('webm')) return 'webm';
  if (t.includes('mp4') || t.includes('video')) return 'mp4';
  return 'bin';
}

async function uploadSupabaseGiftAsset(
  userId: string,
  giftId: string,
  file: File,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `effect.${guessExt(file)}`;
  const path = `${userId}/gifts/${giftId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) {
    console.warn('[gift-assets] supabase upload failed:', error.message);
    return null;
  }
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

async function uploadFirebaseGiftAsset(
  userId: string,
  giftId: string,
  file: File,
): Promise<string | null> {
  const storage = getFirebaseStorage();
  if (!storage || !isFirebaseConfigured() || !isCloudAuthUserId(userId)) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `effect.${guessExt(file)}`;
  const path = `${FIREBASE_PREFIX}/${userId}/${giftId}/${Date.now()}_${safeName}`;
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn('[gift-assets] firebase upload failed:', err);
    return null;
  }
}

export async function uploadGiftEffectAsset(
  giftId: string,
  file: File,
): Promise<string | null> {
  const userId = db.currentUserId;
  if (!userId || !isCloudAuthUserId(userId)) {
    window.dispatchEvent(
      new CustomEvent('app-toast', { detail: 'Sign in as admin to upload gift assets' }),
    );
    return null;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `effect.${guessExt(file)}`;
  const r2Url = await uploadBlobToR2({
    folder: 'gifts',
    blob: file,
    fileName: safeName,
    prefix: giftId,
  });
  if (r2Url) return r2Url;

  if (isSupabaseConfigured()) {
    return (
      (await uploadSupabaseGiftAsset(userId, giftId, file)) ??
      uploadFirebaseGiftAsset(userId, giftId, file)
    );
  }
  return uploadFirebaseGiftAsset(userId, giftId, file);
}

export function isGiftSvgaFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.svga') || file.type.includes('svga');
}

export function isGiftVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith('video/') ||
    name.endsWith('.mp4') ||
    name.endsWith('.webm') ||
    name.endsWith('.mov')
  );
}

export function isGiftIconImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type || '';
  return (
    type.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif')
  );
}
