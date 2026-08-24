import { Room } from '../rtc/livekitCompatibilityBoundary';
import {
  acquireAppCamera,
  getAppCameraStream,
  releaseAppCamera,
} from '../camera/appCameraOwner';
import { fetchLiveKitToken } from '../platformApi';
import { canAttemptLiveKit } from '../livekit/liveKitInstant';
import {
  connectHostLiveKitRoom,
  disposeHostLiveKitRoom,
  getActiveHostLiveKitRoomKey,
} from '../livekit/hostLiveKitRoom';
import { updateLiveKitLocalVideoTrack } from '../livekit/liveKitVideoPublish';
import { updateLiveKitLocalAudioTrack } from '../livekit/liveKitAudioPublish';
import {
  noteHostPublishing,
  noteHostRawPreviewReady,
  noteHostTrackPublished,
  setHostMediaState,
} from '../camera/hostMediaSession';

export type LiveKitConnection = {
  room: Room;
  localStream: MediaStream;
  roomName: string;
  cameraLeaseId?: string;
};

/**
 * Host live stream — local camera/mic starts first, LiveKit publishes the same prepared track.
 */
export async function connectLiveKitHost(
  streamId: string,
  options?: { mediaStream?: MediaStream },
): Promise<LiveKitConnection> {
  const leaseId = options?.mediaStream ? undefined : `livekit-host:${streamId}`;
  const sessionKey = `stream:${streamId}`;
  // Instant local media (clear self-view) before any network — single device owner.
  const media =
    options?.mediaStream ??
    (await acquireAppCamera(leaseId!, {
      audio: true,
      facingMode: 'user',
      exactFacing: false,
    }));

  noteHostRawPreviewReady();

  if (!canAttemptLiveKit()) {
    const err = new Error('LiveKit unavailable — local camera is ready.');
    (err as Error & { localStream?: MediaStream }).localStream = media;
    throw err;
  }

  setHostMediaState('connecting');
  const room = await connectHostLiveKitRoom(sessionKey, () => fetchLiveKitToken(streamId, 'host'));

  const video = media.getVideoTracks().find((track) => track.readyState === 'live') ?? null;
  const audio = media.getAudioTracks().find((track) => track.readyState === 'live') ?? null;

  noteHostPublishing();
  if (video) {
    await updateLiveKitLocalVideoTrack(room.localParticipant, video);
  }
  if (audio) {
    await updateLiveKitLocalAudioTrack(room.localParticipant, audio);
  }
  noteHostTrackPublished();

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
    const activeKey = getActiveHostLiveKitRoomKey();
    if (activeKey?.startsWith('stream:')) {
      await disposeHostLiveKitRoom(activeKey);
    } else {
      room?.disconnect();
    }
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
