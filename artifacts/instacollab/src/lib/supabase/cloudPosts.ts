import type { Post, User } from '../../types';
import type { ProfileRow } from './types';
import { hasSupabaseSessionForUser } from '../auth/activeBackend';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';
import { profileRowToUser } from './profile';
import { postUserId } from '../safe';

const BUCKET = 'post-media';
const TABLE = 'posts';

export type CloudPostRow = {
  id: string;
  author_id: string;
  payload: Record<string, unknown>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

function postToPayload(post: Post): Record<string, unknown> {
  const { user: _user, ...rest } = post;
  return rest as Record<string, unknown>;
}

export function cloudRowToPost(row: CloudPostRow, author: User): Post {
  const payload = row.payload ?? {};
  return {
    likes: 0,
    comments: 0,
    isLiked: false,
    isSaved: false,
    caption: '',
    imageUrl: '',
    ...payload,
    id: row.id,
    user: author,
    isArchived: row.is_archived,
    createdAt: (payload.createdAt as string) || row.created_at,
  } as Post;
}

async function canUseCloudPosts(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return false;
  return hasSupabaseSessionForUser(userId);
}

export async function uploadPostMediaBlob(
  userId: string,
  postId: string,
  kind: 'image' | 'video' | 'audio' | 'cover',
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  if (!(await canUseCloudPosts(userId))) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || `${kind}.bin`;
  const path = `${userId}/${postId}/${kind}/${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'application/octet-stream',
  });
  if (error) {
    console.warn('[posts] media upload failed:', error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

export async function upsertCloudPost(post: Post): Promise<boolean> {
  const authorId = postUserId(post);
  if (!authorId || !(await canUseCloudPosts(authorId))) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const row = {
    id: post.id,
    author_id: authorId,
    payload: postToPayload(post),
    is_archived: Boolean(post.isArchived),
    created_at: post.createdAt || new Date().toISOString(),
  };

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'id' });
  if (error) {
    console.warn('[posts] cloud upsert failed:', error.message);
    return false;
  }
  return true;
}

async function fetchProfilesForAuthors(authorIds: string[]): Promise<Map<string, User>> {
  const supabase = getSupabaseClient();
  const map = new Map<string, User>();
  if (!supabase || authorIds.length === 0) return map;

  const unique = [...new Set(authorIds)];
  const { data, error } = await supabase.from('profiles').select('*').in('id', unique);
  if (error || !data) return map;

  for (const row of data as ProfileRow[]) {
    if (row?.id) map.set(row.id, profileRowToUser(row));
  }
  return map;
}

export async function fetchCloudFeedPosts(limit = 60): Promise<Post[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    if (error) console.warn('[posts] feed fetch failed:', error.message);
    return [];
  }

  const rows = data as CloudPostRow[];
  const authors = await fetchProfilesForAuthors(rows.map((r) => r.author_id));
  return rows
    .map((row) => {
      const author = authors.get(row.author_id);
      if (!author) return null;
      return cloudRowToPost(row, author);
    })
    .filter((p): p is Post => Boolean(p));
}

export async function fetchCloudUserPosts(authorId: string, limit = 60): Promise<Post[]> {
  if (!isSupabaseConfigured() || !isCloudAuthUserId(authorId)) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    if (error) console.warn('[posts] profile fetch failed:', error.message);
    return [];
  }

  const rows = data as CloudPostRow[];
  const authors = await fetchProfilesForAuthors([authorId]);
  const author = authors.get(authorId);
  if (!author) return [];

  return rows
    .filter((row) => !row.is_archived)
    .map((row) => cloudRowToPost(row, author));
}

export function subscribeCloudPosts(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`posts:feed:${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
