import { useMemo } from 'react';
import type { User } from '../types';
import { useAuth } from './AuthContext';
import { isPrimarySupabaseCloud } from './auth/config';
import { resolveUser } from './safe';
import { useDB, useDbRevision } from './useDB';

function authProfileToUserPartial(profile: Record<string, unknown> | null | undefined): Partial<User> | null {
  if (!profile) return null;
  const id = (profile.id ?? profile.uid) as string | undefined;
  if (!id?.trim()) return null;
  const fullName = profile.fullName as string | undefined;
  const displayName = (profile.displayName ?? fullName) as string | undefined;
  const username = (profile.username ?? displayName ?? fullName) as string | undefined;
  return {
    id: id.trim(),
    username: typeof username === 'string' ? username : 'user',
    displayName: typeof displayName === 'string' ? displayName : 'User',
    avatarUrl: (profile.avatarUrl ?? profile.photoURL) as string | undefined,
    bio: profile.bio as string | undefined,
    isVerified: profile.isVerified as boolean | undefined,
    followers: profile.followers as number | undefined,
    following: profile.following as number | undefined,
  };
}

/** Canonical current user for UI — merges IndexedDB user with optional Firebase auth profile. */
export function useCurrentUser(): User {
  const db = useDB();
  const revision = useDbRevision();
  const { profile: authProfile } = useAuth();
  const supabasePrimary = isPrimarySupabaseCloud();
  const authPartial = supabasePrimary ? null : authProfileToUserPartial(authProfile);
  const canonicalId = db.currentUser?.id;

  return useMemo(() => {
    const safeAuthPartial =
      authPartial && canonicalId && authPartial.id !== canonicalId ? null : authPartial;
    return resolveUser(db.users, safeAuthPartial ?? db.currentUser, db.currentUser);
  }, [
    revision,
    canonicalId,
    db.users,
    authPartial?.id,
    authPartial?.username,
    authPartial?.displayName,
    authPartial?.avatarUrl,
    authPartial?.bio,
    authPartial?.isVerified,
  ]);
}
