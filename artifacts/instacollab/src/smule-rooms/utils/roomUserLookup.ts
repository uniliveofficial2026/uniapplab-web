import { db } from '../../lib/db/localDb';

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function compactLabel(label: string): string {
  return normalizeLabel(label).replace(/\s+/g, '');
}

function stripRoomGeneratedNameSuffix(label: string): string {
  return label.replace(/_\d{3,}$/, '').trim();
}

function stripHostRoleSuffix(label: string): string {
  return label.replace(/\s*\(Host\)\s*$/i, '').trim();
}

/** Resolve a display name / username label to an app user id (IndexedDB users table). */
export function lookupUserIdByDisplayName(label: string | undefined | null): string | undefined {
  const needle = label?.trim();
  if (!needle) return undefined;

  const candidates = [
    needle,
    stripRoomGeneratedNameSuffix(needle),
    stripHostRoleSuffix(needle),
    stripHostRoleSuffix(stripRoomGeneratedNameSuffix(needle)),
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  for (const candidate of candidates) {
    const needleNorm = normalizeLabel(candidate);
    const needleCompact = compactLabel(candidate);

    const match = db.users.find((user) => {
      const display = user.displayName?.trim();
      const username = user.username?.trim();
      if (!display && !username) return false;

      if (display && normalizeLabel(display) === needleNorm) return true;
      if (username && normalizeLabel(username) === needleNorm) return true;

      const usernameCompact = username ? compactLabel(username) : '';
      if (usernameCompact && usernameCompact === needleCompact) return true;

      return false;
    });

    if (match?.id) return match.id;
  }

  return undefined;
}

export function isSimulatedRoomUserId(userId: string | null | undefined): boolean {
  const id = userId?.trim();
  if (!id) return false;
  return id.startsWith('sim-') || id.startsWith('chat-');
}
