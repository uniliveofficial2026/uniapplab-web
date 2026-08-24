/** True when UniLive’s is the live canvas inside the admin studio (or a smoke embed). */
export function isAdminStudioEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.parent !== window) return true;
  } catch {
    return true;
  }
  const q = String(window.location.search || '');
  return /(?:^|[?&])(?:pick=1|adminPick=1|adminOrigin=|force_demo=1)/.test(q);
}
