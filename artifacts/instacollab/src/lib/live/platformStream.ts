import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import {
  acquireAppCamera,
  releaseAppCamera,
} from '../camera/appCameraOwner';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { isLiveKitConfigured } from '../livekit/livekitConfig';
import { canAttemptLiveKit } from '../livekit/liveKitInstant';
import { connectLiveKitHost, disconnectLiveKit } from './liveKitConnection';
import { postStreamSignal, startStream, stopStream } from '../platformApi';

export type PlatformStreamMode = 'webrtc' | 'livekit' | null;

export type PlatformStreamState = {
  streamId: string | null;
  localStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  mode: PlatformStreamMode;
  roomName: string | null;
};

const PLATFORM_CAMERA_LEASE = 'platform-stream';

/**
 * Platform live stream — local camera/mic paints first; LiveKit/WebRTC publish is background.
 */
export function usePlatformStream() {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<PlatformStreamMode>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const liveKitRoomRef = useRef<Room | null>(null);
  const cameraLeaseRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      void disconnectLiveKit(liveKitRoomRef.current, localStream, cameraLeaseRef.current ?? undefined);
      if (cameraLeaseRef.current) {
        releaseAppCamera(cameraLeaseRef.current);
        cameraLeaseRef.current = null;
      }
    };
  }, [localStream]);

  const goLive = async (title?: string, options?: { mediaStream?: MediaStream }) => {
    // Instant local media before any network — single device owner.
    let media = options?.mediaStream ?? null;
    if (!media) {
      media = await acquireAppCamera(PLATFORM_CAMERA_LEASE, {
        audio: true,
        facingMode: 'user',
        exactFacing: false,
      });
      cameraLeaseRef.current = PLATFORM_CAMERA_LEASE;
    }
    setLocalStream(media);

    const created = await startStream(title);
    setStreamId(created.id);

    if (isLiveKitConfigured() && canAttemptLiveKit()) {
      try {
        const connection = await connectLiveKitHost(created.id, { mediaStream: media });
        liveKitRoomRef.current = connection.room;
        setRoomName(connection.roomName);
        setMode('livekit');
        return;
      } catch {
        // Local camera already showing — fall through to WebRTC or stay local-only.
      }
    }

    setMode('webrtc');
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    media.getTracks().forEach((track) => pc.addTrack(track, media));

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void postStreamSignal(created.id, 'ice', { candidate: event.candidate.toJSON() });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await postStreamSignal(created.id, 'offer', { sdp: offer });

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      supabase
        ?.channel(`stream-signals:${created.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_signals',
            filter: `stream_id=eq.${created.id}`,
          },
          async (payload) => {
            const row = payload.new as {
              signal_type?: string;
              payload?: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
            };
            if (row.signal_type === 'answer' && row.payload?.sdp) {
              await pc.setRemoteDescription(row.payload.sdp);
            }
            if (row.signal_type === 'ice' && row.payload?.candidate) {
              try {
                await pc.addIceCandidate(row.payload.candidate);
              } catch {
                // ignore stale candidates
              }
            }
          },
        )
        .subscribe();
    }
  };

  const endLive = async () => {
    if (streamId) await stopStream(streamId).catch(() => {});
    if (mode === 'livekit') {
      await disconnectLiveKit(liveKitRoomRef.current, localStream, cameraLeaseRef.current ?? undefined);
      liveKitRoomRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    if (cameraLeaseRef.current) {
      releaseAppCamera(cameraLeaseRef.current);
      cameraLeaseRef.current = null;
    }
    setLocalStream(null);
    setStreamId(null);
    setMode(null);
    setRoomName(null);
  };

  return { streamId, localStream, goLive, endLive, mode, roomName };
}
