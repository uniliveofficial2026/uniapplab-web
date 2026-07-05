/** Staff entry code — never shown in the UI. */
const WORKSPACE_STAFF_CODE = '1998';

const LEGACY_SESSION_KEY = 'instacollab.workspace.staffUnlock';

/** Always require the code; never persist unlock across visits. */
export function verifyWorkspaceAccessCode(code: string): boolean {
  return code.trim() === WORKSPACE_STAFF_CODE;
}

/** Clear any legacy session unlock so there is no bypass. */
export function clearWorkspaceSessionUnlock(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
