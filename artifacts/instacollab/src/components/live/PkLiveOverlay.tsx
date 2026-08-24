import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDB } from '../../lib/useDB';
import { findUserById, resolveUser } from '../../lib/safe';
import { useOptionalI18n } from '../../lib/i18n';
import { SEMANTIC_EN } from '../../lib/i18n/semanticCatalog';
import { usePkChallengeInbox } from '../../hooks/usePkChallengeInbox';
import {
  acceptPkChallenge,
  declinePkChallenge,
  expirePkChallenge,
  fetchHostDashboardSnapshot,
  ingestLiveHostDashboard,
  leaveLiveRoom,
  type LivePkSessionSnapshot,
} from '../../lib/platformApi';
import { newLifecycleCommandId, newParticipantSessionId } from '../../lib/liveLifecycle';
import { permanentlyEndHostLive } from '../../lib/live/permanentlyEndHostLive';
import {
  getAppCameraStream,
  setAppCameraFacing,
  type CameraFacingMode,
} from '../../lib/camera/appCameraOwner';
import { getActiveHostLiveKitRoom } from '../../lib/livekit/hostLiveKitRoom';
import { updateLiveKitLocalVideoTrack } from '../../lib/livekit/liveKitVideoPublish';
import { isPkLocalSessionOpen } from '../../lib/live/pkSessionGate';
import {
  logProductionPkRoute,
  setProductionPkActiveId,
  setProductionPkChallengePending,
  setProductionPkOverlayMounted,
} from '../../lib/live/productionOneVsOnePkGate';
import { usePartyRoomChat } from '../../smule-rooms/hooks/usePartyRoomChat';
import {
  PkChallengeLiveStage,
  type PkChallengeLabels,
} from './PkChallengeLiveStage';
import type { OneVsOnePkSessionOpen } from './OneVsOnePkSessionContainer';
import { teamPkSessionFromSnapshot, type TeamPkSessionOpen } from '../../lib/live/teamPkSession';
import { getTeamPkRoomUserIds } from '../../lib/live/teamPkRosterRegistry';
import { resolvePkMediaId, resolvePkMediaSurface } from '../../lib/live/pkLiveMediaRef';
import { resolveDeclaredTeamPkSize } from '../../lib/live/pkTeamTopology';
import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import type { PartyGiftDefinition } from '../../smule-rooms/utils/roomGifts';

const OneVsOnePkSessionContainer = lazy(() =>
  import('./OneVsOnePkSessionContainer').then((m) => ({ default: m.OneVsOnePkSessionContainer })),
);
const TeamPkSessionContainer = lazy(() =>
  import('./TeamPkSessionContainer').then((m) => ({ default: m.TeamPkSessionContainer })),
);
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

function tFallback(key: string, fallback: string, i18n: { t: (k: string) => string } | null) {
  if (!i18n) return fallback;
  const value = i18n.t(key);
  return !value || value === key ? fallback : value;
}

function sessionFromPk(
  pk: LivePkSessionSnapshot,
  meId: string,
  names: { hostName: string; opponentName?: string; hostAvatarUrl?: string; opponentAvatarUrl?: string },
): OneVsOnePkSessionOpen {
  const iAmHost = meId === pk.hostUserId;
  const iAmOpponent = meId === pk.opponentUserId;
  const hostMediaId = resolvePkMediaId(pk.hostMediaId, pk.roomId);
  const opponentMediaId = resolvePkMediaId(pk.opponentMediaId, pk.opponentRoomId);
  const hostSurface = resolvePkMediaSurface(pk.hostMediaSurface, pk.roomId);
  const opponentSurface = resolvePkMediaSurface(pk.opponentMediaSurface, pk.opponentRoomId);
  return {
    roomId: pk.roomId,
    streamId: iAmOpponent ? opponentMediaId || hostMediaId : hostMediaId,
    mediaSurface: iAmOpponent ? opponentSurface : hostSurface,
    opponentStreamId: iAmOpponent ? hostMediaId : opponentMediaId || null,
    opponentMediaSurface: iAmOpponent ? hostSurface : opponentSurface,
    ownStreamId: iAmOpponent ? opponentMediaId || undefined : hostMediaId,
    isHost: iAmHost || iAmOpponent,
    hostUserId: pk.hostUserId,
    opponentUserId: pk.opponentUserId,
    hostName: names.hostName,
    opponentName: names.opponentName,
    hostAvatarUrl: names.hostAvatarUrl,
    opponentAvatarUrl: names.opponentAvatarUrl,
    keepHostMedia: true,
    skipStartPk: true,
    liveSell: Boolean(pk.liveSell),
    opponentRoomId: pk.opponentRoomId,
  };
}

function LiveCameraNode({ facing }: { facing: CameraFacingMode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    const stream = getAppCameraStream();
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [facing]);
  return <video ref={videoRef} autoPlay playsInline muted />;
}

export function PkLiveOverlay() {
  const db = useDB();
  const me = resolveUser(db.users, db.currentUser);
  const i18n = useOptionalI18n();
  const locale = i18n?.locale ?? 'en';
  const enabled = Boolean(me.id && me.id !== 'unknown');
  const { inbox, refresh } = usePkChallengeInbox(enabled, 2000);
  const [dismissedChallengeId, setDismissedChallengeId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isLiveEnding, setIsLiveEnding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [facing, setFacing] = useState<CameraFacingMode>('user');
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [beautyOpen, setBeautyOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [giftBalance, setGiftBalance] = useState(0);
  const [beautyId, setBeautyId] = useState<BeautyPresetId>('none');
  const [acceptedSession, setAcceptedSession] = useState<OneVsOnePkSessionOpen | null>(null);
  const [acceptedTeamSession, setAcceptedTeamSession] = useState<TeamPkSessionOpen | null>(null);
  const [viewersLabel, setViewersLabel] = useState('0');
  /** True after inbox has reported a live PK — used to tear down local session on remote end. */
  const sawActivePkRef = useRef(false);

  const incoming =
    inbox.incoming && inbox.incoming.id !== dismissedChallengeId ? inbox.incoming : null;
  const activePk = inbox.activePk;
  const outgoing = inbox.outgoing;
  const activePkParticipant = Boolean(
    activePk &&
      (me.id === activePk.hostUserId ||
        me.id === activePk.opponentUserId ||
        activePk.hostTeamUserIds?.includes(me.id) ||
        activePk.opponentTeamUserIds?.includes(me.id)),
  );
  const overlayVisible = Boolean(
    acceptedSession || acceptedTeamSession || incoming || (activePk && activePkParticipant),
  );

  // Keep gate in sync while mounted. Do NOT clear overlayMounted on dep changes —
  // that briefly allowed Room to re-show PKBattleStage between renders.
  useEffect(() => {
    const pending = Boolean(incoming || outgoing);
    setProductionPkChallengePending(pending);
    const pkId =
      activePk && activePk.status !== 'ended'
        ? activePk.id
        : acceptedSession
          ? `local:${acceptedSession.roomId}`
          : acceptedTeamSession
            ? `local-team:${acceptedTeamSession.roomId}`
            : null;
    setProductionPkActiveId(pkId);
    setProductionPkOverlayMounted(overlayVisible);
    logProductionPkRoute({
      challengeId: incoming?.id || outgoing?.id || null,
      activePkId: activePk?.id ?? null,
      activePkType: activePk?.pkType ?? null,
      activePkStatus: activePk?.status ?? null,
      activePkRoomId: activePk?.roomId ?? null,
      opponentRoomId: activePk?.opponentRoomId ?? null,
      currentUserId: me.id,
      pkOverlayMounted: overlayVisible,
      acceptedSession: Boolean(acceptedSession),
      acceptedTeamSession: Boolean(acceptedTeamSession),
    });
  }, [
    acceptedSession,
    acceptedTeamSession,
    activePk,
    incoming,
    me.id,
    outgoing,
    overlayVisible,
  ]);

  useEffect(() => {
    return () => {
      setProductionPkOverlayMounted(false);
    };
  }, []);

  const challenger = incoming
    ? resolveUser(db.users, findUserById(db.users, incoming.challengerUserId), me)
    : null;
  const hostUser = activePk
    ? resolveUser(db.users, findUserById(db.users, activePk.hostUserId), me)
    : me;
  const opponentUser = activePk?.opponentUserId
    ? resolveUser(db.users, findUserById(db.users, activePk.opponentUserId), me)
    : null;

  const chatRoomId = incoming?.hostRoomId || activePk?.roomId || '';
  const chat = usePartyRoomChat({
    roomId: chatRoomId || 'pk-challenge-idle',
    enabled: Boolean(incoming && chatRoomId),
    senderId: me.id,
    senderName: me.displayName || me.username || 'User',
    unifiedMirrorRoomId: null,
    unifiedChatActive: false,
  });

  const labels: Partial<PkChallengeLabels> = useMemo(
    () => ({
      live: tFallback('common.live', SEMANTIC_EN['common.live'] ?? 'LIVE', i18n).toUpperCase(),
      stable: tFallback('live.pk.connectionStable', SEMANTIC_EN['live.pk.connectionStable'] ?? 'Stable', i18n),
      challengeTitle: tFallback('live.pk.challenge.title', SEMANTIC_EN['live.pk.challenge.title'] ?? 'PK Challenge', i18n),
      challengingYou: tFallback(
        'live.pk.challenge.challengingYou',
        SEMANTIC_EN['live.pk.challenge.challengingYou'] ?? 'is challenging you',
        i18n,
      ),
      mutualHosts: tFallback('live.pk.challenge.mutualHosts', SEMANTIC_EN['live.pk.challenge.mutualHosts'] ?? 'Mutual hosts', i18n),
      videoPk: tFallback('live.pk.challenge.videoPk', SEMANTIC_EN['live.pk.challenge.videoPk'] ?? 'Video PK', i18n),
      roundDuration: tFallback('live.pk.challenge.roundDuration', SEMANTIC_EN['live.pk.challenge.roundDuration'] ?? 'Round', i18n),
      stableConnection: tFallback(
        'live.pk.challenge.stableConnection',
        SEMANTIC_EN['live.pk.challenge.stableConnection'] ?? 'Stable connection',
        i18n,
      ),
      respondIn: tFallback('live.pk.challenge.respondIn', SEMANTIC_EN['live.pk.challenge.respondIn'] ?? 'Respond in', i18n),
      acceptPk: tFallback('live.pk.challenge.accept', SEMANTIC_EN['live.pk.challenge.accept'] ?? 'Accept PK', i18n),
      accepting: tFallback('live.pk.challenge.accepting', SEMANTIC_EN['live.pk.challenge.accepting'] ?? 'Accepting…', i18n),
      decline: tFallback('live.pk.challenge.decline', SEMANTIC_EN['live.pk.challenge.decline'] ?? 'Decline', i18n),
      declining: tFallback('live.pk.challenge.declining', SEMANTIC_EN['live.pk.challenge.declining'] ?? 'Declining…', i18n),
      liveContinues: tFallback(
        'live.pk.challenge.liveContinues',
        SEMANTIC_EN['live.pk.challenge.liveContinues'] ?? 'Your live continues if you decline',
        i18n,
      ),
      saySomething: tFallback('live.pk.saySomething', SEMANTIC_EN['live.pk.saySomething'] ?? 'Say something…', i18n),
      sticker: tFallback('common.sticker', SEMANTIC_EN['common.sticker'] ?? 'Sticker', i18n),
      gift: tFallback('live.pk.gift', SEMANTIC_EN['live.pk.gift'] ?? 'Gift', i18n),
      beauty: tFallback('live.pk.beauty', SEMANTIC_EN['live.pk.beauty'] ?? 'Beauty', i18n),
      muteMicrophone: tFallback('a11y.muteMicrophone', SEMANTIC_EN['a11y.muteMicrophone'] ?? 'Mute microphone', i18n),
      unmuteMicrophone: tFallback('live.pk.unmuteMicrophone', SEMANTIC_EN['live.pk.unmuteMicrophone'] ?? 'Unmute microphone', i18n),
      flipCamera: tFallback('common.flipCamera', SEMANTIC_EN['common.flipCamera'] ?? 'Flip camera', i18n),
      more: tFallback('live.pk.more', SEMANTIC_EN['live.pk.more'] ?? 'More', i18n),
      leaveRoom: tFallback('live.pk.leaveRoom', SEMANTIC_EN['live.pk.leaveRoom'] ?? 'Leave Room', i18n),
      endLive: tFallback('live.endLive', SEMANTIC_EN['live.endLive'] ?? 'End Live', i18n),
      endLiveTitle: tFallback('live.endLive.confirmTitle', SEMANTIC_EN['live.endLive.confirmTitle'] ?? 'End live stream?', i18n),
      endLiveBody: tFallback(
        'live.endLive.confirmBody',
        SEMANTIC_EN['live.endLive.confirmBody'] ?? 'This closes the room for the host and every viewer.',
        i18n,
      ),
      cancel: tFallback('common.cancel', SEMANTIC_EN['common.cancel'] ?? 'Cancel', i18n),
      ending: tFallback('live.ending', SEMANTIC_EN['live.ending'] ?? 'Ending…', i18n),
    }),
    [i18n, locale, i18n?.generation],
  );

  useEffect(() => {
    if (!incoming) return;
    let cancelled = false;
    void fetchHostDashboardSnapshot(incoming.hostRoomId)
      .then((dash) => {
        if (cancelled) return;
        const viewers =
          dash.snapshot.audience.currentUniqueViewers || dash.snapshot.audience.currentConnections || 0;
        setViewersLabel(String(viewers));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [incoming]);

  useEffect(() => {
    if (!activePk) return;
    if (isPkLocalSessionOpen(activePk.roomId) || isPkLocalSessionOpen(activePk.opponentRoomId)) return;
    const iAmParticipant =
      me.id === activePk.hostUserId ||
      me.id === activePk.opponentUserId ||
      activePk.hostTeamUserIds?.includes(me.id) ||
      activePk.opponentTeamUserIds?.includes(me.id);
    if (!iAmParticipant) return;
    if (activePk.pkType === 'pk_team') {
      setAcceptedSession(null);
      setAcceptedTeamSession((prev) =>
        prev?.roomId === activePk.roomId ? prev : teamPkSessionFromSnapshot(activePk),
      );
      return;
    }
    setAcceptedTeamSession(null);
    setAcceptedSession((prev) => {
      if (prev?.roomId === activePk.roomId && prev.opponentUserId === activePk.opponentUserId) return prev;
      return sessionFromPk(activePk, me.id, {
        hostName: hostUser.displayName || hostUser.username || 'Host',
        opponentName: opponentUser?.displayName || opponentUser?.username,
        hostAvatarUrl: hostUser.avatarUrl,
        opponentAvatarUrl: opponentUser?.avatarUrl,
      });
    });
  }, [activePk, hostUser, me.id, opponentUser]);

  // When the host ends PK, inbox.activePk becomes null for both sides.
  // Challenger keeps a local acceptedSession until we explicitly clear it.
  useEffect(() => {
    if (
      activePk &&
      (activePk.status === 'active' ||
        activePk.status === 'countdown' ||
        activePk.status === 'accepted')
    ) {
      sawActivePkRef.current = true;
      return;
    }
    if (!sawActivePkRef.current) return;
    if (activePk) return;
    sawActivePkRef.current = false;
    setAcceptedSession(null);
    setAcceptedTeamSession(null);
    setProductionPkActiveId(null);
    setProductionPkOverlayMounted(false);
    setProductionPkChallengePending(false);
  }, [activePk]);

  const onAcceptPk = useCallback(async () => {
    if (!incoming) return;
    setIsAccepting(true);
    try {
      const expectedTeamSize: 2 | 3 | 4 | 6 = resolveDeclaredTeamPkSize(
        incoming.teamSize,
        incoming.challengerTeamUserIds?.length ?? 0,
        0,
      );
      const teamUserIds =
        incoming.pkType === 'pk_team'
          ? getTeamPkRoomUserIds(incoming.hostRoomId, me.id, expectedTeamSize)
          : [];
      if (incoming.pkType === 'pk_team' && teamUserIds.length < 1) {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: 'Could not accept Team PK.',
        }));
        return;
      }
      const result = await acceptPkChallenge(
        incoming.id,
        incoming.pkType === 'pk_team' ? { teamUserIds } : {},
      );
      setProductionPkChallengePending(false);
      setProductionPkActiveId(result.pk.id);
      if (result.pk.pkType === 'pk_team') {
        setAcceptedSession(null);
        setAcceptedTeamSession(teamPkSessionFromSnapshot(result.pk));
      } else {
        setAcceptedTeamSession(null);
        setAcceptedSession(
          sessionFromPk(result.pk, me.id, {
            hostName: me.displayName || me.username || 'Host',
            opponentName: challenger?.displayName || challenger?.username,
            hostAvatarUrl: me.avatarUrl,
            opponentAvatarUrl: challenger?.avatarUrl,
          }),
        );
      }
      setDismissedChallengeId(incoming.id);
      logProductionPkRoute({
        event: 'acceptPkChallenge',
        pkId: result.pk.id,
        pkType: result.pk.pkType,
        hostUserId: result.pk.hostUserId,
        opponentUserId: result.pk.opponentUserId,
      });
      void refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: incoming.pkType === 'pk_team'
          ? (message && !message.includes('fetch') ? message : 'Could not accept Team PK.')
          : 'Could not accept PK challenge.',
      }));
    } finally {
      setIsAccepting(false);
    }
  }, [challenger, incoming, me.avatarUrl, me.displayName, me.id, me.username, refresh]);

  const onDeclinePk = useCallback(async () => {
    if (!incoming) return;
    setIsDeclining(true);
    try {
      await declinePkChallenge(incoming.id);
      setDismissedChallengeId(incoming.id);
      setProductionPkChallengePending(false);
      void refresh();
    } finally {
      setIsDeclining(false);
    }
  }, [incoming, refresh]);

  const onChallengeExpired = useCallback(async () => {
    if (!incoming) return;
    try {
      await expirePkChallenge(incoming.id);
    } catch {
      /* already expired server-side */
    }
    setDismissedChallengeId(incoming.id);
    setProductionPkChallengePending(false);
    void refresh();
  }, [incoming, refresh]);

  const onLeaveRoom = useCallback(() => {
    if (!incoming) return;
    void leaveLiveRoom(incoming.hostRoomId, {
      commandId: newLifecycleCommandId('leave'),
      participantSessionId: newParticipantSessionId(me.id),
      reason: 'user_selected_leave',
    }).catch(() => undefined);
    setDismissedChallengeId(incoming.id);
  }, [incoming, me.id]);

  const onEndLive = useCallback(async () => {
    if (!incoming) return;
    setIsLiveEnding(true);
    try {
      let roomVersion = 1;
      try {
        const dash = await fetchHostDashboardSnapshot(incoming.hostRoomId);
        roomVersion = dash.snapshot.roomVersion || 1;
      } catch {
        /* API remaps a mismatched version */
      }
      await permanentlyEndHostLive({
        roomId: incoming.hostRoomId,
        hostUserId: me.id,
        expectedRoomVersion: roomVersion,
      });
      setDismissedChallengeId(incoming.id);
    } finally {
      setIsLiveEnding(false);
    }
  }, [incoming, me.id]);

  const onSendComment = useCallback(
    async (message: string, clientId: string) => {
      if (!incoming) return;
      chat.appendMessage({
        id: clientId,
        user: me.displayName || me.username || 'User',
        userId: me.id,
        text: message,
        isBurmese: false,
      });
      void ingestLiveHostDashboard(incoming.hostRoomId, { kind: 'comment' }).catch(() => undefined);
    },
    [chat, incoming, me.displayName, me.id, me.username],
  );

  const onToggleMicrophone = useCallback(() => {
    const next = !muted;
    setMuted(next);
    getAppCameraStream()?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    void getActiveHostLiveKitRoom()?.localParticipant.setMicrophoneEnabled(!next).catch(() => undefined);
  }, [muted]);

  const onFlipCamera = useCallback(async () => {
    const next: CameraFacingMode = facing === 'user' ? 'environment' : 'user';
    try {
      const stream = await setAppCameraFacing(next);
      if (!stream) return;
      setFacing(next);
      const video = stream.getVideoTracks().find((track) => track.readyState === 'live');
      const room = getActiveHostLiveKitRoom();
      if (room && video) await updateLiveKitLocalVideoTrack(room.localParticipant, video);
    } catch {
      /* keep current facing */
    }
  }, [facing]);

  const onSendGift = useCallback(
    (gift: PartyGiftDefinition, quantity = 1) => {
      if (!incoming) return;
      void import('../../lib/partyGiftPayments')
        .then((m) =>
          m.settlePartyGiftSend(me.id, incoming.challengerUserId, gift.stars * Math.max(1, quantity), {
            giftId: gift.id || `gift_${gift.stars}`,
            giftName: gift.name,
            roomId: incoming.hostRoomId,
            quantity,
            clientRequestId: newLifecycleCommandId('gift'),
          }),
        )
        .catch(() => undefined);
    },
    [incoming, me.id],
  );

  if (acceptedTeamSession) {
    return (
      <Suspense fallback={null}>
        <TeamPkSessionContainer
          session={acceptedTeamSession}
          onClose={() => {
            setAcceptedTeamSession(null);
            setProductionPkActiveId(null);
            setProductionPkOverlayMounted(false);
          }}
        />
      </Suspense>
    );
  }

  if (acceptedSession) {
    return (
      <Suspense fallback={null}>
        <OneVsOnePkSessionContainer
          session={acceptedSession}
          onClose={() => {
            setAcceptedSession(null);
            setProductionPkActiveId(null);
            setProductionPkOverlayMounted(false);
          }}
        />
      </Suspense>
    );
  }

  if (!incoming || !challenger) return null;

  return (
    <div className="u1pk-overlay" data-ui-id={incoming.pkType === 'pk_team' ? 'live.pk.team.challenge.overlay' : 'live.pk.1v1.challenge.overlay'}>
      <PkChallengeLiveStage
        roomId={incoming.hostRoomId}
        camera={<LiveCameraNode facing={facing} />}
        challenger={{
          id: incoming.challengerUserId,
          name: challenger.displayName || challenger.username || 'Host',
          avatarUrl: challenger.avatarUrl,
          verified: true,
        }}
        mutualHostAvatars={[me.avatarUrl, challenger.avatarUrl].filter(Boolean) as string[]}
        viewersLabel={viewersLabel}
        connectionLabel={labels.stable}
        durationSeconds={incoming.durationSec}
        expiresAt={incoming.expiresAt}
        labels={{
          ...labels,
          challengeTitle: incoming.pkType === 'pk_team' ? 'Team PK Challenge' : labels.challengeTitle,
          videoPk: incoming.pkType === 'pk_team'
            ? (() => {
                const size = resolveDeclaredTeamPkSize(
                  incoming.teamSize,
                  incoming.challengerTeamUserIds?.length ?? 0,
                  0,
                );
                return `${size}v${size} Team PK`;
              })()
            : labels.videoPk,
          roundDuration: `${Math.max(1, Math.round(incoming.durationSec / 60))} min round`,
        }}
        muted={muted}
        isAccepting={isAccepting}
        isDeclining={isDeclining}
        isLiveEnding={isLiveEnding}
        onAcceptPk={onAcceptPk}
        onDeclinePk={onDeclinePk}
        onChallengeExpired={onChallengeExpired}
        onLeaveRoom={onLeaveRoom}
        onEndLive={onEndLive}
        onSendComment={onSendComment}
        onOpenStickers={() => setStickersOpen(true)}
        onOpenGifts={() => {
          void import('../../lib/walletKstarSync')
            .then((m) => setGiftBalance(m.getLiveCoinsBalance(me.id)))
            .catch(() => setGiftBalance(0));
          setGiftsOpen(true);
        }}
        onOpenBeauty={() => setBeautyOpen(true)}
        onToggleMicrophone={onToggleMicrophone}
        onFlipCamera={() => void onFlipCamera()}
      />
      <Suspense fallback={null}>
        {giftsOpen ? (
          <PartyGiftPickerPanel
            open={giftsOpen}
            onClose={() => setGiftsOpen(false)}
            receiverName={challenger.displayName || challenger.username || 'Host'}
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
          title={labels.sticker || 'Sticker'}
          onClose={() => setStickersOpen(false)}
          senderId={me.id}
          roomId={incoming?.hostRoomId ?? ''}
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
            if (incoming) {
              void ingestLiveHostDashboard(incoming.hostRoomId, { kind: 'comment' }).catch(() => undefined);
            }
          }}
        />
      </Suspense>
    </div>
  );
}
