/**
 * Upload chat attachments (photo/video/audio/file/pdf) to public chat-media storage
 * so peers can load them over the internet.
 */
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import type { ChatMessage } from '../dbTypes';

const BUCKET = 'chat-media';

function isLocalMediaUrl(url: string): boolean {
  return (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('app-media:')
  );
}

async function blobFromUrl(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    return await res.blob();
  } catch {
    return null;
  }
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

export async function uploadChatMediaBlob(
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
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'application/octet-stream',
  });
  if (error) {
    console.warn('[chat-media] upload failed:', error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

/** Replace local-only media URLs with public cloud URLs before sending. */
export async function cloudifyChatMessageMedia(
  userId: string,
  message: ChatMessage,
): Promise<ChatMessage> {
  if (!isCloudAuthUserId(userId) || !isSupabaseConfigured()) return message;
  const messageId = String(message.id || `m_${Date.now()}`);
  const media = Array.isArray(message.media) ? message.media : [];
  if (!media.length) return message;

  const nextMedia = await Promise.all(
    media.map(async (item, index) => {
      if (!item || typeof item !== 'object') return item;
      const entry = item as Record<string, unknown>;
      const url = typeof entry.url === 'string' ? entry.url : '';
      if (!url || !isLocalMediaUrl(url)) return item;

      const blob = await blobFromUrl(url);
      if (!blob) return item;

      const name =
        typeof entry.name === 'string' && entry.name.trim()
          ? entry.name
          : `attachment_${index}.${guessExt(blob)}`;
      const uploaded = await uploadChatMediaBlob(userId, messageId, blob, name);
      if (!uploaded) return item;
      return { ...entry, url: uploaded };
    }),
  );

  return { ...message, id: messageId, media: nextMedia };
}
