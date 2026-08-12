import type { CloudNotificationRow } from './cloudSocialTypes';
import { isFirebaseConfigured } from '../firebase/config';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';
import { getSupabaseClient } from '../supabase/client';
import {
  removeSafeRealtimeChannel,
  subscribeSafeRealtimeChannel,
} from '../supabase/safeRealtimeChannel';

export type { CloudNotificationRow };
export type FirebaseNotificationRow = CloudNotificationRow;

async function firebaseNotifications() {
  return import('../firebase/notifications');
}

export function isNotificationsCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

export async function insertUserNotification(input: {
  userId: string;
  type: string;
  actorId: string;
  body?: string;
}): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(input.actorId) && isFirebaseConfigured()) {
    const fb = await firebaseNotifications();
    if (fb.isFirebaseNotificationsAvailable()) {
      await fb.insertFirebaseUserNotification(input);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('user_notifications').insert({
      user_id: input.userId,
      type: input.type,
      actor_id: input.actorId,
      body: input.body ?? null,
    });
    if (error) throw error;
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseNotifications();
      if (fb.isFirebaseNotificationsAvailable()) await fb.insertFirebaseUserNotification(input);
    }
  }
}

export async function fetchCloudNotifications(userId: string, limit = 100): Promise<CloudNotificationRow[]> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseNotifications();
    if (fb.isFirebaseNotificationsAvailable()) {
      return fb.fetchFirebaseNotifications(userId, limit);
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('id, user_id, type, actor_id, body, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as CloudNotificationRow[];
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseNotifications();
      if (fb.isFirebaseNotificationsAvailable()) return fb.fetchFirebaseNotifications(userId, limit);
    }
    return [];
  }
}

export async function markCloudNotificationRead(notificationId: string, userId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseNotifications();
    if (fb.isFirebaseNotificationsAvailable()) {
      await fb.markFirebaseNotificationRead(notificationId, userId);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseNotifications();
      if (fb.isFirebaseNotificationsAvailable()) await fb.markFirebaseNotificationRead(notificationId, userId);
    }
  }
}

export async function markAllCloudNotificationsRead(userId: string): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    const fb = await firebaseNotifications();
    if (fb.isFirebaseNotificationsAvailable()) {
      await fb.markAllFirebaseNotificationsRead(userId);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseNotifications();
      if (fb.isFirebaseNotificationsAvailable()) await fb.markAllFirebaseNotificationsRead(userId);
    }
  }
}

export function subscribeCloudNotifications(
  userId: string,
  onRow: (row: CloudNotificationRow) => void,
): () => void {
  if (shouldUseFirebaseForSocialCloud(userId) && isFirebaseConfigured()) {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void firebaseNotifications().then((fb) => {
      if (cancelled || !fb.isFirebaseNotificationsAvailable()) return;
      unsub = fb.subscribeFirebaseNotifications(userId, onRow);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const apply = (payload: { new: Record<string, unknown> }) => {
    onRow(payload.new as CloudNotificationRow);
  };

  const channel = subscribeSafeRealtimeChannel(supabase, `user-notifications:${userId}`, (ch) => {
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
      apply,
    ).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
      apply,
    );
  });

  return () => {
    removeSafeRealtimeChannel(supabase, channel);
  };
}
