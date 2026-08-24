import type { ReactNode } from 'react';

export declare function UniLiveRTCProvider(props: {
  rtc: { joinRoom: Function };
  children: ReactNode;
}): ReactNode;

export declare function useUniLiveRTC(): { joinRoom: Function };

export declare function useRoom(config: {
  roomId: string;
  token: string;
  url: string;
  canonicalUserId: string;
  role?: string;
  autoJoin?: boolean;
}): {
  room: unknown;
  join: () => Promise<unknown>;
  leave: () => Promise<void>;
  error: unknown;
  connection: string;
};

export declare function useParticipants(room: unknown): unknown[];

export declare function useNetworkQuality(
  room: unknown,
  options?: { intervalMs?: number },
): unknown;

export declare function useLocalMedia(room: unknown): {
  cameraTrack: unknown;
  microphoneTrack: unknown;
  enableCamera: (track?: unknown) => Promise<unknown>;
  enableMicrophone: (track?: unknown) => Promise<unknown>;
  error: unknown;
};
