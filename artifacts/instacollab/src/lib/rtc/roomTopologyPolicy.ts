/**
 * Provider-neutral room topology policies (TypeScript mirror of lib/rtc/roomTopologyPolicy.mjs).
 */

export type RoomTopology =
  | 'LIVE'
  | 'AUDIO_LIVE'
  | 'MULTI_GUEST'
  | 'PK'
  | 'CALL_1TO1'
  | 'CALL_GROUP'
  | 'GAME_LIVE'
  | 'WATCH';

export type RoomTopologyPolicy = {
  topology: RoomTopology;
  maxAudienceParticipants: number;
  maxPublishers: number;
  emptyTimeoutSec: number;
  notes: string;
};

export const ROOM_TOPOLOGY_POLICIES: Record<RoomTopology, RoomTopologyPolicy> = {
  LIVE: {
    topology: 'LIVE',
    maxAudienceParticipants: 2000,
    maxPublishers: 1,
    emptyTimeoutSec: 300,
    notes: 'Solo / shop live — one host publisher, large audience',
  },
  AUDIO_LIVE: {
    topology: 'AUDIO_LIVE',
    maxAudienceParticipants: 500,
    maxPublishers: 1,
    emptyTimeoutSec: 300,
    notes: 'Audio-first live',
  },
  MULTI_GUEST: {
    topology: 'MULTI_GUEST',
    maxAudienceParticipants: 500,
    maxPublishers: 24,
    emptyTimeoutSec: 300,
    notes: 'Multi-guest seats up to configured layout (2–24)',
  },
  PK: {
    topology: 'PK',
    maxAudienceParticipants: 1000,
    maxPublishers: 12,
    emptyTimeoutSec: 180,
    notes: 'PK dual-room — publishers = mapped fighters',
  },
  CALL_1TO1: {
    topology: 'CALL_1TO1',
    maxAudienceParticipants: 4,
    maxPublishers: 2,
    emptyTimeoutSec: 120,
    notes: '1:1 call — tiny room',
  },
  CALL_GROUP: {
    topology: 'CALL_GROUP',
    maxAudienceParticipants: 16,
    maxPublishers: 12,
    emptyTimeoutSec: 180,
    notes: 'Group call',
  },
  GAME_LIVE: {
    topology: 'GAME_LIVE',
    maxAudienceParticipants: 300,
    maxPublishers: 8,
    emptyTimeoutSec: 300,
    notes: 'Game live room',
  },
  WATCH: {
    topology: 'WATCH',
    maxAudienceParticipants: 200,
    maxPublishers: 4,
    emptyTimeoutSec: 300,
    notes: 'Watch-together',
  },
};

export function inferTopologyFromRoomName(roomName: string): RoomTopology {
  const n = String(roomName || '');
  if (n.startsWith('ic-chat-call-')) return 'CALL_1TO1';
  if (n.includes('-pk-') || n.startsWith('ic-pk-')) return 'PK';
  if (n.startsWith('ic-stream-')) return 'LIVE';
  if (n.startsWith('ic-party-')) return 'MULTI_GUEST';
  return 'LIVE';
}

export function resolveRoomTopologyPolicy(
  topologyOrRoomName: RoomTopology | string,
): RoomTopologyPolicy {
  const key = String(topologyOrRoomName || '');
  if (key in ROOM_TOPOLOGY_POLICIES) {
    return ROOM_TOPOLOGY_POLICIES[key as RoomTopology];
  }
  return ROOM_TOPOLOGY_POLICIES[inferTopologyFromRoomName(key)];
}

export function liveKitCreateRoomOptions(
  roomName: string,
  topology?: RoomTopology,
): {
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  metadata: string;
} {
  const policy = topology
    ? ROOM_TOPOLOGY_POLICIES[topology]
    : resolveRoomTopologyPolicy(roomName);
  return {
    name: roomName,
    emptyTimeout: policy.emptyTimeoutSec,
    maxParticipants: policy.maxAudienceParticipants,
    metadata: JSON.stringify({
      unilivesTopology: policy.topology,
      maxPublishers: policy.maxPublishers,
    }),
  };
}
