import type { CloudProfileVisitRow } from './cloudSocialTypes';
import { isFirebaseConfigured } from '../firebase/config';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';
import { getSupabaseClient } from '../supabase/client';
import {
  removeSafeRealtimeChannel,
  subscribeSafeRealtimeChannel,
} from '../supabase/safeRealtimeChannel';

export type { CloudProfileVisitRow };
export type FirebaseProfileVisitRow = CloudProfileVisitRow;
export type ProfileVisitRow = CloudProfileVisitRow;

async function firebaseProfileVisits() {
  return import('../firebase/profileVisits');
}

export function isProfileVisitsCloudAvailable(): boolean {
  return isSocialCloudAvailable();
}

export async function upsertCloudProfileVisit(input: {
  ownerId: string;
  visitorId: string;
  surface?: string;
  contentId?: string;
  previewUrl?: string;
  liveKind?: string;
}): Promise<void> {
  if (shouldUseFirebaseForSocialCloud(input.visitorId) && isFirebaseConfigured()) {
    const fb = await firebaseProfileVisits();
    if (fb.isFirebaseProfileVisitsAvailable()) {
      await fb.upsertFirebaseProfileVisit(input);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data: existing } = await supabase
      .from('profile_visits')
      .select('id, visit_count')
      .eq('owner_id', input.ownerId)
      .eq('visitor_id', input.visitorId)
      .maybeSingle();

    const payload = {
      owner_id: input.ownerId,
      visitor_id: input.visitorId,
      surface: input.surface ?? 'profile',
      content_id: input.contentId ?? null,
      preview_url: input.previewUrl ?? null,
      live_kind: input.liveKind ?? null,
      visit_count: existing ? Number(existing.visit_count || 0) + 1 : 1,
      visited_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase.from('profile_visits').update(payload).eq('id', existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('profile_visits').insert(payload);
    if (error) throw error;
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseProfileVisits();
      if (fb.isFirebaseProfileVisitsAvailable()) await fb.upsertFirebaseProfileVisit(input);
    }
  }
}

export async function fetchCloudProfileVisits(ownerId: string, limit = 100): Promise<ProfileVisitRow[]> {
  if (shouldUseFirebaseForSocialCloud(ownerId) && isFirebaseConfigured()) {
    const fb = await firebaseProfileVisits();
    if (fb.isFirebaseProfileVisitsAvailable()) {
      return fb.fetchFirebaseProfileVisits(ownerId, limit);
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('profile_visits')
      .select('*')
      .eq('owner_id', ownerId)
      .order('visited_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ProfileVisitRow[];
  } catch {
    if (isFirebaseConfigured()) {
      const fb = await firebaseProfileVisits();
      if (fb.isFirebaseProfileVisitsAvailable()) return fb.fetchFirebaseProfileVisits(ownerId, limit);
    }
    return [];
  }
}

export function subscribeCloudProfileVisits(
  ownerId: string,
  onRow: (row: ProfileVisitRow) => void,
): () => void {
  if (shouldUseFirebaseForSocialCloud(ownerId) && isFirebaseConfigured()) {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void firebaseProfileVisits().then((fb) => {
      if (cancelled || !fb.isFirebaseProfileVisitsAvailable()) return;
      unsub = fb.subscribeFirebaseProfileVisits(ownerId, onRow);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const channel = subscribeSafeRealtimeChannel(supabase, `profile-visits:${ownerId}`, (ch) => {
    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_visits',
        filter: `owner_id=eq.${ownerId}`,
      },
      (payload) => {
        const row = payload.new as ProfileVisitRow;
        if (row?.visitor_id) onRow(row);
      },
    );
  });

  return () => {
    removeSafeRealtimeChannel(supabase, channel);
  };
}
