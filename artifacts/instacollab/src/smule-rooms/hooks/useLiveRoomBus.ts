import { useCallback, useEffect, useRef, useState } from 'react';
import {
  publishLiveRoomEvent,
  subscribeLiveRoomEvents,
  type LiveRoomEnvelope,
} from '../../lib/livekit/liveRoomBus';
import {
  fetchRecentPartyRoomSyncEvents,
  persistAndBroadcastLiveRoomEvent,
  subscribePartyRoomSyncEvents,
} from '../../lib/party/partyRoomsCloud';
import type {
  CommercePayload,
  GamePayload,
  GiftPlayPayload,
  PKPayload,
} from '../utils/liveRoomTypes';
import type { SeatsSyncPayload } from '../../lib/party/partySeatCloudSync';
import { parseSeatsSyncPayload } from '../../lib/party/partySeatCloudSync';

type UseLiveRoomBusOptions = {
  roomId: string;
  userId: string;
  userName: string;
  enabled?: boolean;
};

export function useLiveRoomBus({
  roomId,
  userId,
  userName,
  enabled = true,
}: UseLiveRoomBusOptions) {
  const seenIdsRef = useRef(new Set<string>());
  const [lastGiftPlay, setLastGiftPlay] = useState<GiftPlayPayload | null>(null);
  const [lastPk, setLastPk] = useState<PKPayload | null>(null);
  const [lastCommerce, setLastCommerce] = useState<CommercePayload | null>(null);
  const [lastGame, setLastGame] = useState<GamePayload | null>(null);
  const [lastSeats, setLastSeats] = useState<SeatsSyncPayload | null>(null);

  const handleEnvelope = useCallback((event: LiveRoomEnvelope) => {
    if (!event.id || seenIdsRef.current.has(event.id)) return;
    seenIdsRef.current.add(event.id);
    if (seenIdsRef.current.size > 500) {
      const keep = Array.from(seenIdsRef.current).slice(-250);
      seenIdsRef.current = new Set(keep);
    }

    switch (event.type) {
      case 'gift_play':
        setLastGiftPlay(event.payload as GiftPlayPayload);
        break;
      case 'pk':
        setLastPk(event.payload as PKPayload);
        break;
      case 'commerce':
        setLastCommerce(event.payload as CommercePayload);
        break;
      case 'game':
        setLastGame(event.payload as GamePayload);
        break;
      case 'seats': {
        const parsed = parseSeatsSyncPayload(event.payload);
        if (parsed) setLastSeats(parsed);
        break;
      }
      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !roomId) return undefined;

    const unsubBus = subscribeLiveRoomEvents(roomId, handleEnvelope);
    const unsubCloud = subscribePartyRoomSyncEvents(roomId, handleEnvelope, userId);

    void fetchRecentPartyRoomSyncEvents(roomId, 40, userId).then((events) => {
      for (const event of events) handleEnvelope(event);
    });

    return () => {
      unsubBus();
      unsubCloud();
    };
  }, [enabled, roomId, userId, handleEnvelope]);

  const emit = useCallback(
    async (
      type: LiveRoomEnvelope['type'],
      payload: Record<string, unknown>,
    ): Promise<LiveRoomEnvelope | null> => {
      if (!roomId || !userId) return null;
      return persistAndBroadcastLiveRoomEvent(
        roomId,
        {
          senderId: userId,
          senderName: userName,
          type,
          payload,
        },
        (envelope) =>
          publishLiveRoomEvent(roomId, {
            ...envelope,
            payload: envelope.payload,
          }),
      );
    },
    [roomId, userId, userName],
  );

  const emitGiftPlay = useCallback(
    (payload: GiftPlayPayload) => emit('gift_play', payload as unknown as Record<string, unknown>),
    [emit],
  );

  const emitPk = useCallback(
    (payload: PKPayload) => emit('pk', payload as unknown as Record<string, unknown>),
    [emit],
  );

  const emitCommerce = useCallback(
    (payload: CommercePayload) => emit('commerce', payload as unknown as Record<string, unknown>),
    [emit],
  );

  const emitGame = useCallback(
    (payload: GamePayload) => emit('game', payload as unknown as Record<string, unknown>),
    [emit],
  );

  const emitSeats = useCallback(
    (payload: SeatsSyncPayload) => emit('seats', payload as unknown as Record<string, unknown>),
    [emit],
  );

  return {
    lastGiftPlay,
    lastPk,
    lastCommerce,
    lastGame,
    lastSeats,
    emitGiftPlay,
    emitPk,
    emitCommerce,
    emitGame,
    emitSeats,
  };
}
