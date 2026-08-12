import type { User } from '../types';
import { isFirebaseConfigured } from './firebase/config';
import { isSupabaseConfigured } from './supabase/config';
import { searchSupabaseProfiles } from './supabase/profileSearch';
import { safeString } from './safe';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { normalizeSearchTerm } from './searchNormalize';

export { normalizeSearchTerm } from './searchNormalize';

function searchableUserPart(value: unknown): string {
  return safeString(value).toLowerCase().replace(/^@+/, '');
}

/** Match username, display name, or public user id (case-insensitive; `@` optional). */
export function userMatchesSearchQuery(user: User, query: string): boolean {
  const term = normalizeSearchTerm(query);
  if (!term) return true;
  const haystack = [
    user.username,
    user.displayName,
    user.publicUserId,
    user.id,
  ]
    .map(searchableUserPart)
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

  if (isSupabaseConfigured()) {
    return searchSupabaseProfiles(term, limit);
  }
  if (isFirebaseConfigured()) {
    const { searchFirebaseProfiles } = await import('./firebase/profileSearch');
    return searchFirebaseProfiles(term, limit);
  }
  return [];
}
