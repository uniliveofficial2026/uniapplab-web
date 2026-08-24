import { CALL_STATES, permissionsForRole, asRtcRoomSessionId, asCanonicalUserId } from '@unilives/rtc-contracts';
import { createQoeGovernor } from '@unilives/rtc-qoe';

function nowIso() {
  return new Date().toISOString();
}

function mintId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Provider-neutral event envelope factory.
 * @param {Partial<import('@unilives/rtc-contracts').UniLiveEventEnvelope> & { eventType: string, lane: import('@unilives/rtc-contracts').EventLane, eventClass: import('@unilives/rtc-contracts').EventClass }} input
 */
export function createEventEnvelope(input) {
  return {
    eventId: input.eventId || mintId('evt'),
    eventType: input.eventType,
    schemaVersion: input.schemaVersion ?? 1,
    occurredAt: input.occurredAt || nowIso(),
    receivedAt: input.receivedAt,
    canonicalUserId: input.canonicalUserId,
    roomId: input.roomId,
    rtcParticipantSessionId: input.rtcParticipantSessionId,
    sequence: input.sequence,
    expiresAt: input.expiresAt,
    replayPolicy: input.replayPolicy || 'once',
    lane: input.lane,
    eventClass: input.eventClass,
    properties: input.properties || {},
  };
}

/**
 * Room orchestrator — domain ownership of room lifecycle (provider-neutral).
 */
export function createRoomOrchestrator({ provider }) {
  /** @type {Map<string, any>} */
  const rooms = new Map();

  return {
    /**
     * @param {{ roomId: string, roomType: import('@unilives/rtc-contracts').UniLiveRoomType, hostUserId: string }} input
     */
    createRoom(input) {
      const roomSessionId = asRtcRoomSessionId(mintId('rrs'));
      const row = {
        roomId: input.roomId,
        roomType: input.roomType,
        hostUserId: asCanonicalUserId(input.hostUserId),
        roomSessionId,
        state: 'live',
        createdAt: nowIso(),
        participants: new Map(),
      };
      rooms.set(input.roomId, row);
      return row;
    },
    getRoom(roomId) {
      return rooms.get(roomId) || null;
    },
    async join({ roomId, token, url, canonicalUserId, role = 'viewer' }) {
      const room = rooms.get(roomId);
      if (!room) throw Object.assign(new Error('room_not_found'), { code: 'ROOM_NOT_FOUND' });
      const session = await provider.joinRoom({ roomName: roomId, token, url });
      room.participants.set(canonicalUserId, {
        canonicalUserId,
        role,
        participantSessionId: session.participants[0]?.participantSessionId,
        joinedAt: nowIso(),
      });
      return { room, session };
    },
    async leave({ roomId, canonicalUserId }) {
      const room = rooms.get(roomId);
      if (room) room.participants.delete(canonicalUserId);
      await provider.leaveRoom();
      return { ok: true };
    },
    async end(roomId) {
      rooms.delete(roomId);
      await provider.leaveRoom().catch(() => undefined);
      return { ok: true };
    },
  };
}

/**
 * Call orchestrator — preserves Stage A call domain states.
 */
export function createCallOrchestrator() {
  /** @type {Map<string, any>} */
  const calls = new Map();
  /** @type {Set<string>} */
  const seenSignals = new Set();

  function transition(call, next) {
    if (!CALL_STATES.includes(next)) throw new Error(`invalid_call_state:${next}`);
    call.state = next;
    call.updatedAt = nowIso();
    if (['ENDED', 'DECLINED', 'CANCELLED', 'BUSY', 'TIMED_OUT', 'MISSED', 'FAILED'].includes(next)) {
      call.endedAt = call.endedAt || nowIso();
    }
    return call;
  }

  return {
    create({ callerId, calleeId, kind = 'audio', callSessionId }) {
      const id = callSessionId || mintId('call');
      const row = {
        callSessionId: id,
        callerId: asCanonicalUserId(callerId),
        calleeId: asCanonicalUserId(calleeId),
        kind,
        state: 'CREATED',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        endedAt: null,
        historyWritten: false,
      };
      calls.set(id, row);
      return transition(row, 'RINGING');
    },
    get(callSessionId) {
      return calls.get(callSessionId) || null;
    },
    /**
     * Idempotent signal apply. Duplicate signalId ignored.
     */
    applySignal({ callSessionId, signalId, type }) {
      const dedupe = `${callSessionId}:${signalId || type}`;
      if (seenSignals.has(dedupe)) return { duplicate: true, call: calls.get(callSessionId) || null };
      seenSignals.add(dedupe);
      const call = calls.get(callSessionId);
      if (!call) return { duplicate: false, call: null, ignored: true };

      // Stale accept after cancel/end must not resurrect.
      if (type === 'accept' && ['CANCELLED', 'ENDED', 'TIMED_OUT', 'MISSED', 'FAILED'].includes(call.state)) {
        return { duplicate: false, call, ignored: true, reason: 'stale_accept' };
      }

      switch (type) {
        case 'accept':
          return { duplicate: false, call: transition(call, call.state === 'RINGING' ? 'ACCEPTED' : call.state) };
        case 'connecting':
          return { duplicate: false, call: transition(call, 'CONNECTING') };
        case 'connected':
          return { duplicate: false, call: transition(call, 'CONNECTED') };
        case 'reconnect':
          if (call.state === 'CONNECTED' || call.state === 'RECONNECTING') {
            return { duplicate: false, call: transition(call, 'RECONNECTING') };
          }
          return { duplicate: false, call, ignored: true };
        case 'recovered':
          return { duplicate: false, call: transition(call, 'CONNECTED') };
        case 'decline':
          return { duplicate: false, call: transition(call, 'DECLINED') };
        case 'cancel':
          return { duplicate: false, call: transition(call, 'CANCELLED') };
        case 'busy':
          return { duplicate: false, call: transition(call, 'BUSY') };
        case 'timeout':
          return { duplicate: false, call: transition(call, 'TIMED_OUT') };
        case 'missed':
          return { duplicate: false, call: transition(call, 'MISSED') };
        case 'hangup':
        case 'end':
          return { duplicate: false, call: transition(call, 'ENDED') };
        case 'fail':
          return { duplicate: false, call: transition(call, 'FAILED') };
        default:
          return { duplicate: false, call, ignored: true };
      }
    },
  };
}

/**
 * PK orchestrator — score from authoritative gift events only.
 */
export function createPkOrchestrator() {
  /** @type {Map<string, any>} */
  const sessions = new Map();
  /** @type {Set<string>} */
  const scoredEvents = new Set();

  return {
    start({ pkId, roomId, hostUserId, opponentUserId, durationSec = 180 }) {
      const id = pkId || mintId('pk');
      const row = {
        pkId: id,
        roomId,
        hostUserId: asCanonicalUserId(hostUserId),
        opponentUserId: asCanonicalUserId(opponentUserId),
        status: 'active',
        localScore: 0,
        opponentScore: 0,
        durationSec,
        startedAt: nowIso(),
        endsAt: new Date(Date.now() + durationSec * 1000).toISOString(),
        sequence: 0,
      };
      sessions.set(id, row);
      sessions.set(`room:${roomId}`, row);
      return row;
    },
    getByRoom(roomId) {
      return sessions.get(`room:${roomId}`) || null;
    },
    get(pkId) {
      return sessions.get(pkId) || null;
    },
    /**
     * Apply settled gift score once per giftEventId.
     */
    applyGiftScore({ roomId, recipientUserId, points, giftEventId }) {
      const pk = sessions.get(`room:${roomId}`);
      if (!pk || pk.status !== 'active') return { applied: false, reason: 'pk_not_active' };
      if (!giftEventId) return { applied: false, reason: 'missing_gift_event' };
      if (scoredEvents.has(giftEventId)) return { applied: false, duplicate: true, localScore: pk.localScore, opponentScore: pk.opponentScore };
      const recipient = asCanonicalUserId(recipientUserId);
      const add = Math.max(0, Math.floor(Number(points) || 0));
      if (add <= 0) return { applied: false, reason: 'zero_points' };
      if (recipient === pk.hostUserId) pk.localScore += add;
      else if (recipient === pk.opponentUserId) pk.opponentScore += add;
      else return { applied: false, reason: 'recipient_not_on_pk' };
      scoredEvents.add(giftEventId);
      pk.sequence += 1;
      return {
        applied: true,
        duplicate: false,
        localScore: pk.localScore,
        opponentScore: pk.opponentScore,
        sequence: pk.sequence,
      };
    },
    end(roomId) {
      const pk = sessions.get(`room:${roomId}`);
      if (!pk) return null;
      pk.status = 'ended';
      pk.endedAt = nowIso();
      return pk;
    },
  };
}

/**
 * Seat orchestrator — server-authorized seat occupancy.
 */
export function createSeatOrchestrator({ maxSeats = 6 } = {}) {
  /** @type {Map<string, any>} */
  const rooms = new Map();

  function ensure(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        roomId,
        seats: Array.from({ length: maxSeats }, (_, i) => ({
          seatIndex: i,
          occupantUserId: null,
          state: 'empty',
        })),
      });
    }
    return rooms.get(roomId);
  }

  return {
    get(roomId) {
      return ensure(roomId);
    },
    requestJoin({ roomId, userId, seatIndex }) {
      const room = ensure(roomId);
      const seat = room.seats[seatIndex];
      if (!seat) throw Object.assign(new Error('invalid_seat'), { code: 'INVALID_SEAT' });
      if (seat.occupantUserId) throw Object.assign(new Error('seat_taken'), { code: 'SEAT_TAKEN' });
      seat.state = 'requested';
      seat.pendingUserId = asCanonicalUserId(userId);
      return seat;
    },
    accept({ roomId, seatIndex, actorUserId }) {
      void actorUserId;
      const room = ensure(roomId);
      const seat = room.seats[seatIndex];
      if (!seat?.pendingUserId) throw Object.assign(new Error('no_pending'), { code: 'NO_PENDING' });
      seat.occupantUserId = seat.pendingUserId;
      seat.pendingUserId = null;
      seat.state = 'occupied';
      seat.permissions = permissionsForRole('guest');
      return seat;
    },
    remove({ roomId, seatIndex }) {
      const room = ensure(roomId);
      const seat = room.seats[seatIndex];
      if (!seat) return null;
      seat.occupantUserId = null;
      seat.pendingUserId = null;
      seat.state = 'empty';
      seat.permissions = null;
      return seat;
    },
  };
}

/**
 * Live orchestrator — host/viewer session without React authority.
 */
export function createLiveOrchestrator({ roomOrchestrator }) {
  return {
    async start({ roomId, hostUserId, roomType = 'LIVE', token, url }) {
      const room = roomOrchestrator.createRoom({ roomId, roomType, hostUserId });
      const joined = await roomOrchestrator.join({
        roomId,
        token,
        url,
        canonicalUserId: hostUserId,
        role: 'host',
      });
      return { ...joined, room };
    },
    async joinAsViewer({ roomId, userId, token, url }) {
      return roomOrchestrator.join({
        roomId,
        token,
        url,
        canonicalUserId: userId,
        role: 'viewer',
      });
    },
    async end({ roomId }) {
      return roomOrchestrator.end(roomId);
    },
  };
}

export function createRtcRuntime({ provider }) {
  const roomOrchestrator = createRoomOrchestrator({ provider });
  const callOrchestrator = createCallOrchestrator();
  const pkOrchestrator = createPkOrchestrator();
  const seatOrchestrator = createSeatOrchestrator();
  const liveOrchestrator = createLiveOrchestrator({ roomOrchestrator });
  const qoe = createQoeGovernor();
  return {
    provider,
    roomOrchestrator,
    callOrchestrator,
    pkOrchestrator,
    seatOrchestrator,
    liveOrchestrator,
    qoe,
    createEventEnvelope,
  };
}
