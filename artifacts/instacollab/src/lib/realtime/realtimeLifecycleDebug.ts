/**
 * Development-only realtime lifecycle diagnostics (Phase 11).
 * Never logs tokens, message bodies, or PII beyond redacted ids.
 */

const DEV =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

function redactId(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '(none)';
  if (raw.length <= 8) return `${raw.slice(0, 2)}…`;
  return `${raw.slice(0, 4)}…${raw.slice(-2)}`;
}

export function realtimeLifecycleDebug(
  event: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!DEV) return;
  const safe: Record<string, string | number | boolean> = {};
  if (detail) {
    for (const [key, value] of Object.entries(detail)) {
      if (value == null) continue;
      if (
        /token|secret|password|authorization|payload|message/i.test(key) ||
        (typeof value === 'string' && value.length > 64)
      ) {
        continue;
      }
      if (/id|user|room|participant/i.test(key) && typeof value === 'string') {
        safe[key] = redactId(value);
      } else {
        safe[key] = value;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.debug(`[realtime-lifecycle] ${event}`, safe);
}
