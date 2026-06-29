import { normalizeTimestampValue } from '../../../lib/dbMessageUtils';

/** Numeric ms for read receipts and sorting (parses ISO strings; legacy display strings → 0). */
export function getMessageTimestampMs(timestamp: unknown): number {
  return normalizeTimestampValue(timestamp) ?? 0;
}

export function getMessageDateValue(timestamp: unknown): Date | null {
  if (typeof timestamp === 'number') {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  return null;
}

export function getDaySeparatorLabel(timestamp: unknown): string | null {
  const date = getMessageDateValue(timestamp);
  if (!date) return null;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffInDays = Math.round(
    (startOfToday.getTime() - startOfMessageDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export function formatMessageDateTime(timestamp: unknown): string {
  const date = getMessageDateValue(timestamp);
  if (!date) return 'Unknown';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const hour24 = date.getHours();
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hour = String(hour12).padStart(2, '0');

  return `${day}/${month}/${year}, ${hour}:${minute}:${second} ${period}`;
}

export function formatLastSeenLabel(clockTick: number, timestamp?: number): string {
  if (!timestamp || Number.isNaN(timestamp)) return 'Offline';
  const diffMs = clockTick - timestamp;
  if (diffMs < 60_000) return 'Last seen just now';
  if (diffMs < 3_600_000) return `Last seen ${Math.max(1, Math.floor(diffMs / 60_000))}m ago`;
  if (diffMs < 86_400_000) return `Last seen ${Math.max(1, Math.floor(diffMs / 3_600_000))}h ago`;
  return `Last seen ${Math.max(1, Math.floor(diffMs / 86_400_000))}d ago`;
}
