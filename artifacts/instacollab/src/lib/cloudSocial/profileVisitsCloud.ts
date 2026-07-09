import {
  fetchFirebaseProfileVisits,
  isFirebaseProfileVisitsAvailable,
  subscribeFirebaseProfileVisits,
  upsertFirebaseProfileVisit,
  type FirebaseProfileVisitRow,
} from '../firebase/profileVisits';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';
import { getSupabaseClient } from '../supabase/client';

export type { FirebaseProfileVisitRow as ProfileVisitRow };

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
  if (shouldUseFirebaseForSocialCloud(input.visitorId) && isFirebaseProfileVisitsAvailable()) {
    await upsertFirebaseProfileVisit(input);
    return;
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
    if (isFirebaseProfileVisitsAvailable()) await upsertFirebaseProfileVisit(input);
  }
}

export async function fetchCloudProfileVisits(ownerId: string, limit = 100): Promise<FirebaseProfileVisitRow[]> {
  if (shouldUseFirebaseForSocialCloud(ownerId) && isFirebaseProfileVisitsAvailable()) {
    return fetchFirebaseProfileVisits(ownerId, limit);
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
    return (data ?? []) as FirebaseProfileVisitRow[];
  } catch {
    if (isFirebaseProfileVisitsAvailable()) return fetchFirebaseProfileVisits(ownerId, limit);
    return [];
  }
}

export function subscribeCloudProfileVisits(
  ownerId: string,
  onRow: (row: FirebaseProfileVisitRow) => void,
): () => void {
  if (shouldUseFirebaseForSocialCloud(ownerId) && isFirebaseProfileVisitsAvailable()) {
    return subscribeFirebaseProfileVisits(ownerId, onRow);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`profile-visits:${ownerId}:${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_visits',
        filter: `owner_id=eq.${ownerId}`,
      },
      (payload) => {
        const row = payload.new as FirebaseProfileVisitRow;
        if (row?.visitor_id) onRow(row);
      },
    )
    .subscribe();

  const unsubFb = isFirebaseProfileVisitsAvailable()
    ? subscribeFirebaseProfileVisits(ownerId, onRow)
    : () => undefined;

  return () => {
    void supabase.removeChannel(channel);
    unsubFb();
  };
}
