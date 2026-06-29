import type { KaraokeProfileReturnContext } from './karaokeReturnContext';
import { canOpenKnownAppProfile, consumePendingAppProfileUserId, resolveCanonicalAppUserId, setPendingAppProfileUserId } from './profileIdentity';
import { syncKaraokeUrl } from './karaokeSearch';
import { formatProfileHandle } from './profileDisplay';
import { db } from './db/localDb';
import { findUserById, safeUsername } from './safe';

export type ProfileSurface = 'app' | 'karaoke';

export type KaraokeProfileTab = 'covers' | 'duets' | 'playlists';

/** True when K-Star (karaoke screen or embedded party room) is the active profile surface. */
export function isKaraokeProfileSurface(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(
    document.querySelector('.karaoke-smule-room-embed') ||
    document.querySelector('[data-karaoke-surface="true"]')
  );
}

export function getActiveProfileSurface(): ProfileSurface {
  return isKaraokeProfileSurface() ? 'karaoke' : 'app';
}

function buildKaraokeUserUrlParam(
  userId: string | null,
  username?: string | null,
): string | null {
  if (!userId) return null;
  const user = findUserById(db.users, userId);
  if (user.id !== 'unknown') {
    const handle = formatProfileHandle(user);
    if (handle) return handle.replace(/^@/, '');
  }
  if (username?.trim()) return safeUsername(username).replace(/^@/, '');
  return null;
}

/** Open the main InstaCollab profile tab (feed app profile). */
export function openAppProfileSurface(options: {
  userId: string | null;
  displayName?: string | null;
  username?: string | null;
  isSelf?: boolean;
}): void {
  const userId = options.isSelf
    ? null
    : resolveCanonicalAppUserId(
        options.userId,
        options.displayName,
        options.username,
      );

  setPendingAppProfileUserId(userId);

  window.dispatchEvent(
    new CustomEvent('navigate', {
      detail: {
        tab: 'profile',
        ...(userId ? { userId } : {}),
      },
    }),
  );
}

/** Open the K-Star profile tab inside Karaoke. */
export function openKaraokeProfileSurface(options: {
  userId: string | null;
  displayName?: string | null;
  username?: string | null;
  isSelf?: boolean;
  profileTab?: KaraokeProfileTab | null;
  closeRoomFlow?: boolean;
  returnContext?: KaraokeProfileReturnContext | null;
}): void {
  const profileTab = options.profileTab ?? 'covers';
  const alreadyOnKaraoke = isKaraokeProfileSurface();
  const canonicalUserId = options.isSelf
    ? null
    : resolveCanonicalAppUserId(
        options.userId,
        options.displayName,
        options.username,
      );
  const userUrlParam = options.isSelf
    ? null
    : buildKaraokeUserUrlParam(canonicalUserId, options.username);

  if (!alreadyOnKaraoke) {
    syncKaraokeUrl({
      tab: 'profile',
      profileTab,
      user: userUrlParam,
      track: null,
      recording: null,
    });
  }

  window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'karaoke' } }));

  const detail = {
    userId: canonicalUserId,
    displayName: options.isSelf ? undefined : options.displayName ?? undefined,
    username: options.isSelf ? undefined : options.username ?? undefined,
    profileTab,
    closeRoomFlow: options.closeRoomFlow ?? false,
    returnContext: options.returnContext ?? undefined,
  };

  const dispatchOpen = () => {
    window.dispatchEvent(new CustomEvent('karaoke-profile-open', { detail }));
  };

  if (alreadyOnKaraoke) {
    dispatchOpen();
    return;
  }

  // KaraokeScreen lazy-mounts after tab switch — defer so the listener is registered.
  requestAnimationFrame(() => {
    requestAnimationFrame(dispatchOpen);
  });
}

export { canOpenKnownAppProfile, resolveCanonicalAppUserId, consumePendingAppProfileUserId };

/** Open a user profile on the current surface (legacy smart default). */
export function openUserProfileSurface(options: {
  userId: string | null;
  isSelf?: boolean;
  profileTab?: KaraokeProfileTab | null;
  closeRoomFlow?: boolean;
  returnContext?: KaraokeProfileReturnContext | null;
}): void {
  if (isKaraokeProfileSurface()) {
    openKaraokeProfileSurface({
      userId: options.userId,
      isSelf: options.isSelf,
      profileTab: options.profileTab,
      closeRoomFlow: options.closeRoomFlow,
      returnContext: options.returnContext,
    });
    return;
  }

  openAppProfileSurface({
    userId: options.userId,
    isSelf: options.isSelf,
  });
}
