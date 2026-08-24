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
import { Room, RoomEvent, Track } from '../../lib/rtc/livekitCompatibilityBoundary';
import { useDB } from '../../lib/useDB';
import { findUserById, resolveUser } from '../../lib/safe';
import { useOptionalI18n } from '../../lib/i18n';
import { SEMANTIC_EN } from '../../lib/i18n/semanticCatalog';
import {
  connectLiveLifecycleSession,
  endLivePk,
  fetchHostDashboardSnapshot,
  fetchLivePkSession,
  ingestLiveHostDashboard,
  leaveLiveRoom,
  type LivePkSessionSnapshot,
} from '../../lib/platformApi';
import { newLifecycleCommandId, newParticipantSessionId } from '../../lib/liveLifecycle';
import { getActiveHostLiveKitRoom } from '../../lib/livekit/hostLiveKitRoom';
import { getAppCameraStream, setAppCameraFacing, type CameraFacingMode } from '../../lib/camera/appCameraOwner';
import { updateLiveKitLocalVideoTrack } from '../../lib/livekit/liveKitVideoPublish';
import { fetchPkLiveKitAuth } from '../../lib/live/pkLiveMedia';
import { resolvePkMediaSurface } from '../../lib/live/pkLiveMediaRef';
import type { PkMediaSurface } from '../../lib/platformApi';
import type { TeamPkSessionOpen } from '../../lib/live/teamPkSession';
import { canAttemptLiveKit, instantRoomOptions } from '../../lib/livekit/liveKitInstant';
import { permanentlyEndHostLive } from '../../lib/live/permanentlyEndHostLive';
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
  TeamPkRoom,
  type TeamPkCommentView,
  type TeamPkCreatorView,
  type TeamPkLabels,
} from './TeamPkRoom';
import { emptyPkCameraPlaceholder, PkUserCamera, type PkAttachableVideoTrack } from './PkUserCamera';
import type { PartyGiftDefinition } from '../../smule-rooms/utils/roomGifts';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';

const PartyGiftPickerPanel = lazy(() =>
  import('../../smule-rooms/components/PartyGiftPickerPanel').then((m) => ({ default: m.PartyGiftPickerPanel })),
);
const LiveBeautySheet = lazy(() =>
  import('../../smule-rooms/components/LiveBeautySheet').then((m) => ({ default: m.LiveBeautySheet })),
);
const PkStickerSheet = lazy(() =>
  import('./PkStickerSheet').then((m) => ({ default: m.PkStickerSheet })),
);

export type { TeamPkSessionOpen } from '../../lib/live/teamPkSession';

function tFallback(key: string, fallback: string, i18n: { t: (k: string) => string } | null) {
  if (!i18n) return fallback;
  const value = i18n.t(key);
  return !value || value === key ? fallback : value;
}

function remainingFromEndsAt(endsAt: string | null | undefined, now = Date.now()) {
  if (!endsAt) return 0;
  const ms = Date.parse(endsAt);
  return Number.isFinite(ms) ? Math.max(0, Math.ceil((ms - now) / 1000)) : 0;
}

function TeamPkRemoteAudio({ track }: { track: MediaStreamTrack }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || track.readyState !== 'live') return;
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      if (el.srcObject === stream) el.srcObject = null;
    };
  }, [track]);
  return <audio ref={ref} autoPlay data-pk-audio-user="remote" />;
}

export function TeamPkSessionContainer({
  session,
  onClose,
}: {
  session: TeamPkSessionOpen;
  onClose: () => void;
}) {
  const db = useDB();
  const me = resolveUser(db.users, db.currentUser);
  const i18n = useOptionalI18n();
  const locale = i18n?.locale ?? 'en';

  const isHostSide = session.hostTeamUserIds.includes(me.id);
  const isOpponentSide = session.opponentTeamUserIds.includes(me.id);
  const isTeamParticipant = isHostSide || isOpponentSide;
  const isPkCaptain = me.id === session.hostUserId || Boolean(session.opponentUserId && me.id === session.opponentUserId);
  const isHost = isPkCaptain;

  const participantSessionIdRef = useRef(newParticipantSessionId(me.id));
  const primaryRoomRef = useRef<Room | null>(null);
  const secondaryRoomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const scoreRef = useRef<PkScoreSnapshot>(
    pkSnapshotFromSession({ roomId: session.roomId, hostUserId: session.hostUserId, opponentUserId: session.opponentUserId }),
  );
  const seenScoreIdsRef = useRef(new Set<string>());
  const scoreRafRef = useRef(0);
  const pendingScoreRef = useRef<PkScoreSnapshot | null>(null);
  const pkVersionRef = useRef<number | undefined>(undefined);
  const closedRef = useRef(false);
  const roomUnbindersRef = useRef<Array<() => void>>([]);

  const [pk, setPk] = useState<LivePkSessionSnapshot | null>(null);
  const [score, setScore] = useState<PkScoreSnapshot>(scoreRef.current);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [viewersLabel, setViewersLabel] = useState('0');
  const [connectionLabel, setConnectionLabel] = useState(() => tFallback('live.pk.connectionStable', 'Stable', i18n));
  const [muted, setMuted] = useState(false);
  const [facing, setFacing] = useState<CameraFacingMode>('user');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState<Record<string, PkAttachableVideoTrack>>({});
  const [remoteAudioTracks, setRemoteAudioTracks] = useState<Record<string, MediaStreamTrack>>({});
  const [isPkEnding, setIsPkEnding] = useState(false);
  const [isLiveEnding, setIsLiveEnding] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [beautyOpen, setBeautyOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [giftBalance, setGiftBalance] = useState(0);
  const [beautyId, setBeautyId] = useState<BeautyPresetId>('none');
  const [selectedGiftReceiverId, setSelectedGiftReceiverId] = useState<string | null>(null);

  const labels: Partial<TeamPkLabels> = useMemo(
    () => ({
      live: tFallback('common.live', SEMANTIC_EN['common.live'] ?? 'LIVE', i18n).toUpperCase(),
      stable: tFallback('live.pk.connectionStable', SEMANTIC_EN['live.pk.connectionStable'] ?? 'Stable', i18n),
      connecting: tFallback('live.pk.connecting', 'Connecting…', i18n),
      host: tFallback('live.host', 'Host', i18n),
      endPk: tFallback('live.pk.end', SEMANTIC_EN['live.pk.end'] ?? 'End PK', i18n),
      ending: tFallback('live.ending', SEMANTIC_EN['live.ending'] ?? 'Ending…', i18n),
      endPkConfirmTitle: tFallback('live.pk.endConfirmTitle', 'End this Team PK battle?', i18n),
      endPkConfirmBody: tFallback('live.pk.team.endConfirmBody', 'The PK ends, but both live rooms continue.', i18n),
      endLive: tFallback('live.endLive', SEMANTIC_EN['live.endLive'] ?? 'End Live', i18n),
      endLiveConfirmTitle: tFallback('live.endLive.confirmTitle', 'End live stream?', i18n),
      endLiveConfirmBody: tFallback('live.pk.team.endLiveBody', 'This closes your live room. The other team can continue live.', i18n),
      cancel: tFallback('common.cancel', SEMANTIC_EN['common.cancel'] ?? 'Cancel', i18n),
      leaveRoom: tFallback('live.pk.leaveRoom', 'Leave Room', i18n),
      saySomething: tFallback('live.pk.saySomething', 'Say something…', i18n),
      sticker: tFallback('common.sticker', 'Sticker', i18n),
      gift: tFallback('live.pk.gift', 'Gift', i18n),
      beauty: tFallback('live.pk.beauty', 'Beauty', i18n),
      muteMicrophone: tFallback('a11y.muteMicrophone', 'Mute microphone', i18n),
      unmuteMicrophone: tFallback('live.pk.unmuteMicrophone', 'Unmute microphone', i18n),
      flipCamera: tFallback('common.flipCamera', 'Flip camera', i18n),
      more: tFallback('live.pk.more', 'More', i18n),
      selectGiftTarget: tFallback('live.pk.team.selectGiftTarget', 'Select gift target', i18n),
    }),
    [i18n, locale, i18n?.generation],
  );

  const chat = usePartyRoomChat({
    roomId: session.roomId,
    enabled: true,
    senderId: me.id,
    senderName: me.displayName || me.username || 'User',
    unifiedMirrorRoomId: null,
    unifiedChatActive: false,
  });
  const comments: TeamPkCommentView[] = useMemo(
    () => chat.messages.slice(-20).map((message) => ({
      id: String(message.id),
      userName: message.user || 'User',
      message: message.text ?? '',
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
    const nextPk = snap.pk;
    if (!nextPk || nextPk.pkType !== 'pk_team') return;
    pkVersionRef.current = nextPk.version;
    setPk(nextPk);
    commitScore(pkSnapshotFromSession({
      roomId: nextPk.roomId,
      hostUserId: nextPk.hostUserId,
      opponentUserId: nextPk.opponentUserId,
      localScore: nextPk.localScore,
      opponentScore: nextPk.opponentScore,
      sequence: nextPk.sequence,
      version: nextPk.version,
    }));
  }, [commitScore, session.roomId]);

  useEffect(() => {
    let cancelled = false;
    const ingestVideo = (identity: string | undefined, track?: PkAttachableVideoTrack | null) => {
      const userId = identity?.trim();
      if (!userId || !track || typeof track.attach !== 'function' || userId === me.id) return;
      setRemoteVideoTracks((prev) => (prev[userId] === track ? prev : { ...prev, [userId]: track }));
    };
    const ingestAudio = (identity: string | undefined, track?: MediaStreamTrack | null) => {
      const userId = identity?.trim();
      if (!userId || !track || userId === me.id) return;
      setRemoteAudioTracks((prev) => (prev[userId] === track ? prev : { ...prev, [userId]: track }));
    };
    const dropVideo = (identity: string | undefined) => {
      const userId = identity?.trim();
      if (!userId) return;
      setRemoteVideoTracks((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };
    const dropAudio = (identity: string | undefined) => {
      const userId = identity?.trim();
      if (!userId) return;
      setRemoteAudioTracks((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };
    const bindRoom = (room: Room, includeRemoteAudio = true) => {
      const onSubscribed = (track: { mediaStreamTrack?: MediaStreamTrack; kind?: Track.Kind }, _pub: unknown, participant: { identity?: string }) => {
        if (track.kind === Track.Kind.Video) ingestVideo(participant.identity, track as PkAttachableVideoTrack);
        else if (track.kind === Track.Kind.Audio && includeRemoteAudio) ingestAudio(participant.identity, track.mediaStreamTrack);
      };
      const onUnsubscribed = (track: { kind?: Track.Kind }, _pub: unknown, participant: { identity?: string }) => {
        if (track.kind === Track.Kind.Video) dropVideo(participant.identity);
        else if (track.kind === Track.Kind.Audio && includeRemoteAudio) dropAudio(participant.identity);
      };
      const onReconnecting = () => setConnectionLabel(tFallback('live.pk.connectionUnstable', 'Reconnecting', i18n));
      const onReconnected = () => setConnectionLabel(tFallback('live.pk.connectionStable', 'Stable', i18n));
      const onDisconnected = () => setConnectionLabel(tFallback('live.pk.connectionUnstable', 'Reconnecting', i18n));
      room.on(RoomEvent.TrackSubscribed, onSubscribed as never);
      room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed as never);
      room.on(RoomEvent.Reconnecting, onReconnecting);
      room.on(RoomEvent.Reconnected, onReconnected);
      room.on(RoomEvent.Disconnected, onDisconnected);
      roomUnbindersRef.current.push(() => {
        room.off(RoomEvent.TrackSubscribed, onSubscribed as never);
        room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed as never);
        room.off(RoomEvent.Reconnecting, onReconnecting);
        room.off(RoomEvent.Reconnected, onReconnected);
        room.off(RoomEvent.Disconnected, onDisconnected);
      });
      room.remoteParticipants.forEach((participant) => {
        participant.videoTrackPublications.forEach((pub) => ingestVideo(participant.identity, pub.track as PkAttachableVideoTrack | null | undefined));
        if (includeRemoteAudio) {
          participant.audioTrackPublications.forEach((pub) => ingestAudio(participant.identity, pub.track?.mediaStreamTrack));
        }
      });
    };

    const connectViewerRoom = async (mediaId: string | null, surface: PkMediaSurface | null) => {
      if (!mediaId || !canAttemptLiveKit()) return null;
      const auth = await fetchPkLiveKitAuth(mediaId, resolvePkMediaSurface(surface, mediaId), 'viewer');
      const room = new Room(instantRoomOptions());
      await room.connect(auth.url, auth.token);
      if (cancelled) { room.disconnect(); return null; }
      bindRoom(room);
      return room;
    };

    async function boot() {
      const role = isTeamParticipant ? (me.id === session.hostUserId ? 'host' : 'guest') : 'viewer';
      await connectLiveLifecycleSession({
        roomId: session.roomId,
        participantSessionId: participantSessionIdRef.current,
        role,
        roomType: 'pk_team',
      }).catch(() => undefined);
      await reloadAuthoritativeSnapshot().catch(() => undefined);

      try {
        if (isTeamParticipant && session.keepHostMedia) {
          const existing = getActiveHostLiveKitRoom();
          const stream = getAppCameraStream();
          if (existing) {
            primaryRoomRef.current = existing;
            registerLiveKitRoom(session.roomId, existing);
            bindRoom(existing, false);
          }
          if (stream) {
            localStreamRef.current = stream;
            setLocalStream(stream);
          }
          const otherMediaId = isHostSide ? session.opponentMediaId : session.hostMediaId;
          const otherSurface = isHostSide ? session.opponentMediaSurface : session.hostMediaSurface;
          secondaryRoomRef.current = await connectViewerRoom(otherMediaId, otherSurface);
        } else if (!isTeamParticipant) {
          primaryRoomRef.current = await connectViewerRoom(session.hostMediaId, session.hostMediaSurface);
          if (primaryRoomRef.current) registerLiveKitRoom(session.roomId, primaryRoomRef.current);
          secondaryRoomRef.current = await connectViewerRoom(session.opponentMediaId, session.opponentMediaSurface);
        } else {
          // Participant fallback when the normal live room is not already registered in this tab.
          const ownMediaId = isHostSide ? session.hostMediaId : session.opponentMediaId;
          const ownSurface = isHostSide ? session.hostMediaSurface : session.opponentMediaSurface;
          if (ownMediaId) {
            const auth = await fetchPkLiveKitAuth(ownMediaId, resolvePkMediaSurface(ownSurface, ownMediaId), 'host');
            const room = new Room(instantRoomOptions());
            await room.connect(auth.url, auth.token);
            if (cancelled) { room.disconnect(); return; }
            primaryRoomRef.current = room;
            bindRoom(room);
            registerLiveKitRoom(session.roomId, room);
            const stream = getAppCameraStream();
            if (stream) {
              localStreamRef.current = stream;
              setLocalStream(stream);
            }
          }
          const otherMediaId = isHostSide ? session.opponentMediaId : session.hostMediaId;
          const otherSurface = isHostSide ? session.opponentMediaSurface : session.hostMediaSurface;
          secondaryRoomRef.current = await connectViewerRoom(otherMediaId, otherSurface);
        }
        if (!cancelled) setConnectionLabel(tFallback('live.pk.connectionStable', 'Stable', i18n));
      } catch {
        if (!cancelled) setConnectionLabel(tFallback('live.pk.connectionUnstable', 'Reconnecting', i18n));
      }
    }

    void boot();
    return () => {
      cancelled = true;
      roomUnbindersRef.current.splice(0).forEach((unbind) => unbind());
      setRemoteVideoTracks({});
      setRemoteAudioTracks({});
      if (primaryRoomRef.current && (!session.keepHostMedia || !isTeamParticipant)) {
        unregisterLiveKitRoom(session.roomId, primaryRoomRef.current);
        primaryRoomRef.current.disconnect();
      }
      secondaryRoomRef.current?.disconnect();
      secondaryRoomRef.current = null;
      if (!session.keepHostMedia || !isTeamParticipant) primaryRoomRef.current = null;
    };
  }, [
    i18n,
    isHostSide,
    isTeamParticipant,
    me.id,
    reloadAuthoritativeSnapshot,
    session.hostMediaId,
    session.hostMediaSurface,
    session.hostUserId,
    session.keepHostMedia,
    session.opponentMediaId,
    session.opponentMediaSurface,
    session.roomId,
  ]);

  useEffect(() => subscribeLiveRoomEvents(session.roomId, (event) => {
    if (event.type !== 'pk') return;
    const payload = event.payload as Partial<PkRealtimeScoreEvent> & { action?: string };
    if (
      typeof payload.eventId !== 'string' ||
      typeof payload.sequence !== 'number' ||
      typeof payload.previousSequence !== 'number' ||
      typeof payload.localScore !== 'number' ||
      typeof payload.opponentScore !== 'number'
    ) {
      if (payload.action === 'score' || payload.action === 'sync') void reloadAuthoritativeSnapshot();
      return;
    }
    const applied = applyPkScoreEvent(scoreRef.current, {
      eventId: payload.eventId,
      roomId: event.roomId,
      sequence: payload.sequence,
      previousSequence: payload.previousSequence,
      hostUserId: payload.hostUserId || session.hostUserId,
      opponentUserId: payload.opponentUserId ?? session.opponentUserId,
      localScore: payload.localScore,
      opponentScore: payload.opponentScore,
      version: payload.version,
    }, seenScoreIdsRef.current);
    if (!applied.ok && applied.reason === 'gap') {
      void reloadAuthoritativeSnapshot();
      return;
    }
    if (applied.ok && !applied.duplicate) {
      commitScore(applied.snapshot);
      // Member-level score/gift counts are snapshot-authoritative.
      void reloadAuthoritativeSnapshot();
    }
  }), [commitScore, reloadAuthoritativeSnapshot, session.hostUserId, session.opponentUserId, session.roomId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [dash] = await Promise.all([
          fetchHostDashboardSnapshot(session.roomId),
          reloadAuthoritativeSnapshot(),
        ]);
        if (cancelled) return;
        setViewersLabel(String(dash.snapshot.audience.currentUniqueViewers || dash.snapshot.audience.currentConnections || 0));
      } catch { /* retain last snapshot */ }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [reloadAuthoritativeSnapshot, session.roomId]);

  useEffect(() => {
    const tick = () => setRemainingSeconds(remainingFromEndsAt(pk?.endsAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pk?.endsAt]);

  useEffect(() => {
    if (!pk || !['ended', 'cancelled', 'expired'].includes(pk.status)) return;
    const id = window.setTimeout(onClose, 50);
    return () => window.clearTimeout(id);
  }, [onClose, pk]);

  useEffect(() => () => {
    if (scoreRafRef.current) window.cancelAnimationFrame(scoreRafRef.current);
  }, []);

  const cleanupOverlayMedia = useCallback((endLive = false) => {
    roomUnbindersRef.current.splice(0).forEach((unbind) => unbind());
    secondaryRoomRef.current?.disconnect();
    secondaryRoomRef.current = null;
    if (!session.keepHostMedia || !isTeamParticipant || endLive) {
      if (primaryRoomRef.current) unregisterLiveKitRoom(session.roomId, primaryRoomRef.current);
      primaryRoomRef.current?.disconnect();
      primaryRoomRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
  }, [isTeamParticipant, session.keepHostMedia, session.roomId]);

  const ownLifecycleRoomId = isOpponentSide && session.opponentRoomId ? session.opponentRoomId : session.roomId;
  const ownMediaId = isOpponentSide ? session.opponentMediaId : session.hostMediaId;
  const ownMediaSurface = isOpponentSide ? session.opponentMediaSurface : session.hostMediaSurface;

  const onLeaveRoom = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    void leaveLiveRoom(isTeamParticipant ? ownLifecycleRoomId : session.roomId, {
      commandId: newLifecycleCommandId('leave'),
      participantSessionId: participantSessionIdRef.current,
      reason: 'user_selected_leave',
      roomType: 'pk_team',
      role: isTeamParticipant ? (me.id === session.hostUserId ? 'host' : 'guest') : 'viewer',
    }).catch(() => undefined);
    cleanupOverlayMedia();
    onClose();
  }, [cleanupOverlayMedia, isTeamParticipant, me.id, onClose, ownLifecycleRoomId, session.hostUserId, session.roomId]);

  const onEndPk = useCallback(async () => {
    if (!isHost) return;
    setIsPkEnding(true);
    try {
      await endLivePk(session.roomId, {
        commandId: newLifecycleCommandId('team-pk-end'),
      });
      await reloadAuthoritativeSnapshot().catch(() => undefined);
      cleanupOverlayMedia();
      onClose();
    } finally {
      setIsPkEnding(false);
    }
  }, [cleanupOverlayMedia, isHost, onClose, reloadAuthoritativeSnapshot, session.roomId]);

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
        roomType: 'pk_team',
        extraRoomIds: me.id === session.hostUserId ? [session.roomId] : [],
        streamIds: ownMediaSurface === 'stream' ? [ownMediaId] : [],
      });
      cleanupOverlayMedia(true);
      onClose();
    } finally {
      setIsLiveEnding(false);
    }
  }, [cleanupOverlayMedia, isHost, me.id, onClose, ownLifecycleRoomId, ownMediaId, ownMediaSurface, session.hostUserId, session.roomId]);

  useEffect(() => {
    if (!isHost || !pk?.endsAt) return;
    if (['ended', 'cancelled', 'expired'].includes(pk.status)) return;
    const tryEnd = () => {
      if (remainingFromEndsAt(pk.endsAt) > 0) return;
      void onEndPk();
    };
    tryEnd();
    const id = window.setInterval(tryEnd, 1000);
    return () => window.clearInterval(id);
  }, [isHost, onEndPk, pk]);

  const onSendComment = useCallback(async (message: string, clientId: string) => {
    chat.appendMessage({ id: clientId, user: me.displayName || me.username || 'User', userId: me.id, text: message, isBurmese: false });
    void ingestLiveHostDashboard(session.roomId, { kind: 'comment' }).catch(() => undefined);
  }, [chat, me.displayName, me.id, me.username, session.roomId]);

  const onToggleMicrophone = useCallback(() => {
    if (!isTeamParticipant) return;
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    void (primaryRoomRef.current || getActiveHostLiveKitRoom())?.localParticipant.setMicrophoneEnabled(!next).catch(() => undefined);
  }, [isTeamParticipant, muted]);

  const onFlipCamera = useCallback(async () => {
    if (!isTeamParticipant) return;
    const next: CameraFacingMode = facing === 'user' ? 'environment' : 'user';
    try {
      const stream = await setAppCameraFacing(next);
      if (!stream) return;
      setFacing(next);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const video = stream.getVideoTracks().find((track) => track.readyState === 'live');
      const room = primaryRoomRef.current || getActiveHostLiveKitRoom();
      if (room && video) await updateLiveKitLocalVideoTrack(room.localParticipant, video);
    } catch { /* keep current camera */ }
  }, [facing, isTeamParticipant]);

  const hostTeamIds = pk?.hostTeamUserIds?.length ? pk.hostTeamUserIds : session.hostTeamUserIds;
  const opponentTeamIds = pk?.opponentTeamUserIds?.length ? pk.opponentTeamUserIds : session.opponentTeamUserIds;

  const creatorFor = useCallback((userId: string, captainId: string): TeamPkCreatorView => {
    const user = resolveUser(db.users, findUserById(db.users, userId), me);
    return {
      id: userId,
      name: user.displayName || user.username || (userId === captainId ? 'Host' : 'Team member'),
      avatarUrl: user.avatarUrl || undefined,
      verified: true,
      isCaptain: userId === captainId,
      score: pk?.memberScores?.[userId] ?? 0,
      giftCount: pk?.memberGiftCounts?.[userId] ?? 0,
    };
  }, [db.users, me, pk?.memberGiftCounts, pk?.memberScores]);

  const hostTeam = useMemo(
    () => hostTeamIds.slice(0, session.teamSize).map((id) => creatorFor(id, session.hostUserId)),
    [creatorFor, hostTeamIds, session.hostUserId, session.teamSize],
  );
  const opponentTeam = useMemo(
    () => opponentTeamIds.slice(0, session.teamSize).map((id) => creatorFor(id, session.opponentUserId || '')),
    [creatorFor, opponentTeamIds, session.opponentUserId, session.teamSize],
  );

  useEffect(() => {
    const opposing = isHostSide ? opponentTeamIds : isOpponentSide ? hostTeamIds : hostTeamIds;
    if (!selectedGiftReceiverId || ![...hostTeamIds, ...opponentTeamIds].includes(selectedGiftReceiverId)) {
      setSelectedGiftReceiverId(opposing[0] || session.hostUserId);
    }
  }, [hostTeamIds, isHostSide, isOpponentSide, opponentTeamIds, selectedGiftReceiverId, session.hostUserId]);

  const cameraFor = useCallback((creator: TeamPkCreatorView): ReactNode => {
    if (localStream && me.id === creator.id) {
      return <PkUserCamera userId={creator.id} mediaStream={localStream} muted mirror={facing === 'user'} />;
    }
    const track = remoteVideoTracks[creator.id];
    if (track) return <PkUserCamera userId={creator.id} liveKitTrack={track} muted />;
    return emptyPkCameraPlaceholder(creator.name);
  }, [facing, localStream, me.id, remoteVideoTracks]);

  const cameras = useMemo(() => {
    const output: Record<string, ReactNode> = {};
    for (const creator of [...hostTeam, ...opponentTeam]) output[creator.id] = cameraFor(creator);
    return output;
  }, [cameraFor, hostTeam, opponentTeam]);

  const onOpenGifts = useCallback(() => {
    void import('../../lib/walletKstarSync')
      .then((m) => setGiftBalance(m.getLiveCoinsBalance(me.id)))
      .catch(() => setGiftBalance(0));
    setGiftsOpen(true);
  }, [me.id]);

  const giftReceiver = selectedGiftReceiverId || (isHostSide ? opponentTeamIds[0] : hostTeamIds[0]) || session.hostUserId;
  const giftReceiverCreator = [...hostTeam, ...opponentTeam].find((creator) => creator.id === giftReceiver);

  const onSendGift = useCallback((gift: PartyGiftDefinition, quantity = 1) => {
    const receiverId = giftReceiver;
    if (!receiverId || receiverId === me.id) return;
    void import('../../lib/partyGiftPayments')
      .then((m) => m.settlePartyGiftSend(me.id, receiverId, gift.stars * Math.max(1, quantity), {
        giftId: gift.id || `gift_${gift.stars}`,
        giftName: gift.name,
        roomId: session.roomId,
        quantity,
        clientRequestId: newLifecycleCommandId('team-gift'),
      }))
      .then(() => reloadAuthoritativeSnapshot())
      .catch(() => undefined);
  }, [giftReceiver, me.id, reloadAuthoritativeSnapshot, session.roomId]);

  return (
    <div className="utpk-overlay-root" data-ui-id="live.pk.team.overlay">
      <TeamPkRoom
        roomId={session.roomId}
        hostTeam={hostTeam}
        opponentTeam={opponentTeam}
        declaredTeamSize={session.teamSize}
        cameras={cameras}
        hostTeamScore={score.localScore}
        opponentTeamScore={score.opponentScore}
        remainingSeconds={remainingSeconds}
        multiplier={pk?.multiplier || 1}
        viewersLabel={viewersLabel}
        connectionLabel={connectionLabel}
        comments={comments}
        isHost={isHost}
        isPkEnding={isPkEnding}
        isLiveEnding={isLiveEnding}
        muted={muted}
        selectedGiftReceiverId={selectedGiftReceiverId}
        labels={labels}
        locale={locale}
        onLeaveRoom={onLeaveRoom}
        onEndPk={onEndPk}
        onEndLive={onEndLive}
        onSendComment={onSendComment}
        onOpenStickers={() => setStickersOpen(true)}
        onOpenGifts={onOpenGifts}
        onOpenBeauty={() => setBeautyOpen(true)}
        onToggleMicrophone={onToggleMicrophone}
        onFlipCamera={() => void onFlipCamera()}
        onSelectGiftReceiver={(userId) => {
          // Only allow sending to the opposite team for team participants. Viewers may select either side.
          if (isHostSide && !opponentTeamIds.includes(userId)) return;
          if (isOpponentSide && !hostTeamIds.includes(userId)) return;
          setSelectedGiftReceiverId(userId);
        }}
      />
      {Object.entries(remoteAudioTracks).map(([userId, track]) => (
        <TeamPkRemoteAudio key={`${userId}:${track.id}`} track={track} />
      ))}
      <Suspense fallback={null}>
        {giftsOpen ? (
          <PartyGiftPickerPanel
            open={giftsOpen}
            onClose={() => setGiftsOpen(false)}
            receiverName={giftReceiverCreator?.name || 'Host'}
            balance={giftBalance}
            roomTotalStars={score.localScore + score.opponentScore}
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
          title={labels.sticker || 'Sticker'}
          onClose={() => setStickersOpen(false)}
          senderId={me.id}
          roomId={session.roomId}
          onPick={(sticker) => {
            chat.appendMessage({
              id: `team-sticker-${Date.now()}`,
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
        />
      </Suspense>
    </div>
  );
}
