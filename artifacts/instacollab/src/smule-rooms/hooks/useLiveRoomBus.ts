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
  const [lastPkId, setLastPkId] = useState<string | null>(null);
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
        setLastPkId(event.id);
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
      const envelope = await persistAndBroadcastLiveRoomEvent(
        roomId,
        {
          senderId: userId,
          senderName: userName,
          type,
          payload,
        },
        (partial) =>
          publishLiveRoomEvent(roomId, {
            ...partial,
            payload: partial.payload,
          }),
      );
      // Local publish already dispatched; keep id marked so cloud/LiveKit echoes are ignored.
      // If publish was skipped (no LiveKit room yet), apply once here so the sender still updates.
      if (envelope?.id && !seenIdsRef.current.has(envelope.id)) {
        handleEnvelope(envelope);
      } else if (envelope?.id) {
        seenIdsRef.current.add(envelope.id);
      }
      return envelope;
    },
    [roomId, userId, userName, handleEnvelope],
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
    lastPkId,
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
