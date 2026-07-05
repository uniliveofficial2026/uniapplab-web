import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudAuthUserId } from '../../lib/auth/cloudProfile';
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
  const cloudActive =
    enabled && isPartyRoomChatCloudAvailable() && isCloudAuthUserId(senderId);
  const [messages, setMessages] = useState<PartyRoomLiveChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof subscribePartyRoomMessages>>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

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

    if (!cloudActive) return undefined;

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
      if (incoming.userId === senderId) return;
      mergeMessage(incoming);
    });

    return () => {
      cancelled = true;
      unsubscribePartyRoomChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [cloudActive, enabled, mergeMessage, roomId, senderId]);

  const appendMessage = useCallback(
    (message: PartyRoomLiveChatMessage) => {
      const withId: PartyRoomLiveChatMessage = {
        ...message,
        id: message.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
      mergeMessage(withId);

      if (!cloudActive || isLocalOnlyMessage(withId)) return;

      void insertPartyRoomMessage(roomId, senderId, senderName, withId)
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
    [cloudActive, mergeMessage, roomId, senderId, senderName],
  );

  const sendTextMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      appendMessage({
        id: `local_${Date.now()}`,
        user: senderName,
        userId: senderId,
        text: trimmed,
        isBurmese: false,
      });
    },
    [appendMessage, senderId, senderName],
  );

  return {
    messages,
    appendMessage,
    sendTextMessage,
    cloudActive,
  };
}
