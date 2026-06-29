/** Parse ISO strings, numeric ms, or Date-like values for content timestamps. */
export function parseContentTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  return null;
}

function formatContentDateTimeAbsolute(value: unknown): string {
  const date = parseContentTimestamp(value);
  if (!date) return 'Unknown time';

  const datePart = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${datePart} · ${timePart}`;
}

/** Compact relative time: just now, 45s ago, 5m ago, 2h ago, 3d ago, 2w ago. */
export function formatContentTimeAgo(value: unknown, now = Date.now()): string {
  const date = parseContentTimestamp(value);
  if (!date) return 'Unknown time';

  const diffMs = Math.max(0, now - date.getTime());
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  return formatContentDateTimeAbsolute(value);
}

/** Relative (s/m/h) + absolute date/time when recent; absolute only when older. */
export function formatContentDateTime(value: unknown, now = Date.now()): string {
  const full = formatContentDateTimeAbsolute(value);
  if (full === 'Unknown time') return full;

  const ago = formatContentTimeAgo(value, now);
  const isRelative =
    ago === 'just now' || /^\d+[smhdw] ago$/.test(ago) || ago.endsWith('s ago');
  if (isRelative) return `${ago} · ${full}`;
  return full;
}

export function formatRepostedDateTime(value: unknown, now = Date.now()): string {
  const formatted = formatContentDateTime(value, now);
  return formatted === 'Unknown time' ? 'Reposted' : `Reposted · ${formatted}`;
}

export function formatPostedDateTime(value: unknown, now = Date.now()): string {
  const formatted = formatContentDateTime(value, now);
  return formatted === 'Unknown time' ? 'Posted' : `Posted · ${formatted}`;
}

/** ISO string for `<time dateTime>` attributes. */
export function contentTimestampIso(value: unknown): string | undefined {
  const date = parseContentTimestamp(value);
  return date ? date.toISOString() : undefined;
}
