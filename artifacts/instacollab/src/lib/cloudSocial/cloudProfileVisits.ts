/**
 * Profile visits delivered to the profile owner over the internet.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ProfileVisitEntry, ProfileVisitSurface } from '../../types';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { fetchProfile, profileRowToUser } from '../supabase/profile';

type VisitRow = {
  id: string;
  owner_id: string;
  visitor_id: string;
  surface: string;
  content_id: string | null;
  preview_url: string | null;
  live_kind: string | null;
  visit_count: number;
  visited_at: string;
};

let channel: RealtimeChannel | null = null;

export function queueCloudProfileVisit(input: {
  ownerId: string;
  surface?: string;
  contentId?: string;
  previewUrl?: string;
  liveKind?: string;
}): void {
  const visitorId = db.currentUserId;
  if (!visitorId || !isCloudAuthUserId(visitorId)) return;
  if (!isCloudAuthUserId(input.ownerId) || input.ownerId === visitorId) return;
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  void (async () => {
    const { data: existing } = await supabase
      .from('profile_visits')
      .select('id, visit_count')
      .eq('owner_id', input.ownerId)
      .eq('visitor_id', visitorId)
      .maybeSingle();

    const payload = {
      owner_id: input.ownerId,
      visitor_id: visitorId,
      surface: input.surface ?? 'profile',
      content_id: input.contentId ?? null,
      preview_url: input.previewUrl ?? null,
      live_kind: input.liveKind ?? null,
      visit_count: existing ? Number(existing.visit_count || 0) + 1 : 1,
      visited_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('profile_visits')
        .update(payload)
        .eq('id', existing.id);
      if (error) console.warn('[visits] update failed:', error.message);
      return;
    }

    const { error } = await supabase.from('profile_visits').insert(payload);
    if (error) console.warn('[visits] insert failed:', error.message);
  })();
}

async function applyVisitRow(row: VisitRow): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || row.owner_id !== meId) return;
  if (!db.users.some((u) => u.id === row.visitor_id)) {
    const profile = await fetchProfile(row.visitor_id).catch(() => null);
    if (profile) db.cacheDiscoveredUsers([profileRowToUser(profile)]);
  }
  const entry: ProfileVisitEntry = {
    visitorUserId: row.visitor_id,
    lastVisitedAt: Date.parse(row.visited_at) || Date.now(),
    visitCount: row.visit_count || 1,
    lastSurface: (row.surface as ProfileVisitSurface) || 'profile',
    lastContentId: row.content_id ?? undefined,
    lastPreviewUrl: row.preview_url ?? undefined,
    lastLiveKind: (row.live_kind as ProfileVisitEntry['lastLiveKind']) ?? undefined,
  };
  db.mergeInboundProfileVisit(entry);
}

export async function syncCloudProfileVisits(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from('profile_visits')
    .select('*')
    .eq('owner_id', meId)
    .order('visited_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('[visits] sync failed:', error.message);
    return;
  }
  for (const row of (data ?? []) as VisitRow[]) {
    await applyVisitRow(row);
  }
}

export function startCloudProfileVisitsRealtime(userId: string): () => void {
  stopCloudProfileVisitsRealtime();
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return () => {};
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  void syncCloudProfileVisits();

  channel = supabase
    .channel(`profile-visits:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_visits',
        filter: `owner_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as VisitRow;
        if (row?.visitor_id) void applyVisitRow(row);
      },
    )
    .subscribe();

  return stopCloudProfileVisitsRealtime;
}

export function stopCloudProfileVisitsRealtime(): void {
  const supabase = getSupabaseClient();
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
}
