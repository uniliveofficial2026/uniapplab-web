import { chatService } from '../../services/ChatService';
import type { ChatMessage } from '../../lib/dbTypes';
import type { ChatInboxViewModel, ChatThreadRowViewModel } from '../../presentation/view-models/types';

export async function loadChatInbox(): Promise<ChatInboxViewModel> {
  const result = await chatService.loadThreads();
  if (!result.ok) {
    return { threads: [], status: 'error', openActionId: 'chat.openThread' };
  }
  const threads: ChatThreadRowViewModel[] = (result.data.threads || []).map((raw) => {
    const t = raw as Record<string, unknown>;
    const id = String(t.id ?? '');
    return {
      threadId: id,
      title: String(t.title ?? t.dm_key ?? id),
      unread: Number(t.unread ?? 0),
      peer: null,
    };
  });
  return {
    threads,
    status: threads.length ? 'ready' : 'empty',
    openActionId: 'chat.openThread',
  };
}

export async function sendChatCommand(chatId: string, clientId: string, body: string, senderId: string): Promise<void> {
  const message: ChatMessage = {
    id: clientId,
    text: body,
    from: senderId,
    timestamp: Date.now(),
    deliveryStatus: 'sending',
    clientId,
  };
  chatService.sendMessage(chatId, message);
}
