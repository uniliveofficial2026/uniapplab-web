/**
 * Prefetch likely next route chunks after the current screen is stable.
 * Never competes with an active user action, save-data, slow-2g, or background.
 */

let token = 0;
let cancelled = false;

function connectionAllowsPrefetch(): boolean {
  if (typeof navigator === "undefined") return true;
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (conn?.saveData) return false;
  const type = String(conn?.effectiveType || "");
  if (type === "slow-2g" || type === "2g") return false;
  return true;
}

function allowPrefetch(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return false;
  return connectionAllowsPrefetch();
}

const LIKELY_NEXT: Record<string, Array<() => Promise<unknown>>> = {
  home: [
    () => import("../components/messages/MessagesScreen"),
    () => import("../components/search/SearchScreen"),
    () => import("../components/live/LiveScreen"),
  ],
  messages: [() => import("../components/profile/ProfileScreen")],
  search: [() => import("../components/profile/ProfileScreen")],
  live: [() => import("../smule-rooms/RoomsHost")],
  karaoke: [() => import("../smule-rooms/RoomsHost")],
};

export function cancelRoutePrefetch(): void {
  cancelled = true;
  token += 1;
}

export function scheduleLikelyNextPrefetch(currentTab: string): void {
  if (!allowPrefetch()) return;
  cancelled = false;
  const myToken = ++token;
  const run = () => {
    if (cancelled || myToken !== token || !allowPrefetch()) return;
    for (const factory of LIKELY_NEXT[currentTab] || []) {
      void factory().catch(() => undefined);
    }
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    globalThis.setTimeout(run, 400);
  }
}
