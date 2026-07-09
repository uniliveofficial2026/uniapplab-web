import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { registerLiveKitRoom, unregisterLiveKitRoom } from '../../lib/livekit/liveRoomBus';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../../lib/livekit/liveKitInstant';
import { updateLiveKitLocalAudioTrack } from '../../lib/livekit/liveKitAudioPublish';
import { fetchPartyLiveKitToken } from '../../lib/platformApi';

type UseGameLiveKitOptions = {
  roomId: string;
  hostUserId: string;
  isHost: boolean;
  enabled: boolean;
  publishMic: boolean;
  processedAudioTrack?: MediaStreamTrack | null;
  /** TRTC / camera-pipeline track for host PiP (skips raw getUserMedia when set). */
  hostCameraTrack?: MediaStreamTrack | null;
};

function attachRemoteAudio(room: Room) {
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      void el.play().catch(() => {});
    }
  });
}

async function publishOrReplaceTrack(
  room: Room,
  track: MediaStreamTrack | null,
  source: Track.Source,
): Promise<void> {
  const publication = room.localParticipant.getTrackPublication(source);
  const localTrack = publication?.track;

  if (!track) {
    if (localTrack) {
      await room.localParticipant.unpublishTrack(localTrack);
    }
    return;
  }

  if (localTrack?.mediaStreamTrack?.id === track.id) {
    return;
  }

  if (localTrack && 'replaceTrack' in localTrack) {
    await localTrack.replaceTrack(track);
    return;
  }

  await room.localParticipant.publishTrack(track, {
    source,
    ...(track.kind === 'video' ? { simulcast: false } : {}),
  });
}

export function useGameLiveKit({
  roomId,
  hostUserId,
  isHost,
  enabled,
  publishMic,
  processedAudioTrack = null,
  hostCameraTrack = null,
}: UseGameLiveKitOptions) {
  const configured = isLiveKitConfigured();
  const roomRef = useRef<Room | null>(null);
  const publishedTrackIdRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [casting, setCasting] = useState(false);
  const [startingCast, setStartingCast] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [castError, setCastError] = useState<string | null>(null);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const hostCameraTrackRef = useRef(hostCameraTrack);
  hostCameraTrackRef.current = hostCameraTrack;
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenVideoRef = useRef<HTMLVideoElement>(null);
  const remoteCameraVideoRef = useRef<HTMLVideoElement>(null);

  const [remoteScreenTrack, setRemoteScreenTrack] = useState<RemoteTrack | null>(null);
  const [remoteCameraTrack, setRemoteCameraTrack] = useState<RemoteTrack | null>(null);

  const stopLocalStreams = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    cameraStreamRef.current = null;
  }, []);

  const unpublishCastTracks = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await publishOrReplaceTrack(room, null, Track.Source.ScreenShare);
    await publishOrReplaceTrack(room, null, Track.Source.ScreenShareAudio);
    await publishOrReplaceTrack(room, null, Track.Source.Camera);
  }, []);

  const stopCast = useCallback(async () => {
    stopLocalStreams();
    await unpublishCastTracks();
    setCasting(false);
    setStartingCast(false);
    setCastError(null);
  }, [stopLocalStreams, unpublishCastTracks]);

  const publishCastTracks = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] ?? null;
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0] ?? null;
    const externalCamera = hostCameraTrackRef.current;
    const fallbackCamera = cameraStreamRef.current?.getVideoTracks()[0] ?? null;
    const cameraTrack = cameraOn ? externalCamera ?? fallbackCamera : null;
    await publishOrReplaceTrack(room, screenTrack, Track.Source.ScreenShare);
    await publishOrReplaceTrack(room, screenAudioTrack, Track.Source.ScreenShareAudio);
    await publishOrReplaceTrack(room, cameraTrack, Track.Source.Camera);
  }, [cameraOn]);

  const startCast = useCallback(async () => {
    if (!isHost || casting || startingCast) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCastError('Screen sharing is not supported in this browser');
      return;
    }

    setCastError(null);
    setStartingCast(true);
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      screen.getVideoTracks()[0]?.addEventListener('ended', () => {
        void stopCast();
      });
      screenStreamRef.current = screen;
      setCasting(true);

      if (!hostCameraTrackRef.current) {
        try {
          const camera = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 480, height: 360 },
            audio: false,
          });
          cameraStreamRef.current = camera;
          setCameraOn(true);
        } catch {
          cameraStreamRef.current = null;
          setCameraOn(false);
        }
      } else {
        setCameraOn(true);
      }

      await publishCastTracks();
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Screen share permission denied'
          : error instanceof Error
            ? error.message
            : 'Could not start screen share';
      setCastError(message);
      await stopCast();
    } finally {
      setStartingCast(false);
    }
  }, [casting, isHost, publishCastTracks, startingCast, stopCast]);

  const toggleCamera = useCallback(async () => {
    setCameraOn((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!casting || !isHost) return;
    void publishCastTracks();
  }, [cameraOn, casting, connected, hostCameraTrack?.id, isHost, publishCastTracks]);

  useEffect(() => {
    const screenEl = screenVideoRef.current;
    const stream = screenStreamRef.current;
    if (screenEl && stream) {
      screenEl.srcObject = stream;
      void screenEl.play().catch(() => {});
    }
  }, [casting]);

  useEffect(() => {
    const cameraEl = cameraVideoRef.current;
    const external = hostCameraTrackRef.current;
    if (!cameraEl || !cameraOn) {
      if (cameraEl) cameraEl.srcObject = null;
      return;
    }
    if (external) {
      cameraEl.srcObject = new MediaStream([external]);
      void cameraEl.play().catch(() => {});
      return;
    }
    const stream = cameraStreamRef.current;
    if (stream) {
      cameraEl.srcObject = stream;
      void cameraEl.play().catch(() => {});
    } else {
      cameraEl.srcObject = null;
    }
  }, [cameraOn, casting, hostCameraTrack?.id]);

  const syncHostRemoteTracks = useCallback(
    (room: Room) => {
      const host = room.remoteParticipants.get(hostUserId);
      if (!host) {
        setRemoteScreenTrack(null);
        setRemoteCameraTrack(null);
        return;
      }
      const screenPub = host.getTrackPublication(Track.Source.ScreenShare);
      const cameraPub = host.getTrackPublication(Track.Source.Camera);
      const screenTrack =
        screenPub?.track && screenPub.track.kind === Track.Kind.Video ? screenPub.track : null;
      const camTrack =
        cameraPub?.track && cameraPub.track.kind === Track.Kind.Video ? cameraPub.track : null;
      setRemoteScreenTrack(screenTrack);
      setRemoteCameraTrack(camTrack);
    },
    [hostUserId],
  );

  useEffect(() => {
    if (!configured || !enabled || !roomId || !canAttemptLiveKit()) {
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const bindRoom = (room: Room) => {
      roomRef.current = room;
      registerLiveKitRoom(roomId, room);
      attachRemoteAudio(room);
      const onTracks = () => syncHostRemoteTracks(room);
      room.on(RoomEvent.TrackSubscribed, onTracks);
      room.on(RoomEvent.TrackUnsubscribed, onTracks);
      room.on(RoomEvent.ParticipantConnected, onTracks);
      room.on(RoomEvent.ParticipantDisconnected, onTracks);
      syncHostRemoteTracks(room);
      setConnected(true);
    };

    const connect = async () => {
      const result = await connectWithTokenFetcher(
        () => fetchPartyLiveKitToken(roomId, isHost),
        {
          onDisconnected: () => {
            if (!cancelled) setConnected(false);
          },
        },
      );
      if (cancelled) {
        if (result.ok) void result.room.disconnect();
        return;
      }
      if (!result.ok) {
        setConnected(false);
        retryTimer = window.setTimeout(() => {
          if (!cancelled) void connect();
        }, 2_000);
        return;
      }
      bindRoom(result.room);
    };

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      void stopCast();
      const room = roomRef.current;
      roomRef.current = null;
      if (room) unregisterLiveKitRoom(roomId, room);
      room?.disconnect();
      setConnected(false);
      setRemoteScreenTrack(null);
      setRemoteCameraTrack(null);
    };
  }, [configured, enabled, isHost, roomId, stopCast, syncHostRemoteTracks]);

  const processedAudioTrackRef = useRef(processedAudioTrack);
  processedAudioTrackRef.current = processedAudioTrack;

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !enabled || room.state !== ConnectionState.Connected) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        if (publishMic) {
          const track = processedAudioTrackRef.current;
          if (!track || track.readyState === 'ended' || cancelled) return;
          if (publishedTrackIdRef.current === track.id) return;
          await updateLiveKitLocalAudioTrack(room.localParticipant, track);
          publishedTrackIdRef.current = track.id;
        } else {
          await updateLiveKitLocalAudioTrack(room.localParticipant, null);
          publishedTrackIdRef.current = null;
        }
      } catch {
        /* voice optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, processedAudioTrack?.id, publishMic, connected]);

  useEffect(() => {
    const el = remoteScreenVideoRef.current;
    if (!el || !remoteScreenTrack) return;
    remoteScreenTrack.attach(el);
    void el.play().catch(() => {});
    return () => {
      remoteScreenTrack.detach(el);
    };
  }, [remoteScreenTrack]);

  useEffect(() => {
    const el = remoteCameraVideoRef.current;
    if (!el || !remoteCameraTrack) return;
    remoteCameraTrack.attach(el);
    void el.play().catch(() => {});
    return () => {
      remoteCameraTrack.detach(el);
    };
  }, [remoteCameraTrack]);

  return {
    configured,
    connected,
    casting,
    startingCast,
    cameraOn,
    castError,
    screenVideoRef,
    cameraVideoRef,
    remoteScreenVideoRef,
    remoteCameraVideoRef,
    hasRemoteCast: Boolean(remoteScreenTrack),
    hasRemoteCamera: Boolean(remoteCameraTrack),
    startCast,
    stopCast,
    toggleCamera,
  };
}
