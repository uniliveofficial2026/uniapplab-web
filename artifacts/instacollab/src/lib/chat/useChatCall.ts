/**
 * Chat audio/video calls — LiveKit transport + TRTC WebAR local video pipeline.
 * CallKit-style: local preview first, network second. Video publish flows through
 * useChatCallTrtcPipeline when TRTC is configured (see ChatCallVideoEffectsHost).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireAppCamera,
  releaseAppCamera,
  setAppCameraFacing,
  type CameraFacingMode,
} from '../camera/appCameraOwner';
import {
  nextCameraFacingMode,
  shouldMirrorCameraPreview,
  shouldUpdateCameraFacingFromTrack,
} from '../camera/cameraMirrorPolicy';
import { isLiveKitConfigured } from '../livekit/livekitConfig';
import {
  loadLiveKitCallRuntime,
  type LiveKitCallRuntime,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Room,
} from '../livekit/liveKitCallRuntime';
import { isTencentWebARConfigured } from '../webar/webarConfig';
import { WEBAR_CAMERA_FRAME_RATE, WEBAR_CAMERA_IDEAL } from '../webar/webarCameraConfig';
import { isNetworkOnline } from '../networkStatus';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { fetchChatLiveKitToken } from '../platformApi';
import { queueCloudCallInvite, resolveChatThreadId } from './cloudChatSync';
import { exitNativeVideoPip, tryEnterNativeVideoPip } from './chatCallPip';
import {
  INCOMING_RING_TIMEOUT_MS,
  SLOW_CONNECT_MS,
  normalizeCallKind,
  type CallPresentation,
  type ChatCallKind,
  type ChatCallPhase,
  type ChatCallSignal,
  type ChatConnectPhase,
  type IncomingChatCall,
  type RemoteCallParticipant,
  type RemoteCallVideo,
} from './chatCallKit';

/** Warm WebAR SDK only when starting a video call (never on module load). */
function warmWebARIfNeeded(): void {
  if (!isTencentWebARConfigured()) return;
  void import('../webar/useTencentWebAR').then((m) => m.warmTencentWebARPipelineNow());
}

export type {
  ChatCallKind,
  ChatCallPhase,
  ChatConnectPhase,
  CallPresentation,
  IncomingChatCall,
};

export type { UseChatCallValue } from './chatCallTypes';
import type { UseChatCallValue } from './chatCallTypes';

export function useChatCall(currentUserId: string | null | undefined): UseChatCallValue {
  const [phase, setPhase] = useState<ChatCallPhase>('idle');
  const [connectPhase, setConnectPhase] = useState<ChatConnectPhase>('idle');
  const [presentation, setPresentation] = useState<CallPresentation>('fullscreen');
  const [callKind, setCallKind] = useState<ChatCallKind>('audio');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingChatCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [primaryRemoteStream, setPrimaryRemoteStream] = useState<MediaStream | null>(null);
  const [remoteVideos, setRemoteVideos] = useState<RemoteCallVideo[]>([]);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteCallParticipant[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<CameraFacingMode>('user');
  const [connectStartedAt, setConnectStartedAt] = useState(0);
  const [connectTick, setConnectTick] = useState(0);

  const phaseRef = useRef<ChatCallPhase>('idle');
  const connectPhaseRef = useRef<ChatConnectPhase>('idle');
  const activeChatIdRef = useRef<string | null>(null);
  const incomingRef = useRef<IncomingChatCall | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const lkRuntimeRef = useRef<LiveKitCallRuntime | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callKindRef = useRef<ChatCallKind>('audio');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  phaseRef.current = phase;
  connectPhaseRef.current = connectPhase;
  activeChatIdRef.current = activeChatId;
  incomingRef.current = incoming;

  const bindLocalVideoStream = useCallback(
    (stream: MediaStream | null, facingOverride?: CameraFacingMode) => {
      localStreamRef.current = stream;
      setLocalVideoStream(stream);
      if (stream && shouldUpdateCameraFacingFromTrack(facingOverride)) {
        setCameraFacingMode(facingOverride);
      }
      if (stream && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        void localVideoRef.current.play().catch(() => undefined);
      }
    },
    [],
  );

  const bindPrimaryRemoteStream = useCallback((stream: MediaStream | null) => {
    setPrimaryRemoteStream(stream);
    if (stream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      void remoteVideoRef.current.play().catch(() => undefined);
    }
    setRemoteVideoReady(!!stream);
  }, []);

  const upsertRemoteParticipant = useCallback(
    (participant: RemoteParticipant, patch: Partial<RemoteCallParticipant>) => {
      setRemoteParticipants((prev) => {
        const existing = prev.find((p) => p.participantId === participant.identity);
        const next: RemoteCallParticipant = {
          participantId: participant.identity,
          participantName: participant.name || participant.identity,
          hasAudio: patch.hasAudio ?? existing?.hasAudio ?? false,
        };
        if (existing) {
          return prev.map((p) => (p.participantId === next.participantId ? { ...p, ...next } : p));
        }
        return [...prev, next];
      });
    },
    [],
  );

  const stopLocalStream = useCallback(() => {
    releaseAppCamera('chat-call');
    // Audio-only previews still use a one-off mic stream outside the owner.
    const held = localStreamRef.current;
    if (held && !held.getVideoTracks().length) {
      held.getTracks().forEach((t) => t.stop());
    }
    bindLocalVideoStream(null);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, [bindLocalVideoStream]);

  const replacePublishedVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const room = roomRef.current;
    if (!room || callKindRef.current !== 'video') return;
    try {
      const lk = lkRuntimeRef.current ?? (await loadLiveKitCallRuntime());
      lkRuntimeRef.current = lk;
      await lk.updateLiveKitLocalVideoTrack(
        room.localParticipant,
        track ? lk.prepareProcessedVideoTrackForLiveKit(track) : null,
      );
    } catch {
      /* keep prior track */
    }
  }, []);

  const cleanupRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    setRemoteVideoReady(false);
    setPrimaryRemoteStream(null);
    setRemoteVideos([]);
    setRemoteParticipants([]);
    stopLocalStream();
    if (room) {
      try {
        room.removeAllListeners();
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
  }, [stopLocalStream]);

  const resetCallState = useCallback(() => {
    setIncoming(null);
    setActiveChatId(null);
    setPhase('idle');
    setConnectPhase('idle');
    setPresentation('fullscreen');
    setCameraFacingMode('user');
    setConnectStartedAt(0);
    setError(null);
    setIsMicMuted(false);
    setIsCameraEnabled(true);
    threadIdRef.current = null;
    exitNativeVideoPip();
  }, []);

  const detachRemoteParticipant = useCallback(
    (participantId: string) => {
      setRemoteParticipants((prev) => prev.filter((p) => p.participantId !== participantId));
      setRemoteVideos((prev) => {
        const next = prev.filter((v) => v.participantId !== participantId);
        bindPrimaryRemoteStream(next[next.length - 1]?.stream ?? null);
        if (next.length === 0) setRemoteVideoReady(false);
        return next;
      });
    },
    [bindPrimaryRemoteStream],
  );

  const attachRemoteTrack = useCallback(
    (track: RemoteTrack, kind: ChatCallKind, participant: RemoteParticipant, Track: LiveKitCallRuntime['Track']) => {
      if (track.kind === Track.Kind.Audio) {
        if (remoteAudioRef.current) track.attach(remoteAudioRef.current);
        upsertRemoteParticipant(participant, { hasAudio: true });
        return;
      }
      if (track.kind !== Track.Kind.Video || kind !== 'video') return;
      const mediaTrack = track.mediaStreamTrack;
      if (!mediaTrack) return;
      const stream = new MediaStream([mediaTrack]);
      const entry: RemoteCallVideo = {
        participantId: participant.identity,
        participantName: participant.name || participant.identity,
        stream,
      };
      upsertRemoteParticipant(participant, {});
      setRemoteVideos((prev) => {
        const next = [...prev.filter((v) => v.participantId !== entry.participantId), entry];
        bindPrimaryRemoteStream(next[next.length - 1]?.stream ?? null);
        return next;
      });
    },
    [bindPrimaryRemoteStream, upsertRemoteParticipant],
  );

  const startLocalPreview = useCallback(async (kind: ChatCallKind) => {
    try {
      if (kind !== 'video') {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        bindLocalVideoStream(stream);
        return stream;
      }
      const stream = await acquireAppCamera('chat-call', {
        audio: true,
        facingMode: 'user',
        exactFacing: false,
        videoIdeal: WEBAR_CAMERA_IDEAL,
        frameRate: WEBAR_CAMERA_FRAME_RATE,
      });
      bindLocalVideoStream(stream, 'user');
      return stream;
    } catch {
      return null;
    }
  }, [bindLocalVideoStream]);

  const connectToThread = useCallback(
    async (threadId: string, kind: ChatCallKind) => {
      const callType = normalizeCallKind(kind);
      callKindRef.current = callType;
      setCallKind(callType);
      threadIdRef.current = threadId;

      if (!isLiveKitConfigured()) {
        setError('Calls are not configured on this server.');
        setConnectPhase('failed');
        return false;
      }

      const lk = await loadLiveKitCallRuntime();
      lkRuntimeRef.current = lk;
      const { RoomEvent, Track, canAttemptLiveKit, connectWithTokenFetcher } = lk;

      const priorRoom = roomRef.current;
      roomRef.current = null;
      if (priorRoom) {
        try {
          priorRoom.removeAllListeners();
          await priorRoom.disconnect();
        } catch {
          /* ignore */
        }
      }
      setRemoteVideoReady(false);
      setPrimaryRemoteStream(null);
      setRemoteVideos([]);
      setRemoteParticipants([]);
      setConnectPhase('connecting');
      setConnectStartedAt(Date.now());

      let localStream = localStreamRef.current;
      if (!localStream) {
        localStream = await startLocalPreview(callType);
      }

      if (!canAttemptLiveKit()) {
        setError('Waiting for a better connection… your preview is ready.');
        setConnectPhase('slow');
        return false;
      }

      const result = await connectWithTokenFetcher(
        () => fetchChatLiveKitToken(threadId, callType),
        {
          onDisconnected: () => {
            setPhase('ended');
            setConnectPhase('idle');
            void cleanupRoom().then(resetCallState);
          },
        },
      );

      if (!result.ok) {
        setError('Still connecting… remote audio/video joins when ready.');
        setConnectPhase('slow');
        window.setTimeout(() => {
          if (phaseRef.current === 'idle' || connectPhaseRef.current === 'connected') return;
          void connectToThread(threadId, callType).then((ok) => {
            if (ok) {
              setPhase('connected');
              setConnectPhase('connected');
              setError(null);
            }
          });
        }, 2_000);
        return false;
      }

      const room = result.room;
      roomRef.current = room;

      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          attachRemoteTrack(track, callKindRef.current, participant, Track);
        },
      );

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          detachRemoteParticipant(participant.identity);
          return;
        }
        if (track.kind === Track.Kind.Audio) {
          upsertRemoteParticipant(participant, { hasAudio: false });
        }
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        upsertRemoteParticipant(participant, {});
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        detachRemoteParticipant(participant.identity);
      });

      if (localStream) {
        const deferVideoToTrtc = callType === 'video' && isTencentWebARConfigured();
        for (const track of localStream.getTracks()) {
          try {
            if (track.kind === 'video' && deferVideoToTrtc) {
              continue;
            }
            if (track.kind === 'video') {
              await room.localParticipant.publishTrack(
                lk.prepareProcessedVideoTrackForLiveKit(track),
                lk.PROCESSED_VIDEO_LIVEKIT_PUBLISH,
              );
            } else {
              await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
            }
          } catch {
            /* ignore */
          }
        }
      } else {
        await room.localParticipant.setMicrophoneEnabled(true).catch(() => undefined);
      }

      room.remoteParticipants.forEach((participant) => {
        upsertRemoteParticipant(participant, {});
        participant.trackPublications.forEach((pub) => {
          if (pub.track) attachRemoteTrack(pub.track as RemoteTrack, callType, participant, Track);
        });
      });

      setError(null);
      setPhase('connected');
      setConnectPhase('connected');
      return true;
    },
    [attachRemoteTrack, cleanupRoom, detachRemoteParticipant, resetCallState, startLocalPreview, upsertRemoteParticipant],
  );

  const dismissCall = useCallback(
    async (options?: { notifyRemote?: boolean }) => {
      const notify = options?.notifyRemote !== false;
      const kind = normalizeCallKind(callKindRef.current);
      const chatId = activeChatIdRef.current;
      const inc = incomingRef.current;
      if (notify) {
        if (chatId) {
          queueCloudCallInvite(chatId, kind, 'end');
        } else if (inc) {
          queueCloudCallInvite(inc.chatId, normalizeCallKind(inc.callKind), 'decline');
        }
      }
      resetCallState();
      await cleanupRoom();
    },
    [cleanupRoom, resetCallState],
  );

  const startCall = useCallback(
    (chatId: string, kind: ChatCallKind) => {
      const callType = normalizeCallKind(kind);
      if (callType === 'video' && isTencentWebARConfigured()) {
        warmWebARIfNeeded();
      }
      callKindRef.current = callType;
      setCallKind(callType);
      setActiveChatId(chatId);
      setPhase('outgoing');
      setConnectPhase('connecting');
      setConnectStartedAt(Date.now());
      setIncoming(null);
      setError(null);

      void startLocalPreview(callType);

      if (!isNetworkOnline()) {
        setError('Calls need internet for the other person. Your preview is ready offline.');
        setConnectPhase('failed');
        return;
      }

      const meId = currentUserId;
      if (!meId || !isCloudAuthUserId(meId)) {
        setError('Sign in with a cloud account to call other people.');
        setConnectPhase('failed');
        return;
      }

      void (async () => {
        try {
          const threadId = await resolveChatThreadId(chatId);
          if (!threadId) {
            setError('Could not open chat thread for this call.');
            setConnectPhase('failed');
            return;
          }
          queueCloudCallInvite(chatId, callType, 'invite');
          const ok = await connectToThread(threadId, callType);
          if (!ok && connectPhaseRef.current !== 'connected') {
            setPhase('outgoing');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Call failed');
          setConnectPhase('failed');
        }
      })();
    },
    [connectToThread, currentUserId, startLocalPreview],
  );

  const startAudioCall = useCallback((chatId: string) => startCall(chatId, 'audio'), [startCall]);
  const startVideoCall = useCallback((chatId: string) => startCall(chatId, 'video'), [startCall]);

  const acceptCall = useCallback(async () => {
    const inc = incomingRef.current;
    if (!inc) return;
    const callType = normalizeCallKind(inc.callKind);
    if (callType === 'video' && isTencentWebARConfigured()) {
      warmWebARIfNeeded();
    }
    callKindRef.current = callType;
    setCallKind(callType);
    setActiveChatId(inc.chatId);
    setPhase('outgoing');
    setConnectPhase('connecting');
    setConnectStartedAt(Date.now());
    setError(null);
    setIncoming(null);
    void startLocalPreview(callType);

    try {
      const threadId = inc.threadId || (await resolveChatThreadId(inc.chatId));
      if (!threadId) {
        setError('Could not join this call thread.');
        setConnectPhase('failed');
        return;
      }
      const ok = await connectToThread(threadId, callType);
      if (!ok) setPhase('outgoing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join call');
      setConnectPhase('failed');
    }
  }, [connectToThread, startLocalPreview]);

  const declineCall = useCallback(async () => {
    const inc = incomingRef.current;
    if (inc) {
      queueCloudCallInvite(inc.chatId, normalizeCallKind(inc.callKind), 'decline');
    }
    await dismissCall({ notifyRemote: false });
  }, [dismissCall]);

  const endCall = useCallback(async () => {
    await dismissCall({ notifyRemote: true });
  }, [dismissCall]);

  const retryConnect = useCallback(async () => {
    const chatId = activeChatIdRef.current;
    if (!chatId) return;
    setConnectPhase('connecting');
    setConnectStartedAt(Date.now());
    setError(null);
    try {
      const threadId = threadIdRef.current || (await resolveChatThreadId(chatId));
      if (!threadId) {
        setError('Could not reconnect to this call.');
        setConnectPhase('failed');
        return;
      }
      const ok = await connectToThread(threadId, callKindRef.current);
      if (!ok && connectPhaseRef.current !== 'connected') {
        setPhase(phaseRef.current === 'incoming' ? 'incoming' : 'outgoing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconnect failed');
      setConnectPhase('failed');
    }
  }, [connectToThread]);

  const joinGroupCall = useCallback(
    async (chatId: string, kind: ChatCallKind) => {
      const callType = normalizeCallKind(kind);
      if (callType === 'video' && isTencentWebARConfigured()) {
        warmWebARIfNeeded();
      }
      callKindRef.current = callType;
      setCallKind(callType);
      setActiveChatId(chatId);
      setPhase('outgoing');
      setConnectPhase('connecting');
      setConnectStartedAt(Date.now());
      setPresentation('fullscreen');
      setIncoming(null);
      setError(null);
      void startLocalPreview(callType);
      try {
        const threadId = await resolveChatThreadId(chatId);
        if (!threadId) {
          setError('Could not join this group call.');
          setConnectPhase('failed');
          return;
        }
        const ok = await connectToThread(threadId, callType);
        if (!ok && connectPhaseRef.current !== 'connected') {
          setPhase('outgoing');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not join group call');
        setConnectPhase('failed');
      }
    },
    [connectToThread, startLocalPreview],
  );

  const minimizeCall = useCallback(() => {
    setPresentation('pip');
    if (callKindRef.current === 'video') {
      void tryEnterNativeVideoPip(remoteVideoRef.current);
    }
  }, []);

  const expandCall = useCallback(() => {
    setPresentation('fullscreen');
    exitNativeVideoPip();
  }, []);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (room) {
      await room.localParticipant.setMicrophoneEnabled(!nextMuted).catch(() => undefined);
    }
  }, [isMicMuted]);

  const toggleCamera = useCallback(async () => {
    if (callKindRef.current !== 'video') return;
    const nextEnabled = !isCameraEnabled;
    setIsCameraEnabled(nextEnabled);

    if (!nextEnabled) {
      await replacePublishedVideoTrack(null);
      return;
    }

    let stream = localStreamRef.current;
    if (!stream?.getVideoTracks().some((track) => track.readyState === 'live')) {
      stream = await startLocalPreview('video');
    }
    if (!stream) return;

    bindLocalVideoStream(stream);
    if (!isTencentWebARConfigured()) {
      const videoTrack = stream.getVideoTracks()[0] ?? null;
      await replacePublishedVideoTrack(videoTrack);
    }
  }, [bindLocalVideoStream, isCameraEnabled, replacePublishedVideoTrack, startLocalPreview]);

  const flipCamera = useCallback(async () => {
    if (callKindRef.current !== 'video') return;
    if (!localStreamRef.current?.getVideoTracks()[0]) return;
    const nextFacing = nextCameraFacingMode(cameraFacingMode);
    try {
      const nextStream = await setAppCameraFacing(nextFacing);
      if (!nextStream) return;
      setCameraFacingMode(nextFacing);
      bindLocalVideoStream(nextStream, nextFacing);
    } catch {
      /* keep prior camera */
    }
  }, [bindLocalVideoStream, cameraFacingMode]);

  useEffect(() => {
    if (connectPhase !== 'connecting' || !connectStartedAt) return;
    const id = window.setInterval(() => setConnectTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [connectPhase, connectStartedAt]);

  useEffect(() => {
    if (connectPhase !== 'connecting' || !connectStartedAt) return;
    if (Date.now() - connectStartedAt >= SLOW_CONNECT_MS) {
      setConnectPhase('slow');
    }
  }, [connectPhase, connectStartedAt, connectTick]);

  useEffect(() => {
    const onInvite = (event: Event) => {
      const detail = (event as CustomEvent<IncomingChatCall>).detail;
      if (!detail?.chatId || !detail.fromUserId) return;
      if (detail.fromUserId === currentUserId) return;
      const currentPhase = phaseRef.current;
      if (currentPhase === 'connected' || currentPhase === 'outgoing') return;
      const callType = normalizeCallKind(detail.callKind);
      setIncoming({
        chatId: detail.chatId,
        fromUserId: detail.fromUserId,
        callKind: callType,
        threadId: detail.threadId || '',
        callRoomName: detail.callRoomName,
        isGroup: detail.isGroup,
      });
      setCallKind(callType);
      callKindRef.current = callType;
      setPhase('incoming');
      setConnectPhase('idle');
      setError(null);
    };
    window.addEventListener('chat-call-invite', onInvite);
    return () => window.removeEventListener('chat-call-invite', onInvite);
  }, [currentUserId]);

  useEffect(() => {
    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<ChatCallSignal>).detail;
      if (!detail?.chatId) return;
      const currentPhase = phaseRef.current;
      const chatId = activeChatIdRef.current;
      const inc = incomingRef.current;
      const matches =
        chatId === detail.chatId ||
        inc?.chatId === detail.chatId ||
        (currentPhase === 'incoming' && inc?.chatId === detail.chatId);
      if (!matches) return;
      if (detail.action === 'end' || detail.action === 'decline') {
        if (currentPhase === 'connected' && detail.action === 'end') {
          void dismissCall({ notifyRemote: false });
          return;
        }
        if (currentPhase === 'incoming' || currentPhase === 'outgoing') {
          void dismissCall({ notifyRemote: false });
        }
      }
    };
    window.addEventListener('chat-call-signal', onSignal);
    return () => window.removeEventListener('chat-call-signal', onSignal);
  }, [dismissCall]);

  useEffect(() => {
    if (phase !== 'incoming') return;
    const id = window.setTimeout(() => {
      if (phaseRef.current === 'incoming') {
        const inc = incomingRef.current;
        if (inc) {
          queueCloudCallInvite(inc.chatId, normalizeCallKind(inc.callKind), 'decline');
        }
        void dismissCall({ notifyRemote: false });
      }
    }, INCOMING_RING_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [phase, dismissCall]);

  useEffect(() => {
    return () => {
      void cleanupRoom();
    };
  }, [cleanupRoom]);

  return {
    phase,
    connectPhase,
    presentation,
    callKind,
    activeChatId,
    incoming,
    error,
    remoteVideoReady,
    localVideoStream,
    primaryRemoteStream,
    remoteVideos,
    remoteParticipants,
    isMicMuted,
    isCameraEnabled,
    cameraFacingMode,
    mirrorLocalPreview: shouldMirrorCameraPreview(cameraFacingMode),
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    localStreamRef,
    replacePublishedVideoTrack,
    startCall,
    startAudioCall,
    startVideoCall,
    joinGroupCall,
    acceptCall,
    declineCall,
    endCall,
    retryConnect,
    minimizeCall,
    expandCall,
    toggleMic,
    toggleCamera,
    flipCamera,
    isLiveKitConfigured: isLiveKitConfigured(),
  };
}
