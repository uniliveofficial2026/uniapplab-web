import {
  enqueueOutboxItem,
  listDueOutboxItems,
  removeOutboxItem,
  updateOutboxItem,
  computeOutboxBackoffMs,
  claimOutboxItem,
} from './outboxStore';
import { sendChatMessageApi } from '../platformApi';
import { db } from '../db/localDb';
import { isNetworkOnline, subscribeNetworkStatus } from '../networkStatus';
import type { ChatMessage } from '../dbTypes';

type ChatSendPayload = {
  chatId: string;
  threadId: string;
  message: ChatMessage;
  body: string;
  payload?: Record<string, unknown>;
};

let processing = false;
let networkHookInstalled = false;
let resumeUserId: string | null = null;

export async function enqueueChatMessageSend(
  userId: string,
  chatId: string,
  threadId: string,
  message: ChatMessage,
  body: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const mutationId = String(message.id ?? crypto.randomUUID());
  await enqueueOutboxItem({
    id: crypto.randomUUID(),
    userId,
    domain: 'chat',
    operation: 'sendMessage',
    mutationId,
    payload: {
      chatId,
      threadId,
      message: { ...message, id: mutationId },
      body,
      payload,
    } satisfies ChatSendPayload,
  });
  if (import.meta.env.DEV) {
    console.info('[data:chat] queued', { mutationId, threadId, chatId });
  }
  void processChatOutbox(userId);
}

async function processOneChatItem(userId: string, itemId: string): Promise<void> {
  const claimed = await claimOutboxItem(itemId);
  if (!claimed || claimed.userId !== userId) return;
  if (claimed.domain !== 'chat' || claimed.operation !== 'sendMessage') return;
  const data = claimed.payload as ChatSendPayload;

  try {
    if (import.meta.env.DEV) {
      console.info('[data:chat] sending', {
        mutationId: claimed.mutationId,
        threadId: data.threadId,
      });
    }
    const row = await sendChatMessageApi(
      data.threadId,
      data.body,
      data.payload,
      claimed.mutationId,
    );
    if (data.chatId) {
      if (row?.id) {
        db.attachCloudMessageId(data.chatId, claimed.mutationId, row.id);
      } else {
        db.markMessageDeliveryStatus(data.chatId, claimed.mutationId, 'sent');
      }
    }
    await removeOutboxItem(claimed.id);
    if (import.meta.env.DEV) {
      console.info('[data:chat] acknowledged', {
        mutationId: claimed.mutationId,
        messageId: row?.id,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent =
      /\b(400|401|403|404|409|422)\b/.test(message) ||
      /Muted|blocked|Not a member/i.test(message);
    claimed.attempts += 1;
    claimed.lastError = message;
    if (permanent || claimed.attempts >= 12) {
      claimed.state = 'failed';
      if (data.chatId) {
        db.markMessageDeliveryStatus(data.chatId, claimed.mutationId, 'failed');
      }
    } else {
      claimed.state = 'pending';
      claimed.nextAttemptAt = Date.now() + computeOutboxBackoffMs(claimed.attempts);
    }
    await updateOutboxItem(claimed);
    if (import.meta.env.DEV) {
      console.warn('[data:chat] send failed', {
        mutationId: claimed.mutationId,
        message,
      });
    }
  }
}

export async function processChatOutbox(userId: string): Promise<void> {
  if (processing || !isNetworkOnline()) return;
  processing = true;
  try {
    const due = await listDueOutboxItems(userId);
    for (const item of due) {
      await processOneChatItem(userId, item.id);
    }
  } finally {
    processing = false;
  }
}

export function initChatOutboxNetworkResume(userId: string): void {
  resumeUserId = userId;
  if (networkHookInstalled) return;
  networkHookInstalled = true;
  subscribeNetworkStatus((status) => {
    if (status === 'online' && resumeUserId) {
      void processChatOutbox(resumeUserId);
    }
  });
}
