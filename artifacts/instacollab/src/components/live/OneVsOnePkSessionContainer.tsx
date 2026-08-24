import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useDB } from '../../lib/useDB';
import { findUserById, resolveUser } from '../../lib/safe';
import { useOptionalI18n } from '../../lib/i18n';
import { SEMANTIC_EN } from '../../lib/i18n/semanticCatalog';
import {
  connectLiveLifecycleSession,
  endLivePk,
  ensureLiveLifecycleRoom,
  fetchHostDashboardSnapshot,
  fetchLivePkSession,
  ingestLiveHostDashboard,
  leaveLiveRoom,
  startLivePk,
  type LivePkSessionSnapshot,
} from '../../lib/platformApi';
import { setPkLocalSessionOpen } from '../../lib/live/pkSessionGate';
import { getActiveHostLiveKitRoom } from '../../lib/livekit/hostLiveKitRoom';
import { newLifecycleCommandId, newParticipantSessionId } from '../../lib/liveLifecycle';
import { connectLiveKitHost, disconnectLiveKit } from '../../lib/live/liveKitConnection';
import { fetchPkLiveKitAuth } from '../../lib/live/pkLiveMedia';
import { resolvePkMediaSurface } from '../../lib/live/pkLiveMediaRef';
import { permanentlyEndHostLive } from '../../lib/live/permanentlyEndHostLive';
import { getAppCameraStream, setAppCameraFacing, type CameraFacingMode } from '../../lib/camera/appCameraOwner';
import { updateLiveKitLocalVideoTrack } from '../../lib/livekit/liveKitVideoPublish';
import { canAttemptLiveKit, instantRoomOptions } from '../../lib/livekit/liveKitInstant';
import {
  registerLiveKitRoom,
  subscribeLiveRoomEvents,
  unregisterLiveKitRoom,
} from '../../lib/livekit/liveRoomBus';
import {
  applyPkScoreEvent,
  pkSnapshotFromSession,
  type PkRealtimeScoreEvent,
  type PkScoreSnapshot,
} from '../../lib/live/applyPkScoreEvent';
import { usePartyRoomChat } from '../../smule-rooms/hooks/usePartyRoomChat';
import {
  OneVsOnePkRoom,
  type OneVsOnePkLabels,
  type PkCommentView,
  type PkCreatorView,
} from './OneVsOnePkRoom';
import { LiveSellPkRoom } from './LiveSellPkRoom';
import { getPinnedCommerceProduct } from '../../lib/commerce/commerceOrderStore';
import { emptyPkCameraPlaceholder, PkUserCamera, type PkAttachableVideoTrack } from './PkUserCamera';
import type { PartyGiftDefinition } from '../../smule-rooms/utils/roomGifts';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';

const PartyGiftPickerPanel = lazy(() =>
  import('../../smule-rooms/components/PartyGiftPickerPanel').then((m) => ({
    default: m.PartyGiftPickerPanel,
  })),
);
const LiveBeautySheet = lazy(() =>
  import('../../smule-rooms/components/LiveBeautySheet').then((m) => ({
    default: m.LiveBeautySheet,
  })),
);
const PkStickerSheet = lazy(() =>
  import('./PkStickerSheet').then((m) => ({ default: m.PkStickerSheet })),
);

export type OneVsOnePkSessionOpen = {
  /** LiveLifecycle / PK snapshot room id. Never pass a prefixed stream-* id here. */
  roomId: string;
  /** LiveKit token target for this client's primary surface. */
  streamId: string;
  mediaSurface?: 'stream' | 'party';
  /** Opponent LiveKit media id. Viewer/host subscribe as viewer; identity === user_id. */
  opponentStreamId?: string | null;
  opponentMediaSurface?: 'stream' | 'party' | null;
  /** Opponent host's lifecycle room. Required so End Live tears down the correct live. */
  opponentRoomId?: string | null;
  /** This participant's publish media id when they are a live host. */
  ownStreamId?: string | null;
  isHost: boolean;
  hostUserId: string;
  opponentUserId?: string | null;
  hostName: string;
  opponentName?: string;
  hostAvatarUrl?: string;
  opponentAvatarUrl?: string;
  /** Keep existing host LiveKit publish (smule-rooms) when overlay closes. */
  keepHostMedia?: boolean;
  /** Accept flow already created the canonical PK session. */
  skipStartPk?: boolean;
  liveSell?: boolean;
  /** Test-only. Real server sessions must never set this. */
  allowPreviewAssets?: boolean;
};

function tFallback(key: string, fallback: string, i18n: { t: (k: string) => string } | null) {
  if (!i18n) return fallback;
  const value = i18n.t(key);
  return !value || value === key ? fallback : value;
}

function remainingFromEndsAt(endsAt: string | null | undefined, now = Date.now()): number {
  if (!endsAt) return 0;
  const ms = Date.parse(endsAt);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.ceil((ms - now) / 1000));
}

export function OneVsOnePkSessionContainer({
  session,
  onClose,
}: {
  session: OneVsOnePkSessionOpen;
  onClose: () => void;
}) {
  const db = useDB();
  const me = resolveUser(db.users, db.currentUser);
  const i18n = useOptionalI18n();
  const locale = i18n?.locale ?? 'en';
  const isPkCreator = me.id === session.hostUserId || Boolean(session.opponentUserId && me.id === session.opponentUserId);
  const isHost = Boolean(session.isHost && isPkCreator);

  const participantSessionIdRef = useRef(newParticipantSessionId(me.id));
  const livekitRoomRef = useRef<Room | null>(null);
  const opponentRoomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraLeaseIdRef = useRef<string | undefined>(undefined);
  const seenScoreIdsRef = useRef(new Set<string>());
  const scoreRef = useRef<PkScoreSnapshot>(
    pkSnapshotFromSession({
      roomId: session.roomId,
      hostUserId: session.hostUserId,
      opponentUserId: session.opponentUserId,
    }),
  );
  const pendingScoreRef = useRef<PkScoreSnapshot | null>(null);
  const scoreRafRef = useRef(0);
  const pkVersionRef = useRef<number | undefined>(undefined);
  const closedRef = useRef(false);

  const [pkMeta, setPkMeta] = useState<{
    opponentUserId: string | null;
    endsAt: string | null;
    multiplier: number;
    status: LivePkSessionSnapshot['status'] | null;
  }>({
    opponentUserId: session.opponentUserId ?? null,
    endsAt: null,
    multiplier: 1,
    status: null,
  });
  const [score, setScore] = useState<PkScoreSnapshot>(scoreRef.current);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [viewersLabel, setViewersLabel] = useState('0');
  const [connectionLabel, setConnectionLabel] = useState(() =>
    tFallback('live.pk.connectionStable', 'Stable', i18n),
  );
  const [muted, setMuted] = useState(false);
  const [facing, setFacing] = useState<CameraFacingMode>('user');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteTracks, setRemoteTracks] = useState<Record<string, PkAttachableVideoTrack>>({});
  const [isPkEnding, setIsPkEnding] = useState(false);
  const [isLiveEnding, setIsLiveEnding] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [beautyOpen, setBeautyOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [giftBalance, setGiftBalance] = useState(0);
  const [beautyId, setBeautyId] = useState<BeautyPresetId>('none');

  const labels: Partial<OneVsOnePkLabels> = useMemo(
    () => ({
      live: tFallback('common.live', SEMANTIC_EN['common.live'] ?? 'LIVE', i18n).toUpperCase(),
      camerasLabel: tFallback('live.pk.camerasLabel', '1v1 live cameras', i18n),
      scoreLabel: tFallback('live.pk.scoreLabel', 'Realtime PK score', i18n),
      commentsLabel: tFallback('live.pk.commentsLabel', 'Live comments', i18n),
      leaveRoom: tFallback('live.pk.leaveRoom', 'Leave Room', i18n),
      roomMenu: tFallback('live.pk.roomMenu', 'Room menu', i18n),
      endPk: tFallback('live.pk.end', SEMANTIC_EN['live.pk.end'] ?? 'End PK', i18n),
      ending: tFallback('live.ending', SEMANTIC_EN['live.ending'] ?? 'Ending…', i18n),
      endPkConfirmTitle: tFallback('live.pk.endConfirmTitle', 'End this PK battle?', i18n),
      endPkConfirmBody: tFallback(
        'live.pk.endConfirmBody',
        'The live room continues after the PK ends.',
        i18n,
      ),
      endLive: tFallback('live.endLive', SEMANTIC_EN['live.endLive'] ?? 'End Live', i18n),
      endLiveConfirmTitle: tFallback('live.endLive.confirmTitle', 'End live stream?', i18n),
      endLiveConfirmBody: tFallback(
        'live.endLive.confirmBody',
        'This closes the room for the host and every viewer.',
        i18n,
      ),
      cancel: tFallback('common.cancel', SEMANTIC_EN['common.cancel'] ?? 'Cancel', i18n),
      saySomething: tFallback('live.pk.saySomething', 'Say something…', i18n),
      openStickers: tFallback('live.pk.openStickers', 'Open stickers', i18n),
      gift: tFallback('live.pk.gift', 'Gift', i18n),
      beauty: tFallback('live.pk.beauty', 'Beauty', i18n),
      muteMicrophone: tFallback(
        'a11y.muteMicrophone',
        SEMANTIC_EN['a11y.muteMicrophone'] ?? 'Mute microphone',
        i18n,
      ),
      unmuteMicrophone: tFallback('live.pk.unmuteMicrophone', 'Unmute microphone', i18n),
      flipCamera: tFallback(
        'common.flipCamera',
        SEMANTIC_EN['common.flipCamera'] ?? 'Flip camera',
        i18n,
      ),
      more: tFallback('live.pk.more', 'More', i18n),
    }),
    [i18n, locale, i18n?.generation],
  );

  const hostUser = resolveUser(db.users, findUserById(db.users, session.hostUserId), me);
  const opponentUser = pkMeta.opponentUserId
    ? resolveUser(db.users, findUserById(db.users, pkMeta.opponentUserId), me)
    : null;

  const leftCreator: PkCreatorView = useMemo(
    () => ({
      id: session.hostUserId,
      name: session.hostName || hostUser.displayName || hostUser.username || 'Host',
      avatarUrl: session.hostAvatarUrl || hostUser.avatarUrl || undefined,
      audienceLabel: viewersLabel,
      verified: true,
    }),
    [session.hostUserId, session.hostName, session.hostAvatarUrl, hostUser, viewersLabel],
  );

  const rightCreator: PkCreatorView = useMemo(
    () => ({
      id: pkMeta.opponentUserId || 'pk-opponent',
      name:
        session.opponentName ||
        opponentUser?.displayName ||
        opponentUser?.username ||
        tFallback('live.pk.waitingOpponent', 'Waiting', i18n),
      avatarUrl: session.opponentAvatarUrl || opponentUser?.avatarUrl || undefined,
      audienceLabel: viewersLabel,
      verified: Boolean(pkMeta.opponentUserId),
    }),
    [
      pkMeta.opponentUserId,
      session.opponentName,
      session.opponentAvatarUrl,
      opponentUser,
      viewersLabel,
      i18n,
      locale,
    ],
  );

  const chat = usePartyRoomChat({
    roomId: session.roomId,
    enabled: true,
    senderId: me.id,
    senderName: me.displayName || me.username || 'User',
    unifiedMirrorRoomId: null,
    unifiedChatActive: false,
  });

  const comments: PkCommentView[] = useMemo(
    () =>
      chat.messages.slice(-20).map((message) => ({
        id: String(message.id),
        userName: message.user || 'User',
        message: message.isStickerEvent ? '' : message.text ?? '',
        userAvatarUrl: undefined,
        stickerAssetUrl: message.isStickerEvent ? message.stickerAssetUrl : undefined,
        stickerId: message.isStickerEvent ? message.stickerId : undefined,
      })),
    [chat.messages],
  );

  const commitScore = useCallback((next: PkScoreSnapshot) => {
    scoreRef.current = next;
    pendingScoreRef.current = next;
    if (scoreRafRef.current) return;
    scoreRafRef.current = window.requestAnimationFrame(() => {
      scoreRafRef.current = 0;
      const pending = pendingScoreRef.current;
      if (pending) setScore(pending);
    });
  }, []);

  const reloadAuthoritativeSnapshot = useCallback(async () => {
    const snap = await fetchLivePkSession(session.roomId);
    const pk = snap.pk;
    if (!pk || ['ended', 'cancelled', 'expired'].includes(pk.status)) {
      if (pk) pkVersionRef.current = pk.version;
      setPkMeta((prev) => ({
        ...prev,
        status: (pk?.status as LivePkSessionSnapshot['status']) || 'ended',
        endsAt: pk?.endsAt ?? prev.endsAt,
        opponentUserId: pk?.opponentUserId ?? prev.opponentUserId,
      }));
      return;
    }
    pkVersionRef.current = pk.version;
    setPkMeta({
      opponentUserId: pk.opponentUserId,
      endsAt: pk.endsAt,
      multiplier: pk.multiplier || 1,
      status: pk.status,
    });
    commitScore(
      pkSnapshotFromSession({
        roomId: session.roomId,
        hostUserId: pk.hostUserId || snap.hostUserId || session.hostUserId,
        opponentUserId: pk.opponentUserId,
        localScore: pk.localScore,
        opponentScore: pk.opponentScore,
        sequence: pk.sequence,
        version: pk.version,
      }),
    );
  }, [commitScore, session.hostUserId, session.roomId]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void reloadAuthoritativeSnapshot();
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reloadAuthoritativeSnapshot]);

  useEffect(() => {
    setPkLocalSessionOpen(session.roomId);
    return () => setPkLocalSessionOpen(null);
  }, [session.roomId]);

  useEffect(() => {
    closedRef.current = false;
    const participantSessionId = participantSessionIdRef.current;
    let cancelled = false;

    const ingestTrack = (identity: string | undefined, track?: PkAttachableVideoTrack | null) => {
      const userId = identity?.trim();
      if (!userId || !track || typeof track.attach !== 'function') return;
      setRemoteTracks((prev) => (prev[userId] === track ? prev : { ...prev, [userId]: track }));
    };
    const dropTrack = (identity: string | undefined) => {
      const userId = identity?.trim();
      if (!userId) return;
      setRemoteTracks((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };
    const bindRoomTracks = (room: Room) => {
      const onSubscribed = (
        track: { mediaStreamTrack?: MediaStreamTrack; kind?: Track.Kind },
        _pub: unknown,
        participant: { identity?: string },
      ) => {
        if (track.kind && track.kind !== Track.Kind.Video) return;
        ingestTrack(participant.identity, track as PkAttachableVideoTrack);
      };
      const onUnsubscribed = (
        _track: unknown,
        _pub: unknown,
        participant: { identity?: string },
      ) => {
        dropTrack(participant.identity);
      };
      room.on(RoomEvent.TrackSubscribed, onSubscribed as never);
      room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed as never);
      room.remoteParticipants.forEach((participant) => {
        participant.videoTrackPublications.forEach((pub) => {
          ingestTrack(participant.identity, pub.track as PkAttachableVideoTrack | null | undefined);
        });
      });
    };

    async function subscribeOpponent(streamId: string | null | undefined) {
      if (!streamId || !canAttemptLiveKit() || streamId === session.streamId) return;
      try {
        const surface = resolvePkMediaSurface(session.opponentMediaSurface, streamId);
        const auth = await fetchPkLiveKitAuth(streamId, surface, 'viewer');
        const room = new Room(instantRoomOptions());
        await room.connect(auth.url, auth.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        opponentRoomRef.current = room;
        bindRoomTracks(room);
      } catch {
        /* opponent stream may still be publishing */
      }
    }

    async function boot() {
      try {
        if (isHost) {
          await ensureLiveLifecycleRoom({
            roomId: session.roomId,
            roomType: 'pk_1v1',
          });
          await connectLiveLifecycleSession({
            roomId: session.roomId,
            participantSessionId,
            role: me.id === session.hostUserId ? 'host' : 'guest',
            roomType: 'pk_1v1',
          });
          if (!session.skipStartPk && session.opponentUserId) {
            await startLivePk(session.roomId, {
              opponentUserId: session.opponentUserId,
              opponentRoomId: session.opponentStreamId || null,
              hostMediaId: session.streamId,
              opponentMediaId: session.opponentStreamId || null,
              hostMediaSurface: resolvePkMediaSurface(session.mediaSurface, session.streamId),
              opponentMediaSurface: session.opponentStreamId
                ? resolvePkMediaSurface(session.opponentMediaSurface, session.opponentStreamId)
                : null,
              durationSec: 180,
              roomType: 'pk_1v1',
            });
          }
        } else {
          await connectLiveLifecycleSession({
            roomId: session.roomId,
            participantSessionId,
            role: 'viewer',
            roomType: 'pk_1v1',
          }).catch(() => undefined);
        }
        if (!cancelled) await reloadAuthoritativeSnapshot();
      } catch {
        /* snapshot/lifecycle may still be preparing */
      }

      try {
        const existingHostRoom = getActiveHostLiveKitRoom();
        const existingStream = getAppCameraStream();
        if (isHost && session.keepHostMedia && (existingHostRoom || existingStream)) {
          livekitRoomRef.current = existingHostRoom;
          if (existingStream) {
            localStreamRef.current = existingStream;
            setLocalStream(existingStream);
          }
          if (existingHostRoom) registerLiveKitRoom(session.roomId, existingHostRoom);
          setConnectionLabel(tFallback('live.pk.connectionStable', 'Stable', i18n));
          if (existingHostRoom) bindRoomTracks(existingHostRoom);
          await subscribeOpponent(session.opponentStreamId);
        } else if (isHost) {
          const ownSurface = resolvePkMediaSurface(session.mediaSurface, session.streamId);
          if (ownSurface === 'party') {
            const auth = await fetchPkLiveKitAuth(session.streamId, 'party', 'host');
            const room = new Room(instantRoomOptions());
            await room.connect(auth.url, auth.token);
            if (cancelled) {
              room.disconnect();
              return;
            }
            livekitRoomRef.current = room;
            const local = getAppCameraStream();
            if (local) {
              localStreamRef.current = local;
              setLocalStream(local);
            }
            registerLiveKitRoom(session.roomId, room);
            setConnectionLabel(tFallback('live.pk.connectionStable', 'Stable', i18n));
            bindRoomTracks(room);
            await subscribeOpponent(session.opponentStreamId);
          } else {
            const connection = await connectLiveKitHost(session.streamId);
            if (cancelled) {
              await disconnectLiveKit(connection.room, connection.localStream, connection.cameraLeaseId);
              return;
            }
            livekitRoomRef.current = connection.room;
            localStreamRef.current = connection.localStream;
            cameraLeaseIdRef.current = connection.cameraLeaseId;
            setLocalStream(connection.localStream);
            registerLiveKitRoom(session.roomId, connection.room);
            setConnectionLabel(tFallback('live.pk.connectionStable', 'Stable', i18n));
            bindRoomTracks(connection.room);
            await subscribeOpponent(session.opponentStreamId);
          }
        } else if (canAttemptLiveKit()) {
          const surface = resolvePkMediaSurface(session.mediaSurface, session.streamId);
          const auth = await fetchPkLiveKitAuth(session.streamId, surface, 'viewer');
          const room = new Room(instantRoomOptions());
          await room.connect(auth.url, auth.token);
          if (cancelled) {
            room.disconnect();
            return;
          }
          livekitRoomRef.current = room;
          registerLiveKitRoom(session.roomId, room);
          setConnectionLabel(tFallback('live.pk.connectionStable', 'Stable', i18n));
          bindRoomTracks(room);
          await subscribeOpponent(session.opponentStreamId);
        }
      } catch {
        if (!cancelled) {
          setConnectionLabel(tFallback('live.pk.connectionUnstable', 'Reconnecting', i18n));
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
      const room = livekitRoomRef.current;
      if (room && !session.keepHostMedia) unregisterLiveKitRoom(session.roomId, room);
      opponentRoomRef.current?.disconnect();
      opponentRoomRef.current = null;
    };
  }, [
    i18n,
    isHost,
    me.id,
    reloadAuthoritativeSnapshot,
    session.keepHostMedia,
    session.mediaSurface,
    session.opponentMediaSurface,
    session.opponentStreamId,
    session.opponentUserId,
    session.ownStreamId,
    session.roomId,
    session.skipStartPk,
    session.streamId,
  ]);

  useEffect(() => {
    return subscribeLiveRoomEvents(session.roomId, (event) => {
      if (event.type !== 'pk') return;
      const payload = event.payload as Partial<PkRealtimeScoreEvent> & {
        action?: string;
        state?: { teamAScore?: number; teamBScore?: number };
      };
      if (payload.action === 'sync' && payload.state) {
        void reloadAuthoritativeSnapshot();
        return;
      }
      if (
        typeof payload.eventId !== 'string' ||
        typeof payload.sequence !== 'number' ||
        typeof payload.previousSequence !== 'number' ||
        typeof payload.localScore !== 'number' ||
        typeof payload.opponentScore !== 'number'
      ) {
        if (payload.action === 'score') void reloadAuthoritativeSnapshot();
        return;
      }
      const applied = applyPkScoreEvent(
        scoreRef.current,
        {
          eventId: payload.eventId,
          roomId: event.roomId,
          sequence: payload.sequence,
          previousSequence: payload.previousSequence,
          hostUserId: payload.hostUserId || session.hostUserId,
          opponentUserId: payload.opponentUserId ?? pkMeta.opponentUserId,
          localScore: payload.localScore,
          opponentScore: payload.opponentScore,
          version: payload.version,
        },
        seenScoreIdsRef.current,
      );
      if (!applied.ok && applied.reason === 'gap') {
        void reloadAuthoritativeSnapshot();
        return;
      }
      if (applied.ok && !applied.duplicate) commitScore(applied.snapshot);
    });
  }, [commitScore, pkMeta.opponentUserId, reloadAuthoritativeSnapshot, session.hostUserId, session.roomId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const dash = await fetchHostDashboardSnapshot(session.roomId);
        if (cancelled) return;
        const viewers = dash.snapshot.audience.currentUniqueViewers || dash.snapshot.audience.currentConnections;
        setViewersLabel(String(viewers));
        if (dash.snapshot.pk?.localScore != null && dash.snapshot.pk?.opponentScore != null) {
          const next = pkSnapshotFromSession({
            ...scoreRef.current,
            localScore: dash.snapshot.pk.localScore,
            opponentScore: dash.snapshot.pk.opponentScore,
            sequence: Math.max(scoreRef.current.sequence, dash.snapshot.sequence),
          });
          if (
            next.localScore !== scoreRef.current.localScore ||
            next.opponentScore !== scoreRef.current.opponentScore
          ) {
            commitScore(next);
          }
        }
        if (dash.snapshot.pk?.endsAt) {
          setPkMeta((prev) => ({ ...prev, endsAt: dash.snapshot.pk.endsAt }));
        }
      } catch {
        /* keep last known viewers */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    const onScoreHint = () => {
      void tick();
    };
    window.addEventListener('live-pk-score-updated', onScoreHint);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('live-pk-score-updated', onScoreHint);
    };
  }, [commitScore, session.roomId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSeconds(remainingFromEndsAt(pkMeta.endsAt));
    }, 1000);
    setRemainingSeconds(remainingFromEndsAt(pkMeta.endsAt));
    return () => window.clearInterval(id);
  }, [pkMeta.endsAt]);

  useEffect(() => {
    return () => {
      if (scoreRafRef.current) window.cancelAnimationFrame(scoreRafRef.current);
    };
  }, []);

  const cleanupMedia = useCallback(async (endLive = false) => {
    opponentRoomRef.current?.disconnect();
    opponentRoomRef.current = null;
    if (session.keepHostMedia && !endLive) {
      livekitRoomRef.current = null;
      localStreamRef.current = null;
      setLocalStream(null);
      return;
    }
    const room = livekitRoomRef.current;
    if (room) unregisterLiveKitRoom(session.roomId, room);
    await disconnectLiveKit(room, localStreamRef.current, cameraLeaseIdRef.current);
    livekitRoomRef.current = null;
    localStreamRef.current = null;
    cameraLeaseIdRef.current = undefined;
    setLocalStream(null);
  }, [session.keepHostMedia, session.roomId]);

  const onLeaveRoom = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    void leaveLiveRoom(session.roomId, {
      commandId: newLifecycleCommandId('leave'),
      participantSessionId: participantSessionIdRef.current,
      reason: 'user_selected_leave',
    }).catch(() => undefined);
    void cleanupMedia();
    onClose();
  }, [cleanupMedia, onClose, session.roomId]);

  const ownLifecycleRoomId =
    me.id === session.hostUserId
      ? session.roomId
      : session.opponentRoomId || session.ownStreamId || session.streamId;

  const closePkOverlay = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    void cleanupMedia();
    onClose();
  }, [cleanupMedia, onClose]);

  const onEndPk = useCallback(async () => {
    if (!isHost) return;
    setIsPkEnding(true);
    try {
      const result = await endLivePk(session.roomId, {
        commandId: newLifecycleCommandId('pk-end'),
      });
      setPkMeta((prev) => ({
        ...prev,
        status: (result.pkStatus as LivePkSessionSnapshot['status']) || 'ended',
      }));
      commitScore({
        ...scoreRef.current,
        localScore: result.localScore ?? scoreRef.current.localScore,
        opponentScore: result.opponentScore ?? scoreRef.current.opponentScore,
      });
      closePkOverlay();
    } finally {
      setIsPkEnding(false);
    }
  }, [closePkOverlay, commitScore, isHost, session.roomId]);

  const onEndLive = useCallback(async () => {
    if (!isHost) return;
    setIsLiveEnding(true);
    try {
      let roomVersion = 1;
      try {
        const dash = await fetchHostDashboardSnapshot(ownLifecycleRoomId);
        roomVersion = dash.snapshot.roomVersion || 1;
      } catch {
        /* API remaps a mismatched version */
      }
      await permanentlyEndHostLive({
        roomId: ownLifecycleRoomId,
        hostUserId: me.id,
        expectedRoomVersion: roomVersion,
        extraRoomIds: me.id === session.hostUserId ? [session.roomId] : [],
        streamIds: [session.ownStreamId, me.id === session.hostUserId ? session.streamId : null],
      });
      await cleanupMedia(true);
      if (!closedRef.current) {
        closedRef.current = true;
        onClose();
      }
    } finally {
      setIsLiveEnding(false);
    }
  }, [
    cleanupMedia,
    isHost,
    me.id,
    onClose,
    ownLifecycleRoomId,
    session.ownStreamId,
    session.roomId,
    session.streamId,
    session.hostUserId,
  ]);

  useEffect(() => {
    if (!pkMeta.status || !['ended', 'cancelled', 'expired'].includes(pkMeta.status)) return;
    closePkOverlay();
  }, [closePkOverlay, pkMeta.status]);

  useEffect(() => {
    if (!isHost || !pkMeta.endsAt) return;
    if (pkMeta.status && ['ended', 'cancelled', 'expired'].includes(pkMeta.status)) return;
    const tryEnd = () => {
      if (remainingFromEndsAt(pkMeta.endsAt) > 0) return;
      void onEndPk();
    };
    tryEnd();
    const id = window.setInterval(tryEnd, 1000);
    return () => window.clearInterval(id);
  }, [isHost, onEndPk, pkMeta.endsAt, pkMeta.status]);

  const onSendComment = useCallback(
    async (message: string, clientId: string) => {
      chat.appendMessage({
        id: clientId,
        user: me.displayName || me.username || 'User',
        userId: me.id,
        text: message,
        isBurmese: false,
      });
      void ingestLiveHostDashboard(session.roomId, { kind: 'comment' }).catch(() => undefined);
    },
    [chat, me.displayName, me.id, me.username, session.roomId],
  );

  const onToggleMicrophone = useCallback(() => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    void livekitRoomRef.current?.localParticipant.setMicrophoneEnabled(!next).catch(() => undefined);
  }, [muted]);

  const onFlipCamera = useCallback(async () => {
    if (!isPkCreator) return;
    const next: CameraFacingMode = facing === 'user' ? 'environment' : 'user';
    try {
      const stream = await setAppCameraFacing(next);
      if (!stream) return;
      setFacing(next);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const video = stream.getVideoTracks().find((track) => track.readyState === 'live');
      const room = livekitRoomRef.current || getActiveHostLiveKitRoom();
      if (room && video) await updateLiveKitLocalVideoTrack(room.localParticipant, video);
    } catch {
      /* keep current facing */
    }
  }, [facing, isPkCreator]);

  const onOpenGifts = useCallback(() => {
    void import('../../lib/walletKstarSync')
      .then((m) => setGiftBalance(m.getLiveCoinsBalance(me.id)))
      .catch(() => setGiftBalance(0));
    setGiftsOpen(true);
  }, [me.id]);

  const onSendGift = useCallback(
    (gift: PartyGiftDefinition, quantity = 1) => {
      const receiverId =
        me.id === session.hostUserId
          ? pkMeta.opponentUserId || session.hostUserId
          : me.id === pkMeta.opponentUserId
            ? session.hostUserId
            : session.hostUserId;
      void import('../../lib/partyGiftPayments')
        .then((m) =>
          m.settlePartyGiftSend(me.id, receiverId, gift.stars * Math.max(1, quantity), {
            giftId: gift.id || `gift_${gift.stars}`,
            giftName: gift.name,
            roomId: session.roomId,
            quantity,
            clientRequestId: newLifecycleCommandId('gift'),
          }),
        )
        .then(() => reloadAuthoritativeSnapshot())
        .catch(() => undefined);
    },
    [me.id, pkMeta.opponentUserId, reloadAuthoritativeSnapshot, session.hostUserId, session.roomId],
  );

  const leftCamera: ReactNode = useMemo(() => {
    const userId = session.hostUserId;
    if (localStream && me.id === userId) {
      return (
        <PkUserCamera
          userId={userId}
          mediaStream={localStream}
          muted
          mirror={facing === 'user'}
        />
      );
    }
    const track = remoteTracks[userId];
    if (track) return <PkUserCamera userId={userId} liveKitTrack={track} muted />;
    return emptyPkCameraPlaceholder(leftCreator.name);
  }, [facing, leftCreator.name, localStream, me.id, remoteTracks, session.hostUserId]);

  const rightCamera: ReactNode = useMemo(() => {
    const userId = pkMeta.opponentUserId;
    if (!userId) return emptyPkCameraPlaceholder(rightCreator.name);
    if (localStream && me.id === userId) {
      return (
        <PkUserCamera
          userId={userId}
          mediaStream={localStream}
          muted
          mirror={facing === 'user'}
        />
      );
    }
    const track = remoteTracks[userId];
    if (track) return <PkUserCamera userId={userId} liveKitTrack={track} muted />;
    return emptyPkCameraPlaceholder(rightCreator.name);
  }, [facing, localStream, me.id, pkMeta.opponentUserId, remoteTracks, rightCreator.name]);

  const flashSale = useMemo(() => {
    const product = getPinnedCommerceProduct();
    if (!product) return null;
    return {
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      remainingLabel: remainingSeconds > 0 ? `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}` : 'Live',
    };
  }, [remainingSeconds, score.localScore]);

  const pkRoom = session.liveSell ? (
    <LiveSellPkRoom
      roomId={session.roomId}
      leftCreator={{
        id: leftCreator.id,
        name: leftCreator.name,
        avatarUrl: leftCreator.avatarUrl,
        audienceLabel: leftCreator.audienceLabel,
        followersLabel: leftCreator.audienceLabel,
      }}
      rightCreator={{
        id: rightCreator.id,
        name: rightCreator.name,
        avatarUrl: rightCreator.avatarUrl,
        audienceLabel: rightCreator.audienceLabel,
        followersLabel: rightCreator.audienceLabel,
      }}
      leftCamera={leftCamera}
      rightCamera={rightCamera}
      leftScore={score.localScore}
      rightScore={score.opponentScore}
      remainingSeconds={remainingSeconds}
      multiplier={pkMeta.multiplier}
      viewersLabel={viewersLabel}
      connectionLabel={connectionLabel}
      comments={comments.map((comment) => ({
        id: comment.id,
        userName: comment.userName,
        message: comment.message,
        userAvatarUrl: comment.userAvatarUrl,
      }))}
      flashSale={flashSale}
      isHost={isHost}
      isPkEnding={isPkEnding || pkMeta.status === 'ended'}
      isLiveEnding={isLiveEnding}
      onLeaveRoom={onLeaveRoom}
      onEndPk={onEndPk}
      onEndLive={onEndLive}
      onOpenViewerList={() => undefined}
      onOpenRanking={() => undefined}
      onOpenDailyGift={onOpenGifts}
      onOpenMyGifts={onOpenGifts}
      onOpenFlashSale={() => {
        const product = getPinnedCommerceProduct();
        if (product) {
          window.dispatchEvent(new CustomEvent('unilive-commerce-buy', { detail: { product } }));
        }
      }}
      onFollowCreator={() => undefined}
      onSendComment={onSendComment}
      onOpenStickers={() => setStickersOpen(true)}
      onOpenGiftPanel={onOpenGifts}
      onOpenGuests={() => undefined}
      onOpenPkPanel={() => undefined}
      onOpenEffects={() => setBeautyOpen(true)}
      onOpenMore={() => undefined}
      onOpenShop={() => {
        const product = getPinnedCommerceProduct();
        if (product) {
          window.dispatchEvent(new CustomEvent('unilive-commerce-buy', { detail: { product } }));
        }
      }}
    />
  ) : (
    <OneVsOnePkRoom
      roomId={session.roomId}
      leftCreator={leftCreator}
      rightCreator={rightCreator}
      leftCamera={leftCamera}
      rightCamera={rightCamera}
      leftScore={score.localScore}
      rightScore={score.opponentScore}
      remainingSeconds={remainingSeconds}
      multiplier={pkMeta.multiplier}
      viewersLabel={viewersLabel}
      connectionLabel={connectionLabel}
      locale={locale}
      labels={labels}
      comments={comments}
      isHost={isHost}
      isPkEnding={isPkEnding || pkMeta.status === 'ended'}
      isLiveEnding={isLiveEnding}
      muted={muted}
      onLeaveRoom={onLeaveRoom}
      onEndPk={onEndPk}
      onEndLive={onEndLive}
      onSendComment={onSendComment}
      onOpenStickers={() => setStickersOpen(true)}
      onOpenGifts={onOpenGifts}
      onOpenBeauty={() => setBeautyOpen(true)}
      onToggleMicrophone={onToggleMicrophone}
      onFlipCamera={() => void onFlipCamera()}
    />
  );

  return (
    <div
      className="u1pk-overlay"
      data-ui-id="live.pk.1v1.session"
      data-pk-preview={session.allowPreviewAssets ? 'true' : 'false'}
    >
      {pkRoom}
      <Suspense fallback={null}>
        {giftsOpen ? (
          <PartyGiftPickerPanel
            open={giftsOpen}
            onClose={() => setGiftsOpen(false)}
            receiverName={isHost ? rightCreator.name : leftCreator.name}
            balance={giftBalance}
            roomTotalStars={0}
            isPlatformAdmin={me.role === 'admin'}
            onSendGift={onSendGift}
          />
        ) : null}
        {beautyOpen ? (
          <LiveBeautySheet
            isOpen={beautyOpen}
            onClose={() => setBeautyOpen(false)}
            activeBeautyId={beautyId}
            onSelectBeauty={setBeautyId}
          />
        ) : null}
        <PkStickerSheet
          open={stickersOpen}
          title={labels.openStickers || 'Sticker'}
          onClose={() => setStickersOpen(false)}
          senderId={me.id}
          roomId={session.roomId}
          onPick={(sticker) => {
            chat.appendMessage({
              id: `sticker_${Date.now()}`,
              user: me.displayName || me.username || 'User',
              userId: me.id,
              text: sticker.label,
              isBurmese: false,
              isStickerEvent: true,
              stickerId: sticker.stickerId,
              stickerAssetUrl: sticker.assetUrl,
              stickerLabel: sticker.label,
            });
            void ingestLiveHostDashboard(session.roomId, { kind: 'comment' }).catch(() => undefined);
          }}
          receiverName={isHost ? rightCreator.name : leftCreator.name}
        />
      </Suspense>
    </div>
  );
}
