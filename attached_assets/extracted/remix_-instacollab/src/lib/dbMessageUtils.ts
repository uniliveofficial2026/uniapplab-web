import type { ChatMessage } from './dbTypes';

/** Strip invalid media URLs from comment/message payloads. */
export function sanitizeMessageMedia<T extends Record<string, unknown>>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const media = (entity as Record<string, unknown>).media;
  if (!Array.isArray(media)) return entity;
  const safeMedia = (media as unknown[]).filter(
    (item): item is { url: string } & Record<string, unknown> =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { url?: unknown }).url === 'string' &&
      (item as { url: string }).url.length > 0 &&
      (item as { url: string }).url !== 'undefined' &&
      (item as { url: string }).url !== 'null'
  );
  if (safeMedia.length === media.length) return entity;
  return { ...entity, media: safeMedia } as T;
}

export function ensureMessageId(message: ChatMessage, chatId: string): ChatMessage {
  if (!message || typeof message !== 'object') return message;
  if (typeof message.id === 'string' && message.id.length > 0) return message;
  return {
    ...message,
    id: `m_${chatId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function normalizeTimestampValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function backfillMessageTimestamps(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return messages;

  const knownTimestamps = messages
    .map((message) => normalizeTimestampValue(message?.timestamp))
    .filter((timestamp): timestamp is number => timestamp !== null);

  const fallbackStart =
    knownTimestamps.length > 0
      ? Math.min(...knownTimestamps) - messages.length * 1000
      : Date.now() - messages.length * 1000;

  const nextMessages = [...messages];
  let changed = false;
  let lastKnownTimestamp: number | null = null;
  const pendingIndexes: number[] = [];

  nextMessages.forEach((message, index) => {
    const normalizedTimestamp = normalizeTimestampValue(message?.timestamp);
    if (normalizedTimestamp !== null) {
      if (typeof message?.timestamp !== 'number' || message.timestamp !== normalizedTimestamp) {
        nextMessages[index] = { ...message, timestamp: normalizedTimestamp };
        changed = true;
      }

      if (pendingIndexes.length > 0) {
        for (let pendingOffset = pendingIndexes.length - 1; pendingOffset >= 0; pendingOffset -= 1) {
          const pendingIndex = pendingIndexes[pendingOffset];
          const inferredTimestamp = Math.max(0, normalizedTimestamp - (pendingOffset + 1) * 1000);
          nextMessages[pendingIndex] = { ...nextMessages[pendingIndex], timestamp: inferredTimestamp };
          changed = true;
        }
        pendingIndexes.length = 0;
      }

      lastKnownTimestamp = normalizedTimestamp;
      return;
    }

    if (lastKnownTimestamp !== null) {
      const inferredTimestamp = lastKnownTimestamp + 1000;
      nextMessages[index] = { ...message, timestamp: inferredTimestamp };
      lastKnownTimestamp = inferredTimestamp;
      changed = true;
      return;
    }

    pendingIndexes.push(index);
  });

  if (pendingIndexes.length > 0) {
    pendingIndexes.forEach((pendingIndex, pendingOffset) => {
      const inferredTimestamp = fallbackStart + pendingOffset * 1000;
      nextMessages[pendingIndex] = { ...nextMessages[pendingIndex], timestamp: inferredTimestamp };
      changed = true;
    });
  }

  return changed ? nextMessages : messages;
}
