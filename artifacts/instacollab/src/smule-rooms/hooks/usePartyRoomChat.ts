import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveCloudAuthUserId } from '../../lib/auth/resolveSupabaseSessionUserId';
import {
  fetchPartyRoomMessages,
  insertPartyRoomMessage,
  isPartyRoomChatCloudAvailable,
  subscribePartyRoomMessages,
  type PartyRoomLiveChatMessage,
} from '../../lib/party/partyRoomsCloud';

const MAX_MESSAGES = 50;

type UsePartyRoomChatOptions = {
  roomId: string;
  enabled: boolean;
  senderId: string;
  senderName: string;
  /** Cross-room PK — merge live chat from this partner room while active. */
  unifiedMirrorRoomId?: string | null;
  unifiedChatActive?: boolean;
};

function messageKey(message: PartyRoomLiveChatMessage): string {
  return String(message.id);
}

function compositeMessageKey(sourceRoomId: string, message: PartyRoomLiveChatMessage): string {
  return `${sourceRoomId}:${messageKey(message)}`;
}

function messageSortKey(message: PartyRoomLiveChatMessage): number {
  if (message.createdAt) {
    const parsed = Date.parse(message.createdAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof message.id === 'number') return message.id;
  const localMatch = /^local_(\d+)/.exec(String(message.id));
  if (localMatch) return Number.parseInt(localMatch[1], 10);
  return 0;
}

function sortAndTrimMessages(messages: PartyRoomLiveChatMessage[]): PartyRoomLiveChatMessage[] {
  return [...messages].sort((a, b) => messageSortKey(a) - messageSortKey(b)).slice(-MAX_MESSAGES);
}

function isLocalOnlyMessage(message: PartyRoomLiveChatMessage): boolean {
  return Boolean(message.isAnnouncementWelcome);
}

export function usePartyRoomChat({
  roomId,
  enabled,
  senderId,
  senderName,
  unifiedMirrorRoomId = null,
  unifiedChatActive = false,
}: UsePartyRoomChatOptions) {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const cloudAvailable = isPartyRoomChatCloudAvailable();
  const cloudActive = enabled && cloudAvailable && Boolean(authUserId);
  const mirrorRoomId = unifiedMirrorRoomId?.trim() || null;
  const unifiedActive = Boolean(
    unifiedChatActive && mirrorRoomId && mirrorRoomId !== roomId,
  );
  const [messages, setMessages] = useState<PartyRoomLiveChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof subscribePartyRoomMessages>>(null);
  const mirrorChannelRef = useRef<ReturnType<typeof subscribePartyRoomMessages>>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !cloudAvailable) {
      setAuthUserId(null);
      return undefined;
    }

    let cancelled = false;
    void resolveCloudAuthUserId(senderId, { attemptMigrate: true }).then((id) => {
      if (!cancelled) setAuthUserId(id);
    });

    return () => {
      cancelled = true;
    };
  }, [cloudAvailable, enabled, senderId]);

  const remember = useCallback((key: string) => {
    seenIdsRef.current.add(key);
  }, []);

  const mergeMessage = useCallback(
    (message: PartyRoomLiveChatMessage, sourceRoomId: string) => {
      const key = compositeMessageKey(sourceRoomId, message);
      if (seenIdsRef.current.has(key)) return;
      remember(key);
      setMessages((prev) => sortAndTrimMessages([...prev, message]));
    },
    [remember],
  );

  useEffect(() => {
    seenIdsRef.current = new Set();
    setMessages([]);
    if (!enabled) return undefined;

    if (!cloudActive || !authUserId) return undefined;

    let cancelled = false;

    const hydrateRows = (rows: PartyRoomLiveChatMessage[], sourceRoomId: string) => {
      const next: PartyRoomLiveChatMessage[] = [];
      for (const row of rows) {
        const key = compositeMessageKey(sourceRoomId, row);
        if (seenIdsRef.current.has(key)) continue;
        seenIdsRef.current.add(key);
        next.push(row);
      }
      return next;
    };

    const loadHistory = unifiedActive && mirrorRoomId
      ? Promise.all([
          fetchPartyRoomMessages(roomId, MAX_MESSAGES, authUserId),
          fetchPartyRoomMessages(mirrorRoomId, MAX_MESSAGES, authUserId),
        ]).then(([localRows, mirrorRows]) => [
          ...hydrateRows(localRows, roomId),
          ...hydrateRows(mirrorRows, mirrorRoomId),
        ])
      : fetchPartyRoomMessages(roomId, MAX_MESSAGES, authUserId).then((rows) =>
          hydrateRows(rows, roomId),
        );

    void loadHistory
      .then((rows) => {
        if (cancelled) return;
        setMessages(sortAndTrimMessages(rows));
      })
      .catch((err) => {
        console.warn('[party-room-chat] history load failed:', err);
      });

    channelRef.current = subscribePartyRoomMessages(
      roomId,
      (incoming) => {
        if (incoming.userId === authUserId) return;
        mergeMessage(incoming, roomId);
      },
      authUserId,
    );

    if (unifiedActive && mirrorRoomId) {
      mirrorChannelRef.current = subscribePartyRoomMessages(
        mirrorRoomId,
        (incoming) => {
          if (incoming.userId === authUserId) return;
          mergeMessage(incoming, mirrorRoomId);
        },
        authUserId,
      );
    } else {
      mirrorChannelRef.current = null;
    }

    return () => {
      cancelled = true;
      channelRef.current?.();
      channelRef.current = null;
      mirrorChannelRef.current?.();
      mirrorChannelRef.current = null;
    };
  }, [
    authUserId,
    cloudActive,
    enabled,
    mergeMessage,
    mirrorRoomId,
    roomId,
    unifiedActive,
  ]);

  const appendMessage = useCallback(
    (message: PartyRoomLiveChatMessage) => {
      const withId: PartyRoomLiveChatMessage = {
        ...message,
        id: message.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: authUserId ?? message.userId ?? senderId,
        createdAt: message.createdAt ?? new Date().toISOString(),
      };
      mergeMessage(withId, roomId);

      if (!cloudActive || !authUserId || isLocalOnlyMessage(withId)) return;

      const persistToRoom = (targetRoomId: string) => {
        void insertPartyRoomMessage(targetRoomId, authUserId, senderName, withId)
          .then((row) => {
            if (targetRoomId !== roomId) return;
            const inserted = row as { id?: string } | null;
            if (!inserted?.id) return;
            const cloudId = inserted.id;
            const localKey = compositeMessageKey(roomId, withId);
            setMessages((prev) =>
              prev.map((entry) =>
                compositeMessageKey(roomId, entry) === localKey
                  ? { ...entry, id: cloudId }
                  : entry,
              ),
            );
            seenIdsRef.current.delete(localKey);
            seenIdsRef.current.add(compositeMessageKey(roomId, { ...withId, id: cloudId }));
          })
          .catch((err) => {
            console.warn('[party-room-chat] send failed:', err);
          });
      };

      persistToRoom(roomId);
      if (unifiedActive && mirrorRoomId) {
        persistToRoom(mirrorRoomId);
      }
    },
    [
      authUserId,
      cloudActive,
      mergeMessage,
      mirrorRoomId,
      roomId,
      senderId,
      senderName,
      unifiedActive,
    ],
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

  const sendStickerMessage = useCallback(
    (payload: {
      stickerId: string;
      assetUrl: string;
      label: string;
      senderId?: string;
      roomId?: string;
    }) => {
      if (!payload.stickerId || !payload.assetUrl) return;
      appendMessage({
        id: `sticker_${Date.now()}`,
        user: senderName,
        userId: payload.senderId || authUserId || senderId,
        text: payload.label,
        isBurmese: false,
        isStickerEvent: true,
        stickerId: payload.stickerId,
        stickerAssetUrl: payload.assetUrl,
        stickerLabel: payload.label,
      });
    },
    [appendMessage, authUserId, senderId, senderName],
  );

  return {
    messages,
    appendMessage,
    sendTextMessage,
    sendStickerMessage,
    cloudActive,
    unifiedChatActive: unifiedActive,
  };
}
