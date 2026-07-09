/** LiveKit real-time video — https://livekit.io */

import { readIntegrationEnv } from '../integrationEnv';

export function getLiveKitUrl(): string {
  return readIntegrationEnv('VITE_LIVEKIT_URL');
}

export function isLiveKitConfigured(): boolean {
  const url = getLiveKitUrl();
  return Boolean(url && !/your|xxxx|placeholder|wss?:\/\/\.\.\./i.test(url));
}

export function streamRoomName(streamId: string): string {
  return `ic-stream-${streamId}`;
}
