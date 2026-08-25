/**
 * Cap cold-start / appUrlOpen may deliver OAuth/session deep links before
 * Supabase client + AuthProvider finish boot. Queue until ready.
 */
let pendingUrl: string | null = null;
let ready = false;

export function noteNativeAuthDeepLink(url: string): void {
  if (!url) return;
  pendingUrl = url;
}

export function markNativeAuthBootReady(): void {
  ready = true;
}

export function isNativeAuthBootReady(): boolean {
  return ready;
}

export function consumePendingNativeAuthDeepLink(): string | null {
  if (!ready || !pendingUrl) return null;
  const url = pendingUrl;
  pendingUrl = null;
  return url;
}

export function peekPendingNativeAuthDeepLink(): string | null {
  return pendingUrl;
}

/** Mark boot ready and apply any queued Cap OAuth/session deep link. */
export async function flushPendingNativeAuthDeepLink(): Promise<'inline' | 'navigate' | false> {
  markNativeAuthBootReady();
  const pending = consumePendingNativeAuthDeepLink();
  if (!pending) return false;
  const { handleNativeOAuthDeepLink } = await import('./nativeOAuth');
  return handleNativeOAuthDeepLink(pending);
}
