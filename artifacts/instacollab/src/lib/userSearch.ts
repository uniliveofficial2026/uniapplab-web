import type { User } from '../types';
import { isFirebaseConfigured } from './firebase/config';
import { searchFirebaseProfiles } from './firebase/profileSearch';
import { isSupabaseConfigured } from './supabase/config';
import { searchSupabaseProfiles } from './supabase/profileSearch';
import { safeString } from './safe';
import { isCloudAuthUserId } from './auth/cloudProfile';

function normalizeSearchTerm(query: string): string {
  return query.trim().toLowerCase();
}

/** Match username, display name, or public user id (case-insensitive). */
export function userMatchesSearchQuery(user: User, query: string): boolean {
  const term = normalizeSearchTerm(query);
  if (!term) return true;
  const haystack = [
    user.username,
    user.displayName,
    user.publicUserId,
    user.id,
  ]
    .map((part) => safeString(part).toLowerCase())
    .join(' ');
  return haystack.includes(term);
}

export function filterLocalUsers(users: User[], query: string): User[] {
  const term = normalizeSearchTerm(query);
  if (!term) return users;
  return users.filter((user) => {
    if (isSupabaseConfigured() && !isCloudAuthUserId(user.id)) {
      return false;
    }
    return userMatchesSearchQuery(user, term);
  });
}

/** Merge local + cloud hits; cloud rows win for profile fields, local keeps follow state. */
export function mergeUserSearchResults(
  localUsers: User[],
  cloudUsers: User[],
): User[] {
  const byId = new Map<string, User>();
  for (const user of localUsers) {
    byId.set(user.id, user);
  }
  for (const cloud of cloudUsers) {
    const existing = byId.get(cloud.id);
    if (!existing) {
      byId.set(cloud.id, cloud);
      continue;
    }
    byId.set(cloud.id, {
      ...cloud,
      isFollowing: existing.isFollowing,
      followers: existing.followers ?? cloud.followers,
      following: existing.following ?? cloud.following,
    });
  }
  return Array.from(byId.values());
}

export async function searchCloudProfiles(
  query: string,
  limit = 24,
): Promise<User[]> {
  const term = normalizeSearchTerm(query);
  if (!term) return [];

  const tasks: Promise<User[]>[] = [];
  if (isSupabaseConfigured()) {
    tasks.push(searchSupabaseProfiles(term, limit).catch(() => []));
  }
  if (isFirebaseConfigured()) {
    tasks.push(searchFirebaseProfiles(term, limit).catch(() => []));
  }
  if (tasks.length === 0) return [];

  const batches = await Promise.all(tasks);
  let merged: User[] = [];
  for (const batch of batches) {
    merged = mergeUserSearchResults(merged, batch);
  }
  return merged.slice(0, limit);
}
