import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveSupabaseSessionUserId } from '../../lib/auth/resolveSupabaseSessionUserId';
import {
  fetchPartyRoomMessages,
  insertPartyRoomMessage,
  isPartyRoomChatCloudAvailable,
  subscribePartyRoomMessages,
  unsubscribePartyRoomChannel,
  type PartyRoomLiveChatMessage,
} from '../../lib/supabase/partyRoomChat';

const MAX_MESSAGES = 50;

type UsePartyRoomChatOptions = {
  roomId: string;
  enabled: boolean;
  senderId: string;
  senderName: string;
};

function messageKey(message: PartyRoomLiveChatMessage): string {
  return String(message.id);
}

function isLocalOnlyMessage(message: PartyRoomLiveChatMessage): boolean {
  return Boolean(message.isAnnouncementWelcome);
}

export function usePartyRoomChat({
  roomId,
  enabled,
  senderId,
  senderName,
}: UsePartyRoomChatOptions) {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const cloudAvailable = isPartyRoomChatCloudAvailable();
  const cloudActive = enabled && cloudAvailable && Boolean(authUserId);
  const [messages, setMessages] = useState<PartyRoomLiveChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof subscribePartyRoomMessages>>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !cloudAvailable) {
      setAuthUserId(null);
      return undefined;
    }

    let cancelled = false;
    void resolveSupabaseSessionUserId(senderId, { attemptMigrate: true }).then((id) => {
      if (!cancelled) setAuthUserId(id);
    });

    return () => {
      cancelled = true;
    };
  }, [cloudAvailable, enabled, senderId]);

  const remember = useCallback((message: PartyRoomLiveChatMessage) => {
    seenIdsRef.current.add(messageKey(message));
  }, []);

  const mergeMessage = useCallback((message: PartyRoomLiveChatMessage) => {
    const key = messageKey(message);
    if (seenIdsRef.current.has(key)) return;
    remember(message);
    setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
  }, [remember]);

  useEffect(() => {
    seenIdsRef.current = new Set();
    setMessages([]);
    if (!enabled) return undefined;

    if (!cloudActive || !authUserId) return undefined;

    let cancelled = false;

    void fetchPartyRoomMessages(roomId, MAX_MESSAGES)
      .then((rows) => {
        if (cancelled) return;
        const next: PartyRoomLiveChatMessage[] = [];
        for (const row of rows) {
          const key = messageKey(row);
          if (seenIdsRef.current.has(key)) continue;
          seenIdsRef.current.add(key);
          next.push(row);
        }
        setMessages(next.slice(-MAX_MESSAGES));
      })
      .catch((err) => {
        console.warn('[party-room-chat] history load failed:', err);
      });

    channelRef.current = subscribePartyRoomMessages(roomId, (incoming) => {
      if (incoming.userId === authUserId) return;
      mergeMessage(incoming);
    });

    return () => {
      cancelled = true;
      unsubscribePartyRoomChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [authUserId, cloudActive, enabled, mergeMessage, roomId]);

  const appendMessage = useCallback(
    (message: PartyRoomLiveChatMessage) => {
      const withId: PartyRoomLiveChatMessage = {
        ...message,
        id: message.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: authUserId ?? message.userId ?? senderId,
      };
      mergeMessage(withId);

      if (!cloudActive || !authUserId || isLocalOnlyMessage(withId)) return;

      void insertPartyRoomMessage(roomId, authUserId, senderName, withId)
        .then((row) => {
          if (!row) return;
          const cloudId = row.id;
          setMessages((prev) =>
            prev.map((entry) =>
              messageKey(entry) === messageKey(withId) ? { ...entry, id: cloudId } : entry,
            ),
          );
          seenIdsRef.current.delete(messageKey(withId));
          seenIdsRef.current.add(cloudId);
        })
        .catch((err) => {
          console.warn('[party-room-chat] send failed:', err);
        });
    },
    [authUserId, cloudActive, mergeMessage, roomId, senderId, senderName],
  );

  const sendTextMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      appendMessage({
        id: `local_${Date.now()}`,
        user: senderName,
        userId: authUserId ?? senderId,
        text: trimmed,
        isBurmese: false,
      });
    },
    [appendMessage, authUserId, senderId, senderName],
  );

  return {
    messages,
    appendMessage,
    sendTextMessage,
    cloudActive,
  };
}
