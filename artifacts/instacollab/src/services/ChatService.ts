import type { User } from '../types';
import {
  createChatThread,
  fetchChatThreadMessages,
  fetchChatThreads,
} from '../lib/platformApi';
import { retryCloudMessageSend, startCloudChatRealtime } from '../lib/chat/cloudChatSync';
import {
  initChatOutboxNetworkResume,
  processChatOutbox,
} from '../lib/outbox/chatOutboxProcessor';
import type { ChatMessage } from '../lib/dbTypes';
import { db } from '../lib/db/localDb';
import type { ServiceResult } from '../types/platform';

export interface ChatService {
  loadThreads(): Promise<ServiceResult<{ threads: unknown[] }>>;
  loadMessages(threadId: string, cursor?: { before?: string; limit?: number }): Promise<ServiceResult<{ messages: unknown[] }>>;
  createThread(memberIds: string[]): Promise<ServiceResult<{ id: string }>>;
  sendMessage(chatId: string, message: ChatMessage): void;
  retrySend(chatId: string, message: ChatMessage): void;
  markRead(chatId: string): void;
  startRealtime(userId: string): void;
  flushOutbox(userId: string): Promise<void>;
}

class ChatServiceImpl implements ChatService {
  async loadThreads(): Promise<ServiceResult<{ threads: unknown[] }>> {
    try {
      const data = await fetchChatThreads();
      return { ok: true, data: { threads: data.threads ?? [] } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async loadMessages(
    threadId: string,
    cursor?: { before?: string; limit?: number },
  ): Promise<ServiceResult<{ messages: unknown[] }>> {
    try {
      const data = await fetchChatThreadMessages(threadId, cursor);
      return { ok: true, data: { messages: data.messages ?? [] } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async createThread(memberIds: string[]): Promise<ServiceResult<{ id: string }>> {
    try {
      const thread = await createChatThread(memberIds);
      return { ok: true, data: thread };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  sendMessage(chatId: string, message: ChatMessage): void {
    // LocalDB is the single optimistic send entrypoint and owns exactly one
    // cloud/outbox enqueue. Services must not enqueue a second copy.
    db.addMessage(chatId, message);
  }

  retrySend(chatId: string, message: ChatMessage): void {
    retryCloudMessageSend(chatId, message);
  }

  markRead(chatId: string): void {
    const thread = db.messages[chatId];
    const latest = Array.isArray(thread) && thread.length > 0 ? thread[thread.length - 1] : null;
    const ts =
      latest && typeof latest.timestamp === 'number'
        ? latest.timestamp
        : latest && typeof latest.timestamp === 'string'
          ? Date.parse(latest.timestamp)
          : Date.now();
    db.setChatReadAt(chatId, ts);
  }

  startRealtime(userId: string): void {
    initChatOutboxNetworkResume(userId);
    void startCloudChatRealtime(userId);
    void processChatOutbox(userId);
  }

  async flushOutbox(userId: string): Promise<void> {
    await processChatOutbox(userId);
  }
}

export const chatService: ChatService = new ChatServiceImpl();

export type { User };
