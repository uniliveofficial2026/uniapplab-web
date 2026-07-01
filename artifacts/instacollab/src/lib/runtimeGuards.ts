/** Global handlers so stray promise rejections do not fail silently in production. */
export function installRuntimeGuards(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[app] unhandled rejection:', event.reason);
  });

  window.addEventListener('error', (event) => {
    console.error('[app] uncaught error:', event.error ?? event.message);
  });
}
