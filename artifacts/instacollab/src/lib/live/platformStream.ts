import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { isLiveKitConfigured } from '../livekit/livekitConfig';
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

export function usePlatformStream() {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<PlatformStreamMode>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const liveKitRoomRef = useRef<Room | null>(null);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      void disconnectLiveKit(liveKitRoomRef.current, localStream);
    };
  }, [localStream]);

  const goLive = async (title?: string, options?: { mediaStream?: MediaStream }) => {
    const created = await startStream(title);
    setStreamId(created.id);

    if (isLiveKitConfigured()) {
      const connection = await connectLiveKitHost(created.id, options);
      liveKitRoomRef.current = connection.room;
      setLocalStream(connection.localStream);
      setRoomName(connection.roomName);
      setMode('livekit');
      return;
    }

    setMode('webrtc');
    const media =
      options?.mediaStream ??
      (await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
    setLocalStream(media);

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
      await disconnectLiveKit(liveKitRoomRef.current, localStream);
      liveKitRoomRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setStreamId(null);
    setMode(null);
    setRoomName(null);
  };

  return { streamId, localStream, goLive, endLive, mode, roomName };
};
