/**
 * LiveKit audio/video calls — UI (avatars / local camera) first, network second.
 * Slow internet: local preview stays; remote A/V upgrades when connect succeeds.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client';
import { isLiveKitConfigured } from '../livekit/livekitConfig';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../livekit/liveKitInstant';
import { isNetworkOnline } from '../networkStatus';
import { fetchChatLiveKitToken } from '../platformApi';
import { queueCloudCallInvite, resolveChatThreadId } from './cloudChatSync';

export type ChatCallKind = 'audio' | 'video';
export type ChatCallPhase = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';

export type IncomingChatCall = {
  chatId: string;
  fromUserId: string;
  callKind: ChatCallKind;
  threadId: string;
};

function normalizeCallKind(kind: unknown): ChatCallKind {
  return kind === 'video' ? 'video' : 'audio';
}

export function useChatCall(currentUserId: string | null | undefined) {
  const [phase, setPhase] = useState<ChatCallPhase>('idle');
  const [callKind, setCallKind] = useState<ChatCallKind>('audio');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingChatCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callKindRef = useRef<ChatCallKind>('audio');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  /** Swap published camera track (e.g. TRTC beauty output) without restarting the call. */
  const replacePublishedVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const room = roomRef.current;
    if (!room || callKindRef.current !== 'video') return;
    try {
      for (const pub of room.localParticipant.videoTrackPublications.values()) {
        if (pub.track) {
          await room.localParticipant.unpublishTrack(pub.track);
        }
      }
      if (track) {
        await room.localParticipant.publishTrack(track, { source: Track.Source.Camera });
        if (localVideoRef.current) {
          const stream = new MediaStream([track]);
          localVideoRef.current.srcObject = stream;
          void localVideoRef.current.play().catch(() => undefined);
        }
      }
    } catch {
      /* keep prior track */
    }
  }, []);

  const cleanupRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    setRemoteVideoReady(false);
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

  const attachRemoteTrack = useCallback((track: RemoteTrack, kind: ChatCallKind) => {
    if (track.kind === Track.Kind.Video) {
      if (kind !== 'video' || !remoteVideoRef.current) return;
      track.attach(remoteVideoRef.current);
      setRemoteVideoReady(true);
      return;
    }
    if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
      track.attach(remoteAudioRef.current);
    }
  }, []);

  /** Instant local mic/camera — does not wait on network. */
  const startLocalPreview = useCallback(async (kind: ChatCallKind) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video',
      });
      localStreamRef.current = stream;
      if (kind === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        void localVideoRef.current.play().catch(() => undefined);
      }
      return stream;
    } catch {
      return null;
    }
  }, []);

  const connectToThread = useCallback(
    async (threadId: string, kind: ChatCallKind) => {
      const callType = normalizeCallKind(kind);
      callKindRef.current = callType;
      setCallKind(callType);

      if (!isLiveKitConfigured()) {
        setError('Calls are not configured on this server.');
        return false;
      }

      // Keep any existing local preview; only tear down prior room.
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
      setError(null);
      setRemoteVideoReady(false);

      // 1) Local A/V instantly (clear self-view / mic).
      let localStream = localStreamRef.current;
      if (!localStream) {
        localStream = await startLocalPreview(callType);
      }

      if (!canAttemptLiveKit()) {
        setError('Waiting for a better connection… your preview is ready.');
        return false;
      }

      // 2) Timed LiveKit connect — never hangs UI.
      const result = await connectWithTokenFetcher(
        () => fetchChatLiveKitToken(threadId, callType),
        {
          onDisconnected: () => {
            setPhase('ended');
            void cleanupRoom();
          },
        },
      );

      if (!result.ok) {
        setError('Still connecting… your preview stays on. Remote audio/video will join when ready.');
        // Retry once in background.
        window.setTimeout(() => {
          void connectToThread(threadId, callType).then((ok) => {
            if (ok) setPhase('connected');
          });
        }, 2_000);
        return false;
      }

      const room = result.room;
      roomRef.current = room;

      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
          attachRemoteTrack(track, callKindRef.current);
        },
      );

      // Publish local tracks we already have (instant path).
      if (localStream) {
        for (const track of localStream.getTracks()) {
          try {
            await room.localParticipant.publishTrack(track);
          } catch {
            /* ignore */
          }
        }
      } else {
        await room.localParticipant.setMicrophoneEnabled(true).catch(() => undefined);
        if (callType === 'video') {
          await room.localParticipant.setCameraEnabled(true).catch(() => undefined);
          const cam = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (cam?.track && localVideoRef.current) {
            cam.track.attach(localVideoRef.current);
          }
        }
      }

      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          if (pub.track) attachRemoteTrack(pub.track as RemoteTrack, callType);
        });
      });

      setError(null);
      setPhase('connected');
      return true;
    },
    [attachRemoteTrack, cleanupRoom, startLocalPreview],
  );

  const startCall = useCallback(
    async (chatId: string, kind: ChatCallKind) => {
      const callType = normalizeCallKind(kind);
      callKindRef.current = callType;
      setCallKind(callType);
      setActiveChatId(chatId);
      setPhase('outgoing');
      setIncoming(null);
      setError(null);

      // Instant local preview before any network.
      void startLocalPreview(callType);

      if (!isNetworkOnline()) {
        setError('Calls need internet for the other person. Your preview is ready offline.');
        return;
      }

      try {
        const threadId = await resolveChatThreadId(chatId);
        if (!threadId) {
          setError('Could not open chat thread for this call.');
          return;
        }
        queueCloudCallInvite(chatId, callType, 'invite');
        const ok = await connectToThread(threadId, callType);
        if (!ok && phase !== 'connected') {
          // Stay on outgoing with local preview — not a hard failure UI wipe.
          setPhase('outgoing');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Call failed');
      }
    },
    [connectToThread, phase, startLocalPreview],
  );

  const startAudioCall = useCallback(
    (chatId: string) => startCall(chatId, 'audio'),
    [startCall],
  );

  const startVideoCall = useCallback(
    (chatId: string) => startCall(chatId, 'video'),
    [startCall],
  );

  const acceptCall = useCallback(async () => {
    if (!incoming) return;
    const callType = normalizeCallKind(incoming.callKind);
    callKindRef.current = callType;
    setCallKind(callType);
    setActiveChatId(incoming.chatId);
    setPhase('outgoing');
    setError(null);
    void startLocalPreview(callType);

    try {
      const threadId =
        incoming.threadId || (await resolveChatThreadId(incoming.chatId));
      setIncoming(null);
      if (!threadId) {
        setError('Could not join this call thread.');
        return;
      }
      const ok = await connectToThread(threadId, callType);
      if (!ok) setPhase('outgoing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join call');
      setIncoming(null);
    }
  }, [connectToThread, incoming, startLocalPreview]);

  const endCall = useCallback(async () => {
    const kind = normalizeCallKind(callKindRef.current);
    if (activeChatId) {
      queueCloudCallInvite(activeChatId, kind, 'end');
    } else if (incoming) {
      queueCloudCallInvite(incoming.chatId, normalizeCallKind(incoming.callKind), 'decline');
    }
    setIncoming(null);
    setActiveChatId(null);
    setPhase('idle');
    setError(null);
    await cleanupRoom();
  }, [activeChatId, cleanupRoom, incoming]);

  useEffect(() => {
    const onInvite = (event: Event) => {
      const detail = (event as CustomEvent<IncomingChatCall>).detail;
      if (!detail?.chatId || !detail.fromUserId) return;
      if (detail.fromUserId === currentUserId) return;
      if (phase === 'connected' || phase === 'outgoing') return;
      const callType = normalizeCallKind(detail.callKind);
      setIncoming({
        chatId: detail.chatId,
        fromUserId: detail.fromUserId,
        callKind: callType,
        threadId: detail.threadId || '',
      });
      setCallKind(callType);
      callKindRef.current = callType;
      setPhase('incoming');
    };
    window.addEventListener('chat-call-invite', onInvite);
    return () => window.removeEventListener('chat-call-invite', onInvite);
  }, [currentUserId, phase]);

  useEffect(() => {
    return () => {
      void cleanupRoom();
    };
  }, [cleanupRoom]);

  return {
    phase,
    callKind,
    activeChatId,
    incoming,
    error,
    remoteVideoReady,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    localStreamRef,
    replacePublishedVideoTrack,
    startCall,
    startAudioCall,
    startVideoCall,
    acceptCall,
    endCall,
    isLiveKitConfigured: isLiveKitConfigured(),
  };
}
