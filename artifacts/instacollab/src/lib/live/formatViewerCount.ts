/** Compact viewer/participant count for live cards (e.g. 842, 1.2K). */
export function formatViewerCount(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(n);
}

export function parseViewerCount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (!trimmed || /^live$/i.test(trimmed)) return 0;
  const match = trimmed.match(/^([\d.]+)\s*([kmb])?/i);
  if (!match) {
    const digits = trimmed.replace(/[^\d]/g, '');
    return digits ? Math.max(0, parseInt(digits, 10) || 0) : 0;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'k') return Math.max(0, Math.floor(value * 1_000));
  if (unit === 'm') return Math.max(0, Math.floor(value * 1_000_000));
  if (unit === 'b') return Math.max(0, Math.floor(value * 1_000_000_000));
  return Math.max(0, Math.floor(value));
}
