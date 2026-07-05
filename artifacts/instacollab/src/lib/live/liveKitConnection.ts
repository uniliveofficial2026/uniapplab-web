import { Room } from 'livekit-client';
import { fetchLiveKitToken } from '../platformApi';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../livekit/liveKitInstant';

export type LiveKitConnection = {
  room: Room;
  localStream: MediaStream;
  roomName: string;
};

/**
 * Host live stream — local camera/mic starts first, LiveKit publishes when connect succeeds.
 */
export async function connectLiveKitHost(
  streamId: string,
  options?: { mediaStream?: MediaStream },
): Promise<LiveKitConnection> {
  // Instant local media (clear self-view) before any network.
  const media =
    options?.mediaStream ??
    (await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));

  if (!canAttemptLiveKit()) {
    // Return a stub-less error path: caller can still show local media.
    const err = new Error('LiveKit unavailable — local camera is ready.');
    (err as Error & { localStream?: MediaStream }).localStream = media;
    throw err;
  }

  const result = await connectWithTokenFetcher(() => fetchLiveKitToken(streamId, 'host'));
  if (!result.ok) {
    const err = new Error(result.reason || 'LiveKit connect failed');
    (err as Error & { localStream?: MediaStream }).localStream = media;
    throw err;
  }

  const room = result.room;
  for (const track of media.getTracks()) {
    try {
      await room.localParticipant.publishTrack(track);
    } catch {
      /* keep trying other tracks */
    }
  }

  return { room, localStream: media, roomName: room.name || `stream-${streamId}` };
}

export async function disconnectLiveKit(room: Room | null, localStream: MediaStream | null) {
  try {
    room?.disconnect();
  } catch {
    /* ignore */
  }
  localStream?.getTracks().forEach((t) => t.stop());
}
