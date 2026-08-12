import { isFirebaseConfigured } from '../firebase/config';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';
import { getSupabaseClient } from '../supabase/client';
import {
  removeSafeRealtimeChannel,
  subscribeSafeRealtimeChannel,
} from '../supabase/safeRealtimeChannel';

async function firebaseUserBlocks() {
  return import('../firebase/userBlocks');
}

export function isBlocksCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

export async function fetchBlocksForUser(meId: string): Promise<{
  blockedByMe: string[];
  blockedMe: string[];
}> {
  if (shouldUseFirebaseForSocialCloud(meId) && isFirebaseConfigured()) {
    const fb = await firebaseUserBlocks();
    if (fb.isFirebaseBlocksAvailable()) {
      return fb.fetchFirebaseBlocksForUser(meId);
    }
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
    if (isFirebaseConfigured()) {
      const fb = await firebaseUserBlocks();
      if (fb.isFirebaseBlocksAvailable()) return fb.fetchFirebaseBlocksForUser(meId);
    }
    return { blockedByMe: [], blockedMe: [] };
  }
}

export async function upsertCloudBlock(blockerId: string, blockedId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(blockerId) && isFirebaseConfigured()) {
    const fb = await firebaseUserBlocks();
    if (fb.isFirebaseBlocksAvailable()) {
      await fb.upsertFirebaseBlock(blockerId, blockedId);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('user_blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
    if (error) throw error;
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseUserBlocks();
      if (fb.isFirebaseBlocksAvailable()) await fb.upsertFirebaseBlock(blockerId, blockedId);
    }
  }
}

export async function deleteCloudBlock(blockerId: string, blockedId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(blockerId) && isFirebaseConfigured()) {
    const fb = await firebaseUserBlocks();
    if (fb.isFirebaseBlocksAvailable()) {
      await fb.deleteFirebaseBlock(blockerId, blockedId);
      return;
    }
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
    if (isFirebaseConfigured()) {
      const fb = await firebaseUserBlocks();
      if (fb.isFirebaseBlocksAvailable()) await fb.deleteFirebaseBlock(blockerId, blockedId);
    }
  }
}

export function subscribeCloudBlocks(meId: string, onChange: () => void): () => void {
  if (shouldUseFirebaseForSocialCloud(meId) && isFirebaseConfigured()) {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void firebaseUserBlocks().then((fb) => {
      if (cancelled || !fb.isFirebaseBlocksAvailable()) return;
      unsub = fb.subscribeFirebaseBlocks(meId, onChange);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const channel = subscribeSafeRealtimeChannel(supabase, `user-blocks:${meId}`, (ch) => {
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, onChange);
  });

  return () => {
    removeSafeRealtimeChannel(supabase, channel);
  };
}
