declare module "@workspace/livekit" {
  export function isLiveKitConfigured(): boolean;
  export function getLiveKitUrl(): string;
  export function streamRoomName(streamId: string): string;
  export function partyRoomName(roomId: string): string;
  export function chatCallRoomName(threadId: string, callKind?: "audio" | "video"): string;
  export function getRoomService(): import("livekit-server-sdk").RoomServiceClient | null;
  export function createLiveKitToken(options: {
    identity: string;
    name?: string;
    room: string;
    role?: "host" | "viewer";
    canPublish?: boolean;
    /** Invisible to other participants (admin silent watch). */
    hidden?: boolean;
  }): Promise<string>;
  export function ensureLiveKitRoom(roomName: string): Promise<boolean>;
  export function deleteLiveKitRoom(roomName: string): Promise<boolean>;
  export function pingLiveKit(): Promise<{
    ok: boolean;
    url?: string;
    reason?: string;
  }>;
}
