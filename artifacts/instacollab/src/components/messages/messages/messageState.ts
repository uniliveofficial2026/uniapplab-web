import type { ChatMessage } from '../../../types';
import { getMessageTimestampMs } from './messageTime';

export const SLOW_SEND_MS = 1500;
/** Outbound sends older than this are treated as delivered locally (stale sync state). */
export const STALE_SEND_MS = 5 * 60_000;

export function isMessageDeleted(message: ChatMessage | null | undefined): boolean {
  if (!message || typeof message !== 'object') return false;
  return !!(message.deleted || message.isDeleted);
}

export function isMessageHiddenForMe(message: ChatMessage | null | undefined): boolean {
  if (!message || typeof message !== 'object') return false;
  return !!message.hiddenForMe;
}

export function deliveryStatusLabel(status: ChatMessage['deliveryStatus']): string | null {
  if (status === 'sending') return 'Sending…';
  if (status === 'failed') return 'Failed';
  if (status === 'sent') return null;
  return null;
}

/** Bubble footer: only surface slow sends (after SLOW_SEND_MS) plus failures. */
export function deliveryStatusLabelForMessage(message: ChatMessage, now = Date.now()): string | null {
  if (message.deliveryStatus === 'failed') return 'Failed';
  if (message.deliveryStatus === 'sending') {
    if (message.cloudId) return null;
    const ts = getMessageTimestampMs(message.timestamp);
    if (ts > 0 && now - ts > STALE_SEND_MS) return null;
    if (ts > 0 && now - ts >= SLOW_SEND_MS) return 'Sending…';
    return null;
  }
  return null;
}

export function countThreadDeliveryStates(thread: ChatMessage[]): {
  sending: number;
  failed: number;
  slowSending: number;
} {
  const now = Date.now();
  let sending = 0;
  let failed = 0;
  let slowSending = 0;
  for (const message of thread) {
    if (message.deliveryStatus === 'failed') failed += 1;
    if (message.deliveryStatus === 'sending') {
      if (message.cloudId) continue;
      const ts = getMessageTimestampMs(message.timestamp);
      if (ts > 0 && now - ts > STALE_SEND_MS) continue;
      sending += 1;
      if (ts > 0 && now - ts >= SLOW_SEND_MS) slowSending += 1;
    }
  }
  return { sending, failed, slowSending };
}
