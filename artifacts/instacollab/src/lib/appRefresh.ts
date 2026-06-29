export const TAP_REFRESH_EVENT = 'app:tap-refresh';

export type TapRefreshScope = 'home' | 'karaoke' | 'global';

export function dispatchTapRefresh(scope: TapRefreshScope = 'global') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TAP_REFRESH_EVENT, { detail: { scope } })
  );
}

export function scrollAppMainToTop(behavior: ScrollBehavior = 'smooth') {
  if (typeof document === 'undefined') return;
  document.querySelector('main')?.scrollTo({ top: 0, behavior });
}
