import { endHostMediaSession } from '../camera/hostMediaSession';
import { db } from '../db/localDb';
import { newLifecycleCommandId } from '../liveLifecycle';
import { refreshLiveCloudSurface } from '../liveCloudSurfaces';
import { endPartyRoom } from '../party/partyRoomsCloud';
import {
  endLivePk,
  endLiveRoom,
  stopStream,
  type LiveHostSummary,
  type LiveLifecycleRoomType,
} from '../platformApi';
import { setProfileLivePresence } from '../supabase/liveDiscovery';
import { markHostLiveEnded } from './hostLiveEndedRegistry';
import { signalLiveRoomEnded } from './liveControlEvents';
import { parsePkLiveMediaRef } from './pkLiveMediaRef';

function uniqueIds(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function liveEndedIdMatchesRoom(endedId: string, roomId: string): boolean {
  const a = endedId.trim();
  const b = roomId.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const parsedA = parsePkLiveMediaRef(a);
  const parsedB = parsePkLiveMediaRef(b);
  return (
    parsedA.lifecycleRoomId === b ||
    parsedA.mediaId === b ||
    parsedA.lifecycleRoomId === parsedB.lifecycleRoomId ||
    parsedA.mediaId === parsedB.mediaId
  );
}

/**
 * Canonical host End Live: terminate lifecycle, PK, party discovery, streams, and media.
 * Safe to call more than once for the same live.
 * Marks the room/host ended first so in-flight discovery heartbeats cannot resurrect the feed.
 */
export async function permanentlyEndHostLive(input: {
  roomId: string;
  hostUserId: string;
  expectedRoomVersion?: number;
  roomType?: LiveLifecycleRoomType;
  extraRoomIds?: Array<string | null | undefined>;
  streamIds?: Array<string | null | undefined>;
}): Promise<{
  roomVersion: number;
  roomState: string;
  summary: LiveHostSummary | null;
} | null> {
  const hostUserId = input.hostUserId.trim();
  const roomIds = uniqueIds([input.roomId, ...(input.extraRoomIds ?? [])]);
  const parsed = roomIds.map((id) => parsePkLiveMediaRef(id));
  const streamIds = uniqueIds([
    ...(input.streamIds ?? []),
    ...parsed.filter((ref) => ref.surface === 'stream').map((ref) => ref.mediaId),
  ]);

  for (const roomId of roomIds) {
    markHostLiveEnded(roomId, hostUserId);
  }
  for (const streamId of streamIds) {
    markHostLiveEnded(streamId, hostUserId);
  }
  if (hostUserId) markHostLiveEnded(input.roomId, hostUserId);

  if (hostUserId) db.setUserLiveStatus(hostUserId, false);
  if (hostUserId) {
    await setProfileLivePresence(hostUserId, false).catch(() => undefined);
  }

  let last: { roomVersion: number; roomState: string; summary: LiveHostSummary | null } | null = null;
  let cloudEndOk = false;
  for (const roomId of roomIds) {
    await endLivePk(roomId, { commandId: newLifecycleCommandId('pkend') }).catch(() => undefined);
    try {
      const result = await endLiveRoom(roomId, {
        commandId: newLifecycleCommandId('end'),
        expectedRoomVersion: input.expectedRoomVersion,
        reason: 'host_selected_end',
        roomType: input.roomType,
      });
      last = {
        roomVersion: result.roomVersion,
        roomState: result.roomState,
        summary: result.summary,
      };
      cloudEndOk = true;
    } catch {
      /* still tear down discovery + media */
    }
    if (hostUserId) {
      try {
        await endPartyRoom(roomId, hostUserId);
        cloudEndOk = true;
      } catch {
        /* retry below */
      }
    }
  }

  await Promise.all(streamIds.map((streamId) => stopStream(streamId).catch(() => undefined)));
  await endHostMediaSession('ended').catch(() => undefined);

  // Beat any in-flight syncPartyRoomToCloud upsert that started before End Live.
  if (hostUserId) {
    await Promise.all(
      roomIds.map((roomId) => endPartyRoom(roomId, hostUserId).catch(() => undefined)),
    );
    await setProfileLivePresence(hostUserId, false).catch(() => undefined);
    db.setUserLiveStatus(hostUserId, false);
  }

  // Second-pass presence clear if the first cloud end path soft-failed.
  if (!cloudEndOk && hostUserId) {
    await setProfileLivePresence(hostUserId, false).catch(() => undefined);
    await Promise.all(
      roomIds.map((roomId) => endPartyRoom(roomId, hostUserId).catch(() => undefined)),
    );
  }

  for (const roomId of uniqueIds([...roomIds, ...streamIds])) {
    signalLiveRoomEnded(roomId);
    markHostLiveEnded(roomId, hostUserId);
  }

  if (typeof window !== 'undefined') {
    refreshLiveCloudSurface('live', { force: true });
    refreshLiveCloudSurface('party', { force: true });
  }

  return last;
}
