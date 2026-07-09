import type {
  ChatMessage,
  ChatWallpaperItem,
  MessageReplyRef,
  MessagesByChatStore,
} from '../../dbTypes';
import { safeUserId } from '../../safe';
import {
  ensureCloudThreadForGroup,
  syncCloudGroupMembers,
  queueCloudMessageDelete,
  queueCloudMessageReaction,
  queueCloudMessageSend,
  queueCloudMessageUpdate,
  queueCloudReadReceipt,
} from '../../chat/cloudChatSync';
import { isChatCloudAvailable } from '../../chat/chatCloud';
import type { ChatGroup, ChatPresenceStore, ChatTimestampStore } from '../../../types';
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

    get chatGroups(): ChatGroup[] {
      const raw = this.load<ChatGroup[]>('chat_groups', []);
      return Array.isArray(raw) ? raw : [];
    }

    getChatGroup(groupId: string): ChatGroup | null {
      const id = String(groupId || '').trim();
      if (!id) return null;
      return this.chatGroups.find((g) => g.id === id) ?? null;
    }

    saveChatGroups(groups: ChatGroup[]) {
      this.save('chat_groups', Array.isArray(groups) ? groups : []);
    }

    upsertChatGroup(group: ChatGroup) {
      if (!group?.id) return;
      const list = this.chatGroups.filter((g) => g.id !== group.id);
      this.saveChatGroups([group, ...list]);
      void ensureCloudThreadForGroup(group).then(() => syncCloudGroupMembers(group));
    }

    mergeInboundChatGroup(group: ChatGroup) {
      if (!group?.id) return;
      const existing = this.getChatGroup(group.id);
      if (existing) {
        this.saveChatGroups(
          this.chatGroups.map((g) =>
            g.id === group.id
              ? {
                  ...existing,
                  ...group,
                  memberIds: [...new Set([...(group.memberIds || []), ...(existing.memberIds || [])])],
                }
              : g,
          ),
        );
        return;
      }
      this.saveChatGroups([group, ...this.chatGroups]);
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
    }, options?: { ephemeral?: boolean }) {
      if (!userId) return;
      const presence = this.chatPresence;
      const current = this.asLocalDB().getUserPresence(userId);
      const nextEntry = {
        ...current,
        ...(patch || {}),
      };
      const nextPresence = {
        ...presence,
        [userId]: nextEntry,
      };
      if (JSON.stringify(presence[userId]) === JSON.stringify(nextEntry)) return;
      const ephemeral =
        options?.ephemeral ||
        (Object.keys(patch || {}).length === 1 && patch.typing !== undefined);
      if (ephemeral) {
        this.saveEphemeral('chat_presence', nextPresence);
        return;
      }
      this.save('chat_presence', nextPresence);
    }

    setChatPresenceMap(nextPresence: ChatPresenceStore, options?: { ephemeral?: boolean }) {
      if (!nextPresence || typeof nextPresence !== 'object') return;
      const current = this.chatPresence;
      if (JSON.stringify(current) === JSON.stringify(nextPresence)) return;
      if (options?.ephemeral) {
        this.saveEphemeral('chat_presence', nextPresence);
        return;
      }
      this.save('chat_presence', nextPresence);
    }

    setUserTyping(userId: string, typing: boolean) {
      if (!userId) return;
      this.asLocalDB().setUserPresence(userId, { typing: !!typing }, { ephemeral: true });
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
      }, { ephemeral: true });
    }

    getChatReadAt(chatId: string) {
      if (!chatId) return 0;
      const readState = this.asLocalDB().chatReadState;
      const value = readState[chatId];
      return typeof value === 'number' ? value : 0;
    }

    setChatReadAt(
      chatId: string,
      timestamp: number,
      options?: { allowDecrease?: boolean; skipCloud?: boolean },
    ) {
      if (!chatId) return;
      const readState = this.asLocalDB().chatReadState;
      const previous = typeof readState[chatId] === 'number' ? readState[chatId] : 0;
      const nextValue = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : previous;
      if (!options?.allowDecrease && nextValue <= previous) return;
      if (options?.allowDecrease && nextValue === previous) return;
      this.saveEphemeral('chat_read_state', {
        ...readState,
        [chatId]: Math.max(0, nextValue),
      });
      if (!options?.skipCloud) {
        queueMicrotask(() => {
          queueCloudReadReceipt(chatId, Math.max(0, nextValue));
        });
      }
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
      this.saveEphemeral('chat_peer_read_state', {
        ...peerReadState,
        [chatId]: nextValue,
      });
      window.dispatchEvent(new CustomEvent('chat-read-state-updated', { detail: { chatId, peerReadAt: nextValue } }));
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

    mergeInboundMessage(
      chatId: string,
      message: ChatMessage,
      options?: { bumpUnread?: boolean },
    ) {
      if (!chatId || !message) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      const nextMessage = this.ensureMessageId(message, chatId);
      const idx = existing.findIndex(
        (m) =>
          (m.id && nextMessage.id && m.id === nextMessage.id) ||
          (m.cloudId && nextMessage.cloudId && m.cloudId === nextMessage.cloudId),
      );
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...nextMessage };
        this.save('messages', {
          ...msgs,
          [chatId]: this.cappedList(existing, 'messages'),
        });
        return;
      }
      if (options?.bumpUnread !== false && !nextMessage.isAuthor) {
        this.asLocalDB().setUnreadMessagesCount(this.asLocalDB().unreadMessagesCount + 1);
      }
      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList([...existing, nextMessage], 'messages'),
      });
      if (!nextMessage.isAuthor && !nextMessage.isCallEvent) {
        queueMicrotask(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('chat-inbound-message', {
                detail: { chatId, message: nextMessage },
              }),
            );
          }
        });
      }
    }

    attachCloudMessageId(chatId: string, localId: string, cloudId: string) {
      if (!chatId || !localId || !cloudId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      let changed = false;
      const next = existing.map((m) => {
        if (m.id !== localId && m.cloudId !== cloudId) return m;
        changed = true;
        return { ...m, id: m.id || localId, cloudId, deliveryStatus: 'sent' as const };
      });
      if (!changed) return;
      this.save('messages', { ...msgs, [chatId]: next });
    }

    markMessageDeliveryStatus(
      chatId: string,
      localId: string,
      status: 'sending' | 'sent' | 'failed',
    ) {
      if (!chatId || !localId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      let changed = false;
      const next = existing.map((m) => {
        if (m.id !== localId) return m;
        changed = true;
        return { ...m, deliveryStatus: status };
      });
      if (!changed) return;
      this.save('messages', { ...msgs, [chatId]: next });
    }

    patchMessageMedia(chatId: string, localId: string, media: unknown[]) {
      if (!chatId || !localId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      let changed = false;
      const next = existing.map((m) => {
        if (m.id !== localId) return m;
        changed = true;
        return { ...m, media };
      });
      if (!changed) return;
      this.save('messages', { ...msgs, [chatId]: next });
    }

    markCloudMessageDeleted(chatId: string, cloudId: string) {
      if (!chatId || !cloudId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      const next = existing.map((m) =>
        m.cloudId === cloudId || m.id === cloudId
          ? {
              ...m,
              text: 'Message deleted',
              media: undefined,
              location: undefined,
              deleted: true,
              isDeleted: true,
            }
          : m,
      );
      this.save('messages', { ...msgs, [chatId]: next });
    }

    hideMessageForMe(chatId: string, messageIndex: number) {
      if (!chatId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      if (messageIndex < 0 || messageIndex >= existing.length) return;
      existing[messageIndex] = { ...existing[messageIndex], hiddenForMe: true };
      this.save('messages', { ...msgs, [chatId]: existing });
      queueMicrotask(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chat-inbox-activity', { detail: { chatId } }));
        }
      });
    }

    deleteMessageForEveryone(chatId: string, messageIndex: number) {
      if (!chatId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      if (messageIndex < 0 || messageIndex >= existing.length) return;
      const target = existing[messageIndex];
      if (!target?.isAuthor) return;
      const next = existing.map((m, idx) =>
        idx === messageIndex
          ? {
              ...m,
              text: 'Message deleted',
              media: undefined,
              location: undefined,
              deleted: true,
              isDeleted: true,
            }
          : m,
      );
      this.save('messages', { ...msgs, [chatId]: next });
      queueMicrotask(() => {
        queueCloudMessageDelete(chatId, {
          ...target,
          deleted: true,
          isDeleted: true,
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chat-inbox-activity', { detail: { chatId } }));
        }
      });
    }

    applyInboundMessageReaction(
      chatId: string,
      localOrCloudId: string,
      state: { counts: Record<string, number>; selected: string | null },
    ) {
      if (!chatId || !localOrCloudId) return;
      const msgs = this.asLocalDB().messages;
      const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
      const next = existing.map((m) =>
        m.id === localOrCloudId || m.cloudId === localOrCloudId
          ? { ...m, reactionState: { selected: state.selected, counts: state.counts } }
          : m,
      );
      this.save('messages', { ...msgs, [chatId]: next });
    }

    addMessage(chatId: string, message: ChatMessage) {
      const msgs = this.asLocalDB().messages;
      const existing = msgs[chatId] || [];
      const nextMessage = this.ensureMessageId(message, chatId);
      const cloudChatEnabled = isChatCloudAvailable();
      const withDelivery =
        nextMessage.isAuthor && cloudChatEnabled
          ? { ...nextMessage, deliveryStatus: 'sending' as const }
          : nextMessage;
      if (!withDelivery.isAuthor) {
        this.asLocalDB().setUnreadMessagesCount(this.asLocalDB().unreadMessagesCount + 1);
      }
      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList([...existing, withDelivery], 'messages'),
      });
      if (typeof window !== 'undefined') {
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent('chat-inbox-activity', { detail: { chatId } }));
        });
      }
      queueMicrotask(() => {
        queueCloudMessageSend(chatId, {
          ...withDelivery,
          from: withDelivery.from || this.asLocalDB().currentUserId || undefined,
        });
      });
      const meId = this.asLocalDB().currentUserId;
      if (!withDelivery?.isAuthor || !meId) return;

      const group = this.getChatGroup(chatId);
      const recipientIds = group
        ? (group.memberIds || []).filter((id) => id && id !== meId)
        : [safeUserId(chatId)].filter((id): id is string => !!id && id !== meId);

      const mediaList = Array.isArray(withDelivery.media) ? withDelivery.media : [];
      const fileAttachment = mediaList.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as { isFile?: boolean }).isFile === true,
      ) as { name?: string } | undefined;
      const loc = withDelivery.location;
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
      const preview = String(withDelivery.text ?? '').trim().slice(0, 120);
      const fileName =
        typeof fileAttachment?.name === 'string' ? fileAttachment.name.trim() : '';
      const firstMedia = mediaList[0] as
        | { isAudio?: boolean; isVideo?: boolean }
        | undefined;
      const text = withDelivery.isCallEvent
        ? withDelivery.callKind === 'video'
          ? 'Started a video call'
          : 'Started an audio call'
        : preview ||
          (hasLocation
            ? locationLabel
              ? `Shared location: ${locationLabel}`
              : 'Shared a location'
            : fileName
              ? `Sent you ${fileName}`
              : firstMedia?.isAudio
                ? 'Sent an audio message'
                : firstMedia?.isVideo
                  ? 'Sent a video'
                  : mediaList.length
                    ? 'Sent a photo'
                    : 'Sent you a message');

      queueMicrotask(() => {
        for (const recipientId of recipientIds) {
          this.asLocalDB().pushNotificationForUser(recipientId, {
            type: withDelivery.isCallEvent ? 'activity' : 'message',
            actorUserId: meId,
            text,
            link: `chat:${chatId}`,
            targetTab: 'messages',
          });
        }
      });
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

      const nextMessage = {
        ...message,
        reactionState: {
          selected,
          counts,
        },
      };
      existing[messageIndex] = nextMessage;

      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList(existing, 'messages'),
      });

      queueCloudMessageReaction(chatId, nextMessage, selected);

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
      const next = updater(current);
      existing[messageIndex] = next;
      this.save('messages', {
        ...msgs,
        [chatId]: this.cappedList(existing, 'messages'),
      });
      if (next?.isAuthor) {
        queueMicrotask(() => queueCloudMessageUpdate(chatId, next));
      }
      queueMicrotask(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chat-inbox-activity', { detail: { chatId } }));
        }
      });
    }

    deleteMessage(chatId: string, messageIndex: number) {
      this.hideMessageForMe(chatId, messageIndex);
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
