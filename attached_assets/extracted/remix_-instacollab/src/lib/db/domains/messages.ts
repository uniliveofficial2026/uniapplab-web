import type {
  ChatMessage,
  ChatWallpaperItem,
  MessageReplyRef,
  MessagesByChatStore,
} from '../../dbTypes';
import { safeUserId } from '../../safe';
import type { ChatPresenceStore, ChatTimestampStore } from '../../../types';
import type { MessagesLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithMessages<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, MessagesLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get messages(): MessagesByChatStore {
      return this.load<MessagesByChatStore>('messages', {}) || {};
    }

    get chatPresence(): ChatPresenceStore {
      return this.load<ChatPresenceStore>('chat_presence', {}) || {};
    }

    get chatReadState(): ChatTimestampStore {
      return this.load<ChatTimestampStore>('chat_read_state', {}) || {};
    }

    get chatPeerReadState(): ChatTimestampStore {
      return this.load<ChatTimestampStore>('chat_peer_read_state', {}) || {};
    }

    getUserPresence(userId: string) {
      if (!userId) {
        return {
          online: false,
          typing: false,
          lastSeenAt: 0,
          lastActiveAt: 0,
          activeChatId: null,
        };
      }
      const presence = this.chatPresence;
      const entry = presence[userId];
      const activeChatId =
        typeof entry?.activeChatId === 'string' && entry.activeChatId.length > 0
          ? entry.activeChatId
          : null;
      return {
        online: !!entry?.online,
        typing: !!entry?.typing,
        lastSeenAt: typeof entry?.lastSeenAt === 'number' ? entry.lastSeenAt : 0,
        lastActiveAt: typeof entry?.lastActiveAt === 'number' ? entry.lastActiveAt : 0,
        activeChatId,
      };
    }

    setUserPresence(userId: string, patch: {
      online?: boolean;
      typing?: boolean;
      lastSeenAt?: number;
      lastActiveAt?: number;
      activeChatId?: string | null;
    }) {
      if (!userId) return;
      const presence = this.chatPresence;
      const current = this.asLocalDB().getUserPresence(userId);
      this.save('chat_presence', {
        ...presence,
        [userId]: {
          ...current,
          ...(patch || {}),
        },
      });
    }

    setChatPresenceMap(nextPresence: ChatPresenceStore) {
      if (!nextPresence || typeof nextPresence !== 'object') return;
      this.save('chat_presence', nextPresence);
    }

    setUserTyping(userId: string, typing: boolean) {
      if (!userId) return;
      this.asLocalDB().setUserPresence(userId, { typing: !!typing });
    }

    setUserOnline(userId: string, online: boolean, at = Date.now()) {
      if (!userId) return;
      if (online) {
        this.asLocalDB().setUserPresence(userId, {
          online: true,
          lastActiveAt: at,
        });
        return;
      }
      this.asLocalDB().setUserPresence(userId, {
        online: false,
        lastSeenAt: at,
      });
    }

    touchUserActive(userId: string, at = Date.now()) {

      if (!userId) return;
      this.asLocalDB().setUserPresence(userId, {
        online: true,
        lastActiveAt: at,
      });
    }

    getChatReadAt(chatId: string) {
      if (!chatId) return 0;
      const readState = this.asLocalDB().chatReadState;
      const value = readState[chatId];
      return typeof value === 'number' ? value : 0;
    }

    setChatReadAt(chatId: string, timestamp: number, options?: { allowDecrease?: boolean }) {
      if (!chatId) return;
      const readState = this.asLocalDB().chatReadState;
      const previous = typeof readState[chatId] === 'number' ? readState[chatId] : 0;
      const nextValue = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : previous;
      if (!options?.allowDecrease && nextValue <= previous) return;
      if (options?.allowDecrease && nextValue === previous) return;
      this.save('chat_read_state', {
        ...readState,
        [chatId]: Math.max(0, nextValue),
      });
    }

    getChatPeerReadAt(chatId: string) {
      if (!chatId) return 0;
      const peerReadState = this.asLocalDB().chatPeerReadState;
      const value = peerReadState[chatId];
      return typeof value === 'number' ? value : 0;
    }

    setChatPeerReadAt(chatId: string, timestamp: number) {
      if (!chatId) return;
      const peerReadState = this.asLocalDB().chatPeerReadState;
      const previous = typeof peerReadState[chatId] === 'number' ? peerReadState[chatId] : 0;
      const nextValue = typeof timestamp === 'number' ? timestamp : previous;
      if (nextValue <= previous) return;
      this.save('chat_peer_read_state', {
        ...peerReadState,
        [chatId]: nextValue,
      });
    }

    get chatWallpapers(): Record<string, { selectedId?: string; customWallpapers?: unknown[] }> {
      return this.load('chat_wallpapers', {}) || {};
    }

    getChatWallpaper(chatId: string) {
      if (!chatId) {
        return { selectedId: 'default', customWallpapers: [] as ChatWallpaperItem[] };
      }
      const all = this.chatWallpapers;
      const entry = all[chatId];
      if (!entry || typeof entry !== 'object') {
        return { selectedId: 'default', customWallpapers: [] as ChatWallpaperItem[] };
      }
      return {
        selectedId: typeof entry.selectedId === 'string' && entry.selectedId.length > 0 ? entry.selectedId : 'default',
        customWallpapers: Array.isArray(entry.customWallpapers) ? entry.customWallpapers : [],
      };
    }

    setChatWallpaper(chatId: string, payload: { selectedId: string; customWallpapers: ChatWallpaperItem[] }) {
      if (!chatId) return;
      const all = this.chatWallpapers;
      this.save('chat_wallpapers', {
        ...all,
        [chatId]: {
          selectedId: typeof payload?.selectedId === 'string' && payload.selectedId.length > 0 ? payload.selectedId : 'default',
          customWallpapers: Array.isArray(payload?.customWallpapers) ? payload.customWallpapers.slice(0, 24) : [],
        },
      });
    }

    addMessage(chatId: string, message: ChatMessage) {
      const msgs = this.asLocalDB().messages;
      const existing = msgs[chatId] || [];
      const nextMessage = this.ensureMessageId(message, chatId);
      this.asLocalDB().setUnreadMessagesCount(this.asLocalDB().unreadMessagesCount + 1);
      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList([...existing, nextMessage], 'messages'),
      });
      const meId = this.asLocalDB().currentUserId;
      const recipientId = safeUserId(chatId);
      if (nextMessage?.isAuthor && recipientId && meId && recipientId !== meId) {
        const mediaList = Array.isArray(nextMessage.media) ? nextMessage.media : [];
        const fileAttachment = mediaList.find(
          (item) =>
            item &&
            typeof item === 'object' &&
            (item as { isFile?: boolean }).isFile === true
        ) as { name?: string } | undefined;
        const loc = nextMessage.location;
        const hasLocation =
          loc &&
          typeof loc === 'object' &&
          !Array.isArray(loc) &&
          Number.isFinite(Number((loc as { latitude?: unknown }).latitude)) &&
          Number.isFinite(Number((loc as { longitude?: unknown }).longitude));
        const locationLabel =
          hasLocation && typeof (loc as { label?: unknown }).label === 'string'
            ? String((loc as { label: string }).label).trim()
            : '';
        const preview = String(nextMessage.text ?? '').trim().slice(0, 120);
        const fileName =
          typeof fileAttachment?.name === 'string' ? fileAttachment.name.trim() : '';
        this.asLocalDB().pushNotificationForUser(recipientId, {
          type: 'message',
          actorUserId: meId,
          text:
            preview ||
            (hasLocation
              ? locationLabel
                ? `Shared location: ${locationLabel}`
                : 'Shared a location'
              : fileName
                ? `Sent you ${fileName}`
                : 'Sent you a message'),
          link: `chat:${recipientId}`,
          targetTab: 'messages',
        });
      }
    }

    toggleMessageReaction(chatId: string, messageIndex: number, emoji: string) {
      if (!chatId || !emoji) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      if (messageIndex < 0 || messageIndex >= existing.length) return;

      const message = existing[messageIndex];
      if (!message || typeof message !== 'object') return;

      const currentReaction =
        message.reactionState && typeof message.reactionState === 'object'
          ? message.reactionState
          : { selected: null as string | null, counts: {} as Record<string, number> };

      const counts: Record<string, number> = { ...(currentReaction.counts ?? {}) };
      let selected: string | null =
        typeof currentReaction.selected === 'string' ? currentReaction.selected : null;

      if (selected === emoji) {
        counts[emoji] = Math.max(0, (counts[emoji] || 0) - 1);
        if (counts[emoji] === 0) delete counts[emoji];
        selected = null;
      } else {
        if (selected) {
          counts[selected] = Math.max(0, (counts[selected] || 0) - 1);
          if (counts[selected] === 0) delete counts[selected];
        }
        counts[emoji] = (counts[emoji] || 0) + 1;
        selected = emoji;
      }

      existing[messageIndex] = {
        ...message,
        reactionState: {
          selected,
          counts,
        },
      };

      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList(existing, 'messages'),
      });

      const meId = this.asLocalDB().currentUserId;
      const recipientId = safeUserId(chatId);
      const addedReaction = selected === emoji;
      if (
        addedReaction &&
        recipientId &&
        meId &&
        recipientId !== meId &&
        !message?.isAuthor
      ) {
        this.asLocalDB().pushNotificationForUser(recipientId, {
          type: 'activity',
          actorUserId: meId,
          title: 'Message reaction',
          text: `reacted ${emoji} to your message`,
          link: `chat:${recipientId}`,
          targetTab: 'messages',
        });
      }
    }

    updateMessage(chatId: string, messageIndex: number, updater: (message: ChatMessage) => ChatMessage) {
      if (!chatId || typeof updater !== 'function') return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      if (messageIndex < 0 || messageIndex >= existing.length) return;
      const current = existing[messageIndex];
      existing[messageIndex] = updater(current);
      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList(existing, 'messages'),
      });
    }

    deleteMessage(chatId: string, messageIndex: number) {
      if (!chatId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      if (messageIndex < 0 || messageIndex >= existing.length) return;
      existing.splice(messageIndex, 1);

      const normalized = existing.map((message: ChatMessage) => {
        if (!message || typeof message !== 'object' || !message.replyTo || typeof message.replyTo !== 'object') {
          if (!message || typeof message !== 'object' || !Array.isArray(message.replyToMany)) {
            return message;
          }
          const nextReplyToMany = message.replyToMany
            .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
            .map((reply: MessageReplyRef) => ({
              ...reply,
              index: reply.index > messageIndex ? reply.index - 1 : reply.index,
            }));
          return {
            ...message,
            replyToMany: nextReplyToMany,
          };
        }

        const replyIndex = typeof message.replyTo.index === 'number' ? message.replyTo.index : null;
        if (replyIndex === null) {
          if (!Array.isArray(message.replyToMany)) return message;
          const nextReplyToMany = message.replyToMany
            .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
            .map((reply: MessageReplyRef) => ({
              ...reply,
              index: reply.index > messageIndex ? reply.index - 1 : reply.index,
            }));
          return {
            ...message,
            replyToMany: nextReplyToMany,
          };
        }

        if (replyIndex === messageIndex) {
          const { replyTo: _replyTo, ...rest } = message;
          return Array.isArray(message.replyToMany)
            ? {
                ...rest,
                replyToMany: message.replyToMany
                  .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
                  .map((reply: MessageReplyRef) => ({
                    ...reply,
                    index: reply.index > messageIndex ? reply.index - 1 : reply.index,
                  })),
              }
            : rest;
        }

        if (replyIndex > messageIndex) {
          const withReplyTo = {
            ...message,
            replyTo: {
              ...message.replyTo,
              index: replyIndex - 1,
            },
          };
          if (!Array.isArray(message.replyToMany)) return withReplyTo;
          return {
            ...withReplyTo,
            replyToMany: message.replyToMany
              .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
              .map((reply: MessageReplyRef) => ({
                ...reply,
                index: reply.index > messageIndex ? reply.index - 1 : reply.index,
              })),
          };
        }

        if (!Array.isArray(message.replyToMany)) return message;
        return {
          ...message,
          replyToMany: message.replyToMany
            .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
            .map((reply: MessageReplyRef) => ({
              ...reply,
              index: reply.index > messageIndex ? reply.index - 1 : reply.index,
            })),
        };
      });

      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList(normalized, 'messages'),
      });
    }

    /** Restore DM threads after cloud first-session wipe or empty IDB `messages: {}`. */
    ensureDemoMessagesIfEmpty() {
      const msgs = this.asLocalDB().messages;
      const hasThreads = Object.values(msgs).some(
        (thread) => Array.isArray(thread) && thread.length > 0
      );
      if (hasThreads) return;

      const meId = this.asLocalDB().currentUserId || 'u1';
      const now = Date.now();
      const mk = (
        peerId: string,
        text: string,
        agoMs: number,
        isAuthor: boolean
      ): ChatMessage => ({
        id: `demo_${peerId}_${agoMs}`,
        text,
        from: isAuthor ? meId : peerId,
        timestamp: now - agoMs,
        isAuthor,
      });

      const seeded: MessagesByChatStore = {
        u2: [
          mk('u2', 'Hey! Loved your latest mountain shot.', 2 * 3600_000, false),
          mk('u2', 'Thanks — editing the grade now.', 90 * 60_000, true),
        ],
        u3: [mk('u3', 'Collab reel this week?', 5 * 3600_000, false)],
        u4: [mk('u4', 'Shared a post with you', 20 * 60_000, false)],
      };
      this.save('messages', seeded);
      this.asLocalDB().setUnreadMessagesCount(Object.keys(seeded).length);
    }
  } as unknown as MixinCtor<T, MessagesLayer>;
}
