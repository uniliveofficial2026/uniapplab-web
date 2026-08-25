import { useEffect, useState } from 'react';
import { isCloudAuthConfigured } from '../lib/auth/config';
import { isCloudPublicUserIdAvailable } from '../lib/auth/cloudProfile';
import { identityOwnerIds } from '../lib/auth/firebaseBackupLink';
import { db } from '../lib/db/localDb';
import {
  isLocalPublicUserIdAvailable,
  normalizePublicUserId,
  type PublicUserIdAvailabilityStatus,
  resolvePublicUserId,
  validatePublicUserId,
} from '../lib/publicUserId';
import type { User } from '../types';

const DEBOUNCE_MS = 320;

type Options = {
  /** Auth user id that may keep the current ID. */
  exceptUserId: string;
  /** Current accepted User ID — treated as available without a network round-trip. */
  currentPublicUserId?: string;
  /** Extra local users to check (defaults to db.users). */
  localUsers?: User[];
  enabled?: boolean;
};

/**
 * Live User ID filter for profile setup + settings.
 * Blocks taken IDs across local cache and every configured cloud backend.
 * Linked Firebase + Supabase uids count as one owner.
 */
export function usePublicUserIdAvailability(
  draft: string,
  options: Options,
): PublicUserIdAvailabilityStatus {
  const {
    exceptUserId,
    currentPublicUserId,
    localUsers,
    enabled = true,
  } = options;
  const [status, setStatus] = useState<PublicUserIdAvailabilityStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    const validated = validatePublicUserId(draft);
    if (!validated.ok) {
      setStatus(draft.trim() ? 'invalid' : 'idle');
      return;
    }

    const current = currentPublicUserId
      ? normalizePublicUserId(currentPublicUserId)
      : '';
    if (current && validated.value === current) {
      setStatus('available');
      return;
    }

    const owners = identityOwnerIds(exceptUserId);
    const users = localUsers ?? db.users;
    if (!isLocalPublicUserIdAvailable(users, validated.value, owners)) {
      setStatus('taken');
      return;
    }

    if (!isCloudAuthConfigured()) {
      setStatus('available');
      return;
    }

    let cancelled = false;
    setStatus('checking');
    const timer = window.setTimeout(() => {
      void isCloudPublicUserIdAvailable(validated.value, exceptUserId)
        .then((free) => {
          if (cancelled) return;
          setStatus(free ? 'available' : 'taken');
        })
        .catch(() => {
          if (!cancelled) setStatus('unreachable');
        });
    }, DEBOUNCE_MS);

    const hardCap = window.setTimeout(() => {
      if (!cancelled) setStatus((prev) => (prev === 'checking' ? 'unreachable' : prev));
    }, 6_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(hardCap);
    };
  }, [
    draft,
    exceptUserId,
    currentPublicUserId,
    localUsers,
    enabled,
  ]);

  return status;
}

/** Shared save-time gate used by setup + settings. */
export async function ensurePublicUserIdFree(input: {
  draft: string;
  exceptUserId: string;
  localUsers?: User[];
}): Promise<{ ok: true; value: string } | { ok: false; reason: string }> {
  const validated = validatePublicUserId(input.draft);
  if (!validated.ok) return validated;

  const owners = identityOwnerIds(input.exceptUserId);
  const users = input.localUsers ?? db.users;
  if (!isLocalPublicUserIdAvailable(users, validated.value, owners)) {
    return { ok: false, reason: 'This User ID is already taken. Choose a different one.' };
  }

  if (isCloudAuthConfigured()) {
    const free = await isCloudPublicUserIdAvailable(validated.value, input.exceptUserId);
    if (!free) {
      return {
        ok: false,
        reason:
          'This User ID is already taken or could not be verified. Choose a different one.',
      };
    }
  }

  return { ok: true, value: validated.value };
}

export function currentResolvedPublicUserId(user: Pick<User, 'publicUserId' | 'username'>): string {
  return resolvePublicUserId(user);
}
