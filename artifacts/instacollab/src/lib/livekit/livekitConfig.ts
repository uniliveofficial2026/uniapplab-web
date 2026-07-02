/** LiveKit real-time video — https://livekit.io */

export function getLiveKitUrl(): string {
  return String(import.meta.env.VITE_LIVEKIT_URL || '').trim();
}

export function isLiveKitConfigured(): boolean {
  const url = getLiveKitUrl();
  return Boolean(url && !/your|xxxx|placeholder|wss?:\/\/\.\.\./i.test(url));
}

export function streamRoomName(streamId: string): string {
  return `ic-stream-${streamId}`;
}

export function partyRoomName(roomId: string): string {
  return `ic-party-${roomId}`;
}
