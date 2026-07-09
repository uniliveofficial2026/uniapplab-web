import {
  fetchFirebaseBlocksForUser,
  deleteFirebaseBlock,
  isFirebaseBlocksAvailable,
  subscribeFirebaseBlocks,
  upsertFirebaseBlock,
} from '../firebase/userBlocks';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';
import { getSupabaseClient } from '../supabase/client';

export function isBlocksCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

export async function fetchBlocksForUser(meId: string): Promise<{
  blockedByMe: string[];
  blockedMe: string[];
}> {
  if (shouldUseFirebaseForSocialCloud(meId) && isFirebaseBlocksAvailable()) {
    return fetchFirebaseBlocksForUser(meId);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { blockedByMe: [], blockedMe: [] };

  try {
    const [{ data: mine }, { data: against }] = await Promise.all([
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', meId),
      supabase.from('user_blocks').select('blocker_id').eq('blocked_id', meId),
    ]);
    return {
      blockedByMe: (mine ?? []).map((r) => String(r.blocked_id)).filter(Boolean),
      blockedMe: (against ?? []).map((r) => String(r.blocker_id)).filter(Boolean),
    };
  } catch {
    if (isFirebaseBlocksAvailable()) return fetchFirebaseBlocksForUser(meId);
    return { blockedByMe: [], blockedMe: [] };
  }
}

export async function upsertCloudBlock(blockerId: string, blockedId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(blockerId) && isFirebaseBlocksAvailable()) {
    await upsertFirebaseBlock(blockerId, blockedId);
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('user_blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
    if (error) throw error;
  } catch {
    if (isFirebaseBlocksAvailable()) await upsertFirebaseBlock(blockerId, blockedId);
  }
}

export async function deleteCloudBlock(blockerId: string, blockedId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(blockerId) && isFirebaseBlocksAvailable()) {
    await deleteFirebaseBlock(blockerId, blockedId);
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    if (error) throw error;
  } catch {
    if (isFirebaseBlocksAvailable()) await deleteFirebaseBlock(blockerId, blockedId);
  }
}

export function subscribeCloudBlocks(meId: string, onChange: () => void): () => void {
  if (shouldUseFirebaseForSocialCloud(meId) && isFirebaseBlocksAvailable()) {
    return subscribeFirebaseBlocks(meId, onChange);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`user-blocks:${meId}:${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, onChange)
    .subscribe();

  const unsubFb = isFirebaseBlocksAvailable()
    ? subscribeFirebaseBlocks(meId, onChange)
    : () => undefined;

  return () => {
    void supabase.removeChannel(channel);
    unsubFb();
  };
}
