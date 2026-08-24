import { useCallback, useEffect, useRef, useState } from 'react';
import {
  publishLiveRoomEvent,
  subscribeLiveRoomEvents,
  type LiveRoomEnvelope,
} from '../../lib/livekit/liveRoomBus';
import type { LiveLikeBurst } from '../components/LiveLikeFx';
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
import { getThermalPolicy } from '../../lib/performance/thermalGovernor';
import { shouldReplayEvent, REALTIME_REPLAY_BY_TYPE } from '../../lib/rtc/realtimeReplayPolicy';

type UseLiveRoomBusOptions = {
  roomId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  enabled?: boolean;
};

export type LiveLikeTapper = {
  userId: string;
  name: string;
  avatarUrl?: string;
  taps: number;
  lastAt: number;
};

export type LiveFollowTapper = {
  userId: string;
  name: string;
  avatarUrl?: string;
  lastAt: number;
};

function upsertLikeTapper(
  prev: LiveLikeTapper[],
  tapper: { userId: string; name: string; avatarUrl?: string; tapDelta?: number },
): LiveLikeTapper[] {
  const now = Date.now();
  const delta = Math.max(1, Math.floor(tapper.tapDelta ?? 1));
  const existing = prev.find((entry) => entry.userId === tapper.userId);
  const next: LiveLikeTapper = {
    userId: tapper.userId,
    name: tapper.name || existing?.name || 'Guest',
    avatarUrl: tapper.avatarUrl || existing?.avatarUrl,
    taps: (existing?.taps ?? 0) + delta,
    lastAt: now,
  };
  return [next, ...prev.filter((entry) => entry.userId !== tapper.userId)].slice(0, 80);
}

function upsertFollowTapper(
  prev: LiveFollowTapper[],
  tapper: { userId: string; name: string; avatarUrl?: string },
): LiveFollowTapper[] {
  const now = Date.now();
  const existing = prev.find((entry) => entry.userId === tapper.userId);
  const next: LiveFollowTapper = {
    userId: tapper.userId,
    name: tapper.name || existing?.name || 'Guest',
    avatarUrl: tapper.avatarUrl || existing?.avatarUrl,
    lastAt: now,
  };
  return [next, ...prev.filter((entry) => entry.userId !== tapper.userId)].slice(0, 80);
}

export function useLiveRoomBus({
  roomId,
  userId,
  userName,
  userAvatarUrl,
  enabled = true,
}: UseLiveRoomBusOptions) {
  const seenIdsRef = useRef(new Set<string>());
  const [lastGiftPlay, setLastGiftPlay] = useState<GiftPlayPayload | null>(null);
  const [lastPk, setLastPk] = useState<PKPayload | null>(null);
  const [lastPkId, setLastPkId] = useState<string | null>(null);
  const [lastCommerce, setLastCommerce] = useState<CommercePayload | null>(null);
  const [lastGame, setLastGame] = useState<GamePayload | null>(null);
  const [lastSeats, setLastSeats] = useState<SeatsSyncPayload | null>(null);
  const [lastLifecycle, setLastLifecycle] = useState<{ action?: string; roomId?: string } | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBursts, setLikeBursts] = useState<LiveLikeBurst[]>([]);
  const [likeTappers, setLikeTappers] = useState<LiveLikeTapper[]>([]);
  const [followCount, setFollowCount] = useState(0);
  const [followTappers, setFollowTappers] = useState<LiveFollowTapper[]>([]);
  /** High-throughput likes: local FX immediate; 120ms batch on loss-tolerant LiveKit data lane. */
  const likeBatchRef = useRef<{
    count: number;
    xPct: number;
    yPct: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ count: 0, xPct: 80, yPct: 70, timer: null });

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
      case 'lifecycle':
        setLastLifecycle(event.payload as { action?: string; roomId?: string });
        break;
      case 'follow': {
        const payload = (event.payload ?? {}) as { avatarUrl?: string; followerId?: string };
        setFollowCount((count) => count + 1);
        if (event.senderId) {
          setFollowTappers((prev) =>
            upsertFollowTapper(prev, {
              userId: event.senderId,
              name: event.senderName || 'Guest',
              avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : undefined,
            }),
          );
        }
        break;
      }
      case 'like': {
        const payload = (event.payload ?? {}) as {
          xPct?: number;
          yPct?: number;
          avatarUrl?: string;
          count?: number;
        };
        const batchCount = Math.max(
          1,
          Math.min(200, Math.floor(typeof payload.count === 'number' && Number.isFinite(payload.count) ? payload.count : 1)),
        );
        const xPct =
          typeof payload.xPct === 'number' && Number.isFinite(payload.xPct)
            ? payload.xPct
            : 70 + Math.random() * 20;
        const yPct =
          typeof payload.yPct === 'number' && Number.isFinite(payload.yPct)
            ? payload.yPct
            : 58 + Math.random() * 24;
        setLikeCount((count) => count + batchCount);
        // Bound FX particles — thermal reduces decorative budget first (never the counter).
        const burstCap = Math.max(2, Math.round(12 * getThermalPolicy().fxBudget));
        const burstN = Math.min(batchCount, burstCap);
        setLikeBursts((prev) => [
          ...prev.slice(-(40 - burstN)),
          ...Array.from({ length: burstN }, (_, i) => ({
            id: `${event.id}_${i}`,
            xPct: xPct + (Math.random() - 0.5) * 6,
            yPct: yPct + (Math.random() - 0.5) * 6,
          })),
        ]);
        if (event.senderId) {
          setLikeTappers((prev) =>
            upsertLikeTapper(prev, {
              userId: event.senderId,
              name: event.senderName || 'Guest',
              avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : undefined,
              tapDelta: batchCount,
            }),
          );
        }
        break;
      }
      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !roomId) return undefined;
    seenIdsRef.current = new Set();
    if (likeBatchRef.current.timer) {
      clearTimeout(likeBatchRef.current.timer);
      likeBatchRef.current.timer = null;
      likeBatchRef.current.count = 0;
    }
    setLikeCount(0);
    setLikeBursts([]);
    setLikeTappers([]);
    setFollowCount(0);
    setFollowTappers([]);

    const unsubBus = subscribeLiveRoomEvents(roomId, handleEnvelope);
    const unsubCloud = subscribePartyRoomSyncEvents(roomId, handleEnvelope, userId);

    void fetchRecentPartyRoomSyncEvents(roomId, 40, userId).then((events) => {
      for (const event of events) {
        const replayPolicy =
          REALTIME_REPLAY_BY_TYPE[event.type] ??
          (event.type === 'gift_play' ? 'ACTIVE_FX' : 'STATE');
        const payload = (event.payload ?? {}) as { expiresAt?: number };
        if (
          !shouldReplayEvent({
            replayPolicy,
            expiresAt:
              typeof payload.expiresAt === 'number'
                ? payload.expiresAt
                : replayPolicy === 'ACTIVE_FX'
                  ? event.ts + 12_000
                  : undefined,
          })
        ) {
          continue;
        }
        handleEnvelope(event);
      }
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

  const emitLifecycle = useCallback(
    (payload: { action: 'ended' | 'ending'; roomId?: string }) =>
      emit('lifecycle', payload as unknown as Record<string, unknown>),
    [emit],
  );

  const emitLike = useCallback(
    (payload: { xPct?: number; yPct?: number } = {}) => {
      if (!roomId || !userId) return;
      const xPct =
        typeof payload.xPct === 'number' && Number.isFinite(payload.xPct)
          ? payload.xPct
          : 70 + Math.random() * 20;
      const yPct =
        typeof payload.yPct === 'number' && Number.isFinite(payload.yPct)
          ? payload.yPct
          : 58 + Math.random() * 24;
      const avatarUrl = userAvatarUrl?.trim() || undefined;
      const localId = `like_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      // Instant local feedback — never waits on the network.
      setLikeCount((count) => count + 1);
      setLikeBursts((prev) => [...prev.slice(-40), { id: localId, xPct, yPct }]);
      setLikeTappers((prev) =>
        upsertLikeTapper(prev, {
          userId,
          name: userName,
          avatarUrl,
        }),
      );

      const batch = likeBatchRef.current;
      batch.count += 1;
      batch.xPct = xPct;
      batch.yPct = yPct;
      if (batch.timer) return;
      batch.timer = setTimeout(() => {
        const flushCount = batch.count;
        const flushX = batch.xPct;
        const flushY = batch.yPct;
        batch.count = 0;
        batch.timer = null;
        if (flushCount <= 0) return;
        const id = `like_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        seenIdsRef.current.add(id);
        publishLiveRoomEvent(roomId, {
          id,
          type: 'like',
          senderId: userId,
          senderName: userName,
          reliable: false,
          payload: {
            xPct: flushX,
            yPct: flushY,
            count: flushCount,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
        });
      }, 120);
    },
    [roomId, userId, userName, userAvatarUrl],
  );

  const dismissLikeBurst = useCallback((id: string) => {
    setLikeBursts((prev) => prev.filter((burst) => burst.id !== id));
  }, []);

  const emitFollow = useCallback(
    (payload: { followerId?: string } = {}) => {
      if (!roomId || !userId) return;
      const id = `follow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      seenIdsRef.current.add(id);
      setFollowCount((count) => count + 1);
      setFollowTappers((prev) =>
        upsertFollowTapper(prev, {
          userId,
          name: userName,
          avatarUrl: userAvatarUrl,
        }),
      );
      publishLiveRoomEvent(roomId, {
        id,
        type: 'follow',
        senderId: userId,
        senderName: userName,
        payload: {
          followerId: payload.followerId ?? userId,
          ...(userAvatarUrl ? { avatarUrl: userAvatarUrl } : {}),
        },
      });
    },
    [roomId, userId, userName, userAvatarUrl],
  );

  return {
    lastGiftPlay,
    lastPk,
    lastPkId,
    lastCommerce,
    lastGame,
    lastSeats,
    lastLifecycle,
    likeCount,
    likeBursts,
    likeTappers,
    followCount,
    followTappers,
    emitGiftPlay,
    emitPk,
    emitCommerce,
    emitGame,
    emitSeats,
    emitLifecycle,
    emitLike,
    emitFollow,
    dismissLikeBurst,
  };
}
