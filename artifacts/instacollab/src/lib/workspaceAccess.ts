/** Staff entry — never shown in the UI, never persisted across visits. */

const LEGACY_SESSION_KEY = 'instacollab.workspace.staffUnlock';

/**
 * Local UX fallback only when remote unlock is unavailable.
 * Prefer VITE_WORKSPACE_STAFF_CODE. Production builds fail closed without env.
 * Privileged Admin APIs still require server auth — this gate alone is not authority.
 */
function resolveLocalStaffCode(): string {
  const fromEnv = String(import.meta.env.VITE_WORKSPACE_STAFF_CODE ?? '').trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) {
    // Historical local staff entry for DEV UX only (not Admin API privilege).
    return '1998';
  }
  return '';
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Sync local check — used when remote unlock is unreachable. */
export function verifyWorkspaceAccessCode(code: string): boolean {
  const expected = resolveLocalStaffCode();
  if (!expected) return false;
  return timingSafeEqualUtf8(code.trim(), expected);
}

/**
 * Authoritative unlock via server WORKSPACE_STAFF_CODE.
 * Returns: 'ok' | 'invalid' | 'unavailable' (env unset / network).
 */
export async function unlockWorkspaceRemote(code: string): Promise<'ok' | 'invalid' | 'unavailable'> {
  try {
    const res = await fetch('/api/workspace/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ code: code.trim() }),
    });
    if (res.status === 401) return 'invalid';
    if (res.status === 503) return 'unavailable';
    if (!res.ok) return 'unavailable';
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

/** Clear any legacy session unlock so there is no client-storage bypass. */
export function clearWorkspaceSessionUnlock(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** True when a forged legacy session key is present (must never unlock WorkspaceGate). */
export function legacyWorkspaceUnlockKeyPresent(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(LEGACY_SESSION_KEY) != null;
  } catch {
    return false;
  }
}
