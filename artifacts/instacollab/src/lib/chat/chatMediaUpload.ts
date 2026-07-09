/**
 * Upload chat attachments (photo/video/audio/file/pdf) to public chat-media storage
 * so peers can load them over the internet.
 */
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { isAppMediaRef, readAppMediaBlob } from '../appMediaStore';
import { getFirebaseStorage } from '../firebase/app';
import { isFirebaseConfigured } from '../firebase/config';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import type { ChatMessage } from '../dbTypes';

const SUPABASE_BUCKET = 'chat-media';
const FIREBASE_PREFIX = 'chat-media';

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, payload] = dataUrl.split(',');
    if (!header || payload === undefined) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] || 'application/octet-stream';
    if (header.includes(';base64')) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
}

function isLocalMediaUrl(url: string): boolean {
  return (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('app-media:')
  );
}

async function blobFromLocalUrl(url: string): Promise<Blob | null> {
  if (isAppMediaRef(url)) {
    return readAppMediaBlob(url);
  }
  if (url.startsWith('data:')) {
    return dataUrlToBlob(url);
  }
  if (url.startsWith('blob:')) {
    try {
      const res = await fetch(url);
      return await res.blob();
    } catch {
      return null;
    }
  }
  return null;
}

function guessExt(blob: Blob, name?: string): string {
  const fromName = name?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const t = blob.type || '';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('webm')) return 'webm';
  if (t.includes('quicktime')) return 'mov';
  if (t.includes('mp4') || t.includes('video')) return 'mp4';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('word')) return 'docx';
  return 'bin';
}

async function uploadSupabaseChatMediaBlob(
  userId: string,
  messageId: string,
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || `file.${guessExt(blob)}`;
  const path = `${userId}/${messageId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'application/octet-stream',
  });
  if (error) {
    console.warn('[chat-media] supabase upload failed:', error.message);
    return null;
  }
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

async function uploadFirebaseChatMediaBlob(
  userId: string,
  messageId: string,
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  const storage = getFirebaseStorage();
  if (!storage || !isFirebaseConfigured() || !isCloudAuthUserId(userId)) return null;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || `file.${guessExt(blob)}`;
  const path = `${FIREBASE_PREFIX}/${userId}/${messageId}/${Date.now()}_${safeName}`;
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, {
      contentType: blob.type || 'application/octet-stream',
    });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn('[chat-media] firebase upload failed:', err);
    return null;
  }
}

export async function uploadChatMediaBlob(
  userId: string,
  messageId: string,
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  if (isSupabaseConfigured()) {
    return (await uploadSupabaseChatMediaBlob(userId, messageId, blob, fileName))
      ?? uploadFirebaseChatMediaBlob(userId, messageId, blob, fileName);
  }
  return uploadFirebaseChatMediaBlob(userId, messageId, blob, fileName);
}

/** Replace local-only media URLs with public cloud URLs before sending. */
export async function cloudifyChatMessageMedia(
  userId: string,
  message: ChatMessage,
): Promise<ChatMessage> {
  if (!isCloudAuthUserId(userId)) return message;
  if (!isSupabaseConfigured() && !isFirebaseConfigured()) return message;

  const messageId = String(message.id || `m_${Date.now()}`);
  const media = Array.isArray(message.media) ? message.media : [];
  if (!media.length) return message;

  let changed = false;
  const nextMedia = await Promise.all(
    media.map(async (item, index) => {
      if (!item || typeof item !== 'object') return item;
      const entry = item as Record<string, unknown>;
      const url = typeof entry.url === 'string' ? entry.url : '';
      if (!url || !isLocalMediaUrl(url)) return item;

      const blob = await blobFromLocalUrl(url);
      if (!blob) {
        console.warn('[chat-media] could not read local attachment bytes for upload');
        return item;
      }

      const name =
        typeof entry.name === 'string' && entry.name.trim()
          ? entry.name
          : `attachment_${index}.${guessExt(blob)}`;
      const uploaded = await uploadChatMediaBlob(userId, messageId, blob, name);
      if (!uploaded) return item;
      changed = true;
      return { ...entry, url: uploaded };
    }),
  );

  if (!changed) return { ...message, id: messageId };
  return { ...message, id: messageId, media: nextMedia };
}
