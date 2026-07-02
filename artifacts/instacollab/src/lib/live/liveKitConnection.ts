import { Room } from 'livekit-client';
import { fetchLiveKitToken } from '../platformApi';

export type LiveKitConnection = {
  room: Room;
  localStream: MediaStream;
  roomName: string;
};

export async function connectLiveKitHost(
  streamId: string,
  options?: { mediaStream?: MediaStream },
): Promise<LiveKitConnection> {
  const { token, url, roomName } = await fetchLiveKitToken(streamId, 'host');
  const room = new Room({ adaptiveStream: true, dynacast: true });
  await room.connect(url, token);

  const media =
    options?.mediaStream ??
    (await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));

  for (const track of media.getTracks()) {
    await room.localParticipant.publishTrack(track);
  }

  return { room, localStream: media, roomName };
}

export async function disconnectLiveKit(room: Room | null, localStream: MediaStream | null) {
  try {
    room?.disconnect();
  } catch {
    /* ignore */
  }
  localStream?.getTracks().forEach((t) => t.stop());
}
