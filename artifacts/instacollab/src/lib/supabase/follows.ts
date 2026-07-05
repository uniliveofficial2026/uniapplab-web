import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';

export type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at?: string;
};

export type FollowRequestRow = {
  profile_owner_id: string;
  requester_id: string;
  created_at?: string;
};

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.following_id).filter(Boolean))];
}

export async function fetchFollowerIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.follower_id).filter(Boolean))];
}

export async function insertFollow(followerId: string, followingId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('follows').insert({
    follower_id: followerId,
    following_id: followingId,
  });
  if (error) throw error;
}

export async function deleteFollow(followerId: string, followingId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function insertFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('follow_requests').insert({
    profile_owner_id: ownerId,
    requester_id: requesterId,
  });
  if (error) throw error;
}

export async function deleteFollowRequest(ownerId: string, requesterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('profile_owner_id', ownerId)
    .eq('requester_id', requesterId);
  if (error) throw error;
}

export async function fetchPendingFollowRequesterIds(ownerId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !ownerId) return [];
  const { data, error } = await supabase
    .from('follow_requests')
    .select('requester_id')
    .eq('profile_owner_id', ownerId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.requester_id).filter(Boolean))];
}

export async function hasFollowRequest(ownerId: string, requesterId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('follow_requests')
    .select('requester_id')
    .eq('profile_owner_id', ownerId)
    .eq('requester_id', requesterId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function insertUserNotification(input: {
  userId: string;
  type: string;
  actorId: string;
  body?: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from('user_notifications').insert({
    user_id: input.userId,
    type: input.type,
    actor_id: input.actorId,
    body: input.body ?? null,
  });
  if (error) console.warn('[follows] notification insert failed:', error.message);
}

export function isFollowsCloudAvailable(): boolean {
  return isSupabaseConfigured();
}
