/**
 * Cross-user blocks — enforced for both blocker and blocked via shared table.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';

let channel: RealtimeChannel | null = null;
let blockedByMe = new Set<string>();
let blockedMe = new Set<string>();

export function isCloudBlockedEitherWay(userId: string): boolean {
  return blockedByMe.has(userId) || blockedMe.has(userId);
}

export function getCloudBlockedUserIds(): string[] {
  return [...blockedByMe];
}

export async function syncCloudBlocks(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const [{ data: mine }, { data: against }] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', meId),
    supabase.from('user_blocks').select('blocker_id').eq('blocked_id', meId),
  ]);

  blockedByMe = new Set((mine ?? []).map((r) => String(r.blocked_id)).filter(Boolean));
  blockedMe = new Set((against ?? []).map((r) => String(r.blocker_id)).filter(Boolean));

  // Replace cloud-user block list with cloud truth (both directions).
  db.replaceCloudBlocks([...blockedByMe], [...blockedMe]);
}

export function queueCloudBlock(targetUserId: string, blocked: boolean): void {
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId) || !isCloudAuthUserId(targetUserId)) return;
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  if (blocked) {
    blockedByMe.add(targetUserId);
    void supabase
      .from('user_blocks')
      .upsert({ blocker_id: meId, blocked_id: targetUserId }, { onConflict: 'blocker_id,blocked_id' })
      .then(({ error }) => {
        if (error) console.warn('[blocks] upsert failed:', error.message);
      });
    return;
  }

  blockedByMe.delete(targetUserId);
  void supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', meId)
    .eq('blocked_id', targetUserId)
    .then(({ error }) => {
      if (error) console.warn('[blocks] delete failed:', error.message);
    });
}

export function startCloudBlocksRealtime(userId: string): () => void {
  stopCloudBlocksRealtime();
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return () => {};
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  void syncCloudBlocks();

  channel = supabase
    .channel(`user-blocks:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_blocks' },
      () => {
        void syncCloudBlocks();
      },
    )
    .subscribe();

  return stopCloudBlocksRealtime;
}

export function stopCloudBlocksRealtime(): void {
  const supabase = getSupabaseClient();
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
}
