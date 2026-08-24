import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import type { ResolvedLiveExperienceSnapshot } from "./contracts";

/**
 * Media/realtime kernel. Snapshot/layout swaps must not remount this tree.
 * Room.tsx still uses RoomLiveMediaSession; this host is the registry boundary.
 */
export type LiveRoomKernelProps = {
  roomId: string;
  canonicalRoomType: string;
  snapshot: ResolvedLiveExperienceSnapshot;
  children: ReactNode;
};

type KernelValue = {
  roomId: string;
  connectionKey: string;
  snapshot: ResolvedLiveExperienceSnapshot;
  remountGeneration: number;
};

const LiveRoomKernelContext = createContext<KernelValue | null>(null);

export function LiveRoomKernel({ roomId, canonicalRoomType, snapshot, children }: LiveRoomKernelProps) {
  const connectionKey = `${roomId}:${canonicalRoomType}`;
  const remount = useRef(0);
  const lastKey = useRef(connectionKey);
  if (lastKey.current !== connectionKey) {
    lastKey.current = connectionKey;
    remount.current += 1;
  }
  const value = useMemo<KernelValue>(
    () => ({
      roomId,
      connectionKey,
      snapshot,
      remountGeneration: remount.current,
    }),
    [roomId, connectionKey, snapshot],
  );
  return (
    <LiveRoomKernelContext.Provider value={value}>
      <div data-live-kernel="" data-room-id={roomId} data-connection-key={connectionKey} data-remount={remount.current}>
        {children}
      </div>
    </LiveRoomKernelContext.Provider>
  );
}

export function useLiveRoomKernel(): KernelValue {
  const ctx = useContext(LiveRoomKernelContext);
  if (!ctx) throw new Error("useLiveRoomKernel requires LiveRoomKernel");
  return ctx;
}

export function liveKernelMustNotRemount(prevKey: string, nextKey: string, snapshotChanged: boolean): boolean {
  if (snapshotChanged && prevKey === nextKey) return true;
  return prevKey === nextKey;
}
