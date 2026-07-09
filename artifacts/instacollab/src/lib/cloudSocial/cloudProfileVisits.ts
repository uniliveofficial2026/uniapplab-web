/**
 * Profile visits delivered to the profile owner over the internet.
 */
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import type { LiveKind } from '../../types';
import { fetchProfile, profileRowToUser } from '../supabase/profile';
import {
  fetchCloudProfileVisits,
  isProfileVisitsCloudAvailable,
  subscribeCloudProfileVisits,
  upsertCloudProfileVisit,
  type ProfileVisitRow,
} from './profileVisitsCloud';

let unsubscribe: (() => void) | null = null;

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
  if (!isProfileVisitsCloudAvailable()) return;

  void upsertCloudProfileVisit({
    ownerId: input.ownerId,
    visitorId,
    surface: input.surface,
    contentId: input.contentId,
    previewUrl: input.previewUrl,
    liveKind: input.liveKind,
  }).catch((err) => {
    console.warn('[visits] upsert failed:', err);
  });
}

async function applyVisitRow(row: ProfileVisitRow): Promise<void> {
  const meId = db.currentUserId;
  if (!meId || row.owner_id !== meId) return;
  if (!db.users.some((u) => u.id === row.visitor_id)) {
    const profile = await fetchProfile(row.visitor_id).catch(() => null);
    if (profile) db.cacheDiscoveredUsers([profileRowToUser(profile)]);
  }
  db.mergeInboundProfileVisit({
    visitorUserId: row.visitor_id,
    lastVisitedAt: Date.parse(row.visited_at) || Date.now(),
    visitCount: row.visit_count || 1,
    lastSurface: (row.surface as 'profile') || 'profile',
    lastContentId: row.content_id ?? undefined,
    lastPreviewUrl: row.preview_url ?? undefined,
    lastLiveKind: (row.live_kind as LiveKind | null | undefined) ?? undefined,
  });
}

export async function syncCloudProfileVisits(): Promise<void> {
  if (!isProfileVisitsCloudAvailable()) return;
  const meId = db.currentUserId;
  if (!meId || !isCloudAuthUserId(meId)) return;

  const rows = await fetchCloudProfileVisits(meId);
  for (const row of rows) {
    await applyVisitRow(row);
  }
}

export function startCloudProfileVisitsRealtime(userId: string): () => void {
  stopCloudProfileVisitsRealtime();
  if (!isProfileVisitsCloudAvailable() || !isCloudAuthUserId(userId)) return () => {};

  void syncCloudProfileVisits();
  unsubscribe = subscribeCloudProfileVisits(userId, (row) => {
    void applyVisitRow(row);
  });

  return stopCloudProfileVisitsRealtime;
}

export function stopCloudProfileVisitsRealtime(): void {
  unsubscribe?.();
  unsubscribe = null;
}
