import { publishLiveRoomEvent, type LiveRoomEnvelope } from '../../lib/livekit/liveRoomBus';
import { persistAndBroadcastLiveRoomEvent } from '../../lib/party/partyRoomsCloud';
import type { PKFighter, PKMode, PKPayload } from './liveRoomTypes';

/** Unified cross-room PK is disabled — same-room 1v1/team PK via `liveRoomBus.emitPk` stays on. */
export const CROSS_ROOM_PK_ENABLED = false;

/** Same-room PK (1v1 + team) on Solo Live / Shop Live only — Party rooms excluded. */
export const SAME_ROOM_PK_ENABLED = true;

export function buildCrossRoomPkInvitePayload(input: {
  hostRoomId: string;
  hostRoomMode: string;
  opponentRoomId: string;
  opponentRoomMode: string;
  opponentUserId: string;
  opponentName: string;
  hostTeam: PKFighter[];
  opponentTeam: PKFighter[];
  mode?: PKMode;
  durationSec?: number;
}): PKPayload | null {
  if (!CROSS_ROOM_PK_ENABLED) return null;
  return {
    action: 'invite',
    crossRoom: true,
    hostRoomId: input.hostRoomId,
    hostRoomMode: input.hostRoomMode,
    opponentRoomId: input.opponentRoomId,
    opponentRoomMode: input.opponentRoomMode,
    opponentUserId: input.opponentUserId,
    opponentName: input.opponentName,
    mode: input.mode ?? 'single',
    teamA: input.hostTeam,
    teamB: input.opponentTeam,
    durationSec: input.durationSec ?? 180,
  };
}

export async function broadcastCrossRoomPkEvent(
  localRoomId: string,
  opponentRoomId: string,
  sender: { userId: string; userName: string },
  payload: PKPayload,
): Promise<void> {
  if (!CROSS_ROOM_PK_ENABLED) return;
  const body = payload as unknown as Record<string, unknown>;
  const publish =
    (roomId: string) => (envelope: Omit<LiveRoomEnvelope, 'v'>) =>
      publishLiveRoomEvent(roomId, envelope);

  await persistAndBroadcastLiveRoomEvent(
    localRoomId,
    {
      senderId: sender.userId,
      senderName: sender.userName,
      type: 'pk',
      payload: body,
    },
    publish(localRoomId),
  );

  if (opponentRoomId && opponentRoomId !== localRoomId) {
    await persistAndBroadcastLiveRoomEvent(
      opponentRoomId,
      {
        senderId: sender.userId,
        senderName: sender.userName,
        type: 'pk',
        payload: body,
      },
      publish(opponentRoomId),
    );
  }
}
