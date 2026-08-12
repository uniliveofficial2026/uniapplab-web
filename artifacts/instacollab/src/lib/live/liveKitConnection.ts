import { Room } from 'livekit-client';
import {
  acquireAppCamera,
  getAppCameraStream,
  releaseAppCamera,
} from '../camera/appCameraOwner';
import { fetchLiveKitToken } from '../platformApi';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../livekit/liveKitInstant';

export type LiveKitConnection = {
  room: Room;
  localStream: MediaStream;
  roomName: string;
  cameraLeaseId?: string;
};

/**
 * Host live stream — local camera/mic starts first, LiveKit publishes when connect succeeds.
 */
export async function connectLiveKitHost(
  streamId: string,
  options?: { mediaStream?: MediaStream },
): Promise<LiveKitConnection> {
  const leaseId = options?.mediaStream ? undefined : `livekit-host:${streamId}`;
  // Instant local media (clear self-view) before any network — single device owner.
  const media =
    options?.mediaStream ??
    (await acquireAppCamera(leaseId!, {
      audio: true,
      facingMode: 'user',
      exactFacing: false,
    }));

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

  return {
    room,
    localStream: media,
    roomName: room.name || `stream-${streamId}`,
    cameraLeaseId: leaseId,
  };
}

export async function disconnectLiveKit(
  room: Room | null,
  localStream: MediaStream | null,
  cameraLeaseId?: string,
) {
  try {
    room?.disconnect();
  } catch {
    /* ignore */
  }
  if (cameraLeaseId) {
    releaseAppCamera(cameraLeaseId);
    return;
  }
  // Shared app camera — never stop tracks from here.
  if (localStream && localStream === getAppCameraStream()) return;
  localStream?.getTracks().forEach((t) => t.stop());
}
