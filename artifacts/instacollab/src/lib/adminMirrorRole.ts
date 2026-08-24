/** Mirror follower role — locked from the bootstrap URL before shell sync strips query params. */

const WIN_KEY = '__UNILIVES_MIRROR_FOLLOWER__';

type MirrorFlagWindow = Window & { [WIN_KEY]?: boolean };

function readInitialMirrorFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('mirror') === '1';
  } catch {
    return false;
  }
}

/** Call once as early as possible in embed entry. Safe to call repeatedly. */
export function lockAdminMirrorRoleFromBootstrap(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as MirrorFlagWindow;
  if (typeof w[WIN_KEY] === 'boolean') return w[WIN_KEY]!;
  const flagged = readInitialMirrorFlag();
  w[WIN_KEY] = flagged;
  try {
    document.documentElement.dataset.adminMirrorRole = flagged ? 'follower' : 'primary';
  } catch {
    /* ignore */
  }
  return flagged;
}

export function isAdminMirrorFollower(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as MirrorFlagWindow;
  if (typeof w[WIN_KEY] === 'boolean') return w[WIN_KEY]!;
  return lockAdminMirrorRoleFromBootstrap();
}

// Lock immediately on module evaluation inside the app bundle.
if (typeof window !== 'undefined') {
  lockAdminMirrorRoleFromBootstrap();
}
