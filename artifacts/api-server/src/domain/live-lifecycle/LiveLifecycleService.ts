import { emptyHostDashboard } from "./dashboardReducer.ts";
import {
  HOST_RECONNECT_GRACE_MS,
  LIVEKIT_CLEANUP_MAX_ATTEMPTS,
  assertTransition,
  canAcceptMutations,
  leaveConfirmationKey,
  resolveHostDeparturePolicy,
} from "./policy.ts";
import type {
  CanonicalLiveRoomType,
  EndLiveReason,
  EndLiveResult,
  EndLiveRoomCommand,
  EndPkCommand,
  EndPkResult,
  HostDeparturePolicy,
  LeaveLiveRoomCommand,
  LeaveResult,
  LiveHostDashboardDelta,
  LiveHostDashboardSnapshot,
  LiveHostSummary,
  LiveLifecycleOutboxJob,
  LiveParticipantSession,
  LivePkChallenge,
  LivePkSession,
  LiveRoomRecord,
  ParticipantRole,
  PkMediaSurface,
} from "./types.ts";
import { parsePkLiveMediaRef, resolvePkMediaSurface } from "./pkLiveMedia.ts";
import { LIVE_LIFECYCLE_COMMANDS } from "./types.ts";

export type LiveLifecycleActor = {
  userId: string;
  role: "user" | "streamer" | "admin";
};

type CommandRecord = {
  commandId: string;
  actionId: string;
  roomId: string;
  result: unknown;
};

type GiftInFlight = {
  commandId: string;
  roomId: string;
  receiverUserId?: string;
  settled: boolean;
};

type Store = {
  rooms: Map<string, LiveRoomRecord>;
  sessions: Map<string, LiveParticipantSession>;
  pk: Map<string, LivePkSession>;
  challenges: Map<string, LivePkChallenge>;
  commands: Map<string, CommandRecord>;
  dashboards: Map<string, LiveHostDashboardSnapshot>;
  deltas: Map<string, LiveHostDashboardDelta[]>;
  summaries: Map<string, LiveHostSummary>;
  outbox: Map<string, LiveLifecycleOutboxJob>;
  uniqueViewers: Map<string, Set<string>>;
  giftsInFlight: Map<string, GiftInFlight>;
  comments: Map<string, number>;
  reactions: Map<string, number>;
  shares: Map<string, number>;
  followers: Map<string, number>;
  seatRequests: Map<string, number>;
};

function nowIso(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function normalizePkTeamUserIds(
  values: Array<string | null | undefined> | undefined,
  captainUserId: string,
  maxMembers = 6,
): string[] {
  const captain = captainUserId.trim();
  const seen = new Set<string>();
  const ordered = [captain, ...(values ?? [])]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  const result: string[] = [];
  for (const userId of ordered) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    result.push(userId);
    if (result.length >= Math.max(1, maxMembers)) break;
  }
  return result;
}

function normalizeTeamPkSize(value: number | null | undefined): 2 | 3 | 4 | 6 {
  const numeric = Number(value);
  if (numeric >= 6) return 6;
  if (numeric >= 4) return 4;
  if (numeric >= 3) return 3;
  return 2;
}

function teamPkSizeError(size: 2 | 3 | 4 | 6): Error & { code: string; status: number } {
  const message = size === 6
    ? "team_pk_requires_six_members"
    : size === 4
      ? "team_pk_requires_four_members"
      : size === 3
        ? "team_pk_requires_three_members"
        : "team_pk_requires_two_members";
  return Object.assign(new Error(message), { code: "error.invalidInput", status: 400 });
}

export function createLiveLifecycleStore(): Store {
  return {
    rooms: new Map(),
    sessions: new Map(),
    pk: new Map(),
    challenges: new Map(),
    commands: new Map(),
    dashboards: new Map(),
    deltas: new Map(),
    summaries: new Map(),
    outbox: new Map(),
    uniqueViewers: new Map(),
    giftsInFlight: new Map(),
    comments: new Map(),
    reactions: new Map(),
    shares: new Map(),
    followers: new Map(),
    seatRequests: new Map(),
  };
}

export class LiveLifecycleService {
  private readonly store: Store;
  private readonly clock: () => number;

  constructor(
    store: Store = createLiveLifecycleStore(),
    clock: () => number = Date.now,
  ) {
    this.store = store;
    this.clock = clock;
  }

  ensureRoom(input: {
    roomId: string;
    roomType: CanonicalLiveRoomType;
    hostUserId: string;
    hasCanonicalCohostTransfer?: boolean;
    startedAt?: string;
  }): LiveRoomRecord {
    const existing = this.store.rooms.get(input.roomId);
    if (existing) {
      if (!Array.isArray(existing.pkRosterUserIds) || existing.pkRosterUserIds.length === 0) {
        existing.pkRosterUserIds = [existing.hostUserId];
      }
      return existing;
    }
    const startedAt = input.startedAt ?? nowIso(this.clock());
    const room: LiveRoomRecord = {
      roomId: input.roomId,
      roomType: input.roomType,
      hostUserId: input.hostUserId,
      version: 1,
      state: "live",
      startedAt,
      endedAt: null,
      endReason: null,
      endActorUserId: null,
      hostReconnectDeadlineAt: null,
      reconnectCount: 0,
      hasCanonicalCohostTransfer: Boolean(input.hasCanonicalCohostTransfer),
      pkRosterUserIds: [input.hostUserId],
    };
    this.store.rooms.set(input.roomId, room);
    this.store.dashboards.set(input.roomId, {
      ...emptyHostDashboard(input.roomId, startedAt),
      roomState: "live",
      roomVersion: 1,
    });
    this.store.uniqueViewers.set(input.roomId, new Set());
    this.store.deltas.set(input.roomId, []);
    return room;
  }

  /** Other live Solo/Shop hosts available for a real PK invite. */
  listLivePkHosts(excludeUserId: string): Array<{
    userId: string;
    roomId: string;
    roomType: CanonicalLiveRoomType;
    startedAt: string;
    isLive: boolean;
    isPkEligible: boolean;
    lastUpdated: string;
    supportedPkModes: ReadonlyArray<"pk_1v1" | "pk_team" | "live_sell">;
  }> {
    const self = excludeUserId.trim();
    const eligible = new Set<CanonicalLiveRoomType>(["solo_video", "solo_audio", "commerce"]);
    const hosts: Array<{
      userId: string;
      roomId: string;
      roomType: CanonicalLiveRoomType;
      startedAt: string;
      isLive: boolean;
      isPkEligible: boolean;
      lastUpdated: string;
      supportedPkModes: ReadonlyArray<"pk_1v1" | "pk_team" | "live_sell">;
    }> = [];
    for (const room of this.store.rooms.values()) {
      if (!eligible.has(room.roomType)) continue;
      if (!canAcceptMutations(room.state)) continue;
      if (!room.hostUserId || room.hostUserId === self) continue;
      if (this.activePk(room.roomId)) continue;
      hosts.push({
        userId: room.hostUserId,
        roomId: room.roomId,
        roomType: room.roomType,
        startedAt: room.startedAt,
        isLive: true,
        isPkEligible: true,
        lastUpdated: room.startedAt,
        supportedPkModes:
          room.roomType === "commerce"
            ? (["pk_1v1", "live_sell"] as const)
            : (["pk_1v1", "pk_team"] as const),
      });
    }
    const latest = new Map<string, (typeof hosts)[number]>();
    for (const host of hosts) {
      const prev = latest.get(host.userId);
      if (!prev || host.startedAt > prev.startedAt) latest.set(host.userId, host);
    }
    return [...latest.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  getRoom(roomId: string): LiveRoomRecord | null {
    return this.store.rooms.get(roomId) ?? null;
  }

  connectSession(input: {
    roomId: string;
    participantSessionId: string;
    userId: string;
    role: ParticipantRole;
    connectionId?: string;
    seated?: boolean;
  }): LiveParticipantSession {
    const room = this.requireRoom(input.roomId);
    if (!canAcceptMutations(room.state) && input.role !== "host") {
      throw Object.assign(new Error("room_not_accepting"), { code: "error.partyRoomEnded", status: 409 });
    }
    const existing = this.store.sessions.get(input.participantSessionId);
    if (existing && existing.roomId === input.roomId && !existing.disconnectedAt) {
      return existing;
    }
    if (
      input.role === "host" &&
      room.state === "host_reconnecting" &&
      input.userId === room.hostUserId
    ) {
      this.transition(room, "live");
      room.hostReconnectDeadlineAt = null;
      room.reconnectCount += 1;
      this.patchDashboard(room.roomId, { roomState: "live" });
    }
    const session: LiveParticipantSession = {
      participantSessionId: input.participantSessionId,
      roomId: input.roomId,
      userId: input.userId,
      role: input.role,
      connectionId: input.connectionId ?? input.participantSessionId,
      connectedAt: nowIso(this.clock()),
      disconnectedAt: null,
      seated: Boolean(input.seated),
    };
    this.store.sessions.set(session.participantSessionId, session);
    this.recordJoin(room, session);
    return session;
  }

  previewHostLeave(roomId: string, actor: LiveLifecycleActor): {
    policy: HostDeparturePolicy;
    confirmationKey: string;
    deadlineAt: string | null;
    roomVersion: number;
  } {
    const room = this.requireRoom(roomId);
    this.assertHostOrAdmin(room, actor);
    const policy = resolveHostDeparturePolicy({
      roomType: room.roomType,
      hasCanonicalCohostTransfer: room.hasCanonicalCohostTransfer,
      roomState: room.state,
    });
    return {
      policy,
      confirmationKey: leaveConfirmationKey({ role: "host", policy }),
      deadlineAt:
        policy === "host-reconnect-grace"
          ? nowIso(this.clock() + HOST_RECONNECT_GRACE_MS)
          : null,
      roomVersion: room.version,
    };
  }

  leave(
    roomId: string,
    actor: LiveLifecycleActor,
    command: LeaveLiveRoomCommand,
  ): LeaveResult {
    const cached = this.commandResult<LeaveResult>(command.commandId);
    if (cached) return cached;

    const room = this.requireRoom(roomId);
    if (command.expectedRoomVersion != null && command.expectedRoomVersion !== room.version) {
      throw Object.assign(new Error("stale_room_version"), { code: "error.conflict", status: 409 });
    }

    const session = this.store.sessions.get(command.participantSessionId);
    if (!session || session.roomId !== roomId) {
      throw Object.assign(new Error("unknown_session"), { code: "error.notFound", status: 404 });
    }
    if (session.userId !== actor.userId && actor.role !== "admin") {
      throw Object.assign(new Error("session_not_owned"), { code: "error.forbidden", status: 403 });
    }

    const role = session.role;
    let policy: ReturnType<typeof resolveHostDeparturePolicy> | null = null;
    let confirmationKey = leaveConfirmationKey({ role, policy: null });

    if (role === "host") {
      policy = resolveHostDeparturePolicy({
        roomType: room.roomType,
        hasCanonicalCohostTransfer: room.hasCanonicalCohostTransfer,
        roomState: room.state,
      });
      confirmationKey = leaveConfirmationKey({ role: "host", policy });
      if (policy === "end-required") {
        const result: LeaveResult = {
          commandId: command.commandId,
          actionId: LIVE_LIFECYCLE_COMMANDS.leave,
          roomId,
          roomVersion: room.version,
          roomState: room.state,
          role,
          hostDeparturePolicy: policy,
          hostReconnectDeadlineAt: null,
          ended: false,
          confirmationKey,
        };
        this.remember(command.commandId, LIVE_LIFECYCLE_COMMANDS.leave, roomId, result);
        return result;
      }
      this.disconnectSession(session);
      if (policy === "host-reconnect-grace" && room.state === "live") {
        this.transition(room, "host_reconnecting");
        room.hostReconnectDeadlineAt = nowIso(this.clock() + HOST_RECONNECT_GRACE_MS);
        room.version += 1;
        this.patchDashboard(roomId, {
          roomState: "host_reconnecting",
          roomVersion: room.version,
        });
      }
    } else {
      this.disconnectSession(session);
      if (role === "guest") session.seated = false;
    }

    this.reconcileAudience(roomId);
    const result: LeaveResult = {
      commandId: command.commandId,
      actionId: LIVE_LIFECYCLE_COMMANDS.leave,
      roomId,
      roomVersion: room.version,
      roomState: room.state,
      role,
      hostDeparturePolicy: policy,
      hostReconnectDeadlineAt: room.hostReconnectDeadlineAt,
      ended: false,
      confirmationKey,
    };
    this.remember(command.commandId, LIVE_LIFECYCLE_COMMANDS.leave, roomId, result);
    return result;
  }

  unexpectedDisconnect(roomId: string, participantSessionId: string): LiveRoomRecord | null {
    const room = this.store.rooms.get(roomId);
    if (!room || room.state === "ended" || room.state === "ending") return room ?? null;
    const session = this.store.sessions.get(participantSessionId);
    if (!session || session.roomId !== roomId) return room;
    this.disconnectSession(session);
    if (session.role === "host" && room.state === "live") {
      const policy = resolveHostDeparturePolicy({
        roomType: room.roomType,
        hasCanonicalCohostTransfer: room.hasCanonicalCohostTransfer,
        roomState: room.state,
      });
      if (policy === "host-reconnect-grace" || policy === "authorized-host-handoff") {
        this.transition(room, "host_reconnecting");
        room.hostReconnectDeadlineAt = nowIso(this.clock() + HOST_RECONNECT_GRACE_MS);
        room.version += 1;
        this.patchDashboard(roomId, { roomState: "host_reconnecting", roomVersion: room.version });
      }
    }
    this.reconcileAudience(roomId);
    return room;
  }

  expireHostGrace(roomId: string, actor: LiveLifecycleActor = { userId: "system", role: "admin" }): EndLiveResult | null {
    const room = this.store.rooms.get(roomId);
    if (!room || room.state !== "host_reconnecting") return null;
    const deadline = room.hostReconnectDeadlineAt ? Date.parse(room.hostReconnectDeadlineAt) : 0;
    if (deadline > this.clock()) return null;
    return this.endLive(roomId, actor, {
      commandId: `grace:${roomId}:${room.version}`,
      expectedRoomVersion: room.version,
      reason: "host_grace_expired",
    });
  }

  endLive(
    roomId: string,
    actor: LiveLifecycleActor,
    command: EndLiveRoomCommand,
  ): EndLiveResult {
    const cached = this.commandResult<EndLiveResult>(command.commandId);
    if (cached) return { ...cached, duplicate: true };

    const room = this.requireRoom(roomId);
    this.assertHostOrAdmin(room, actor);

    if (room.state === "ending" || room.state === "ended") {
      const result: EndLiveResult = {
        commandId: command.commandId,
        actionId: LIVE_LIFECYCLE_COMMANDS.end,
        roomId,
        roomVersion: room.version,
        roomState: room.state,
        duplicate: true,
        summary: this.store.summaries.get(roomId) ?? null,
        opponentRoomId: this.activePk(roomId)?.opponentRoomId ?? this.activePk(roomId)?.roomId ?? null,
        opponentStillLive: this.opponentStillLive(roomId),
      };
      this.remember(command.commandId, LIVE_LIFECYCLE_COMMANDS.end, roomId, result);
      return result;
    }

    if (command.expectedRoomVersion !== room.version) {
      throw Object.assign(new Error("stale_room_version"), { code: "error.conflict", status: 409 });
    }

    this.transition(room, "ending");
    room.endReason = command.reason;
    room.endActorUserId = actor.userId;
    room.endedAt = nowIso(this.clock());
    room.version += 1;
    room.hostReconnectDeadlineAt = null;

    const pk = this.activePk(roomId);
    const otherRoomId =
      pk && pk.roomId === roomId ? pk.opponentRoomId : pk?.roomId ?? null;
    if (pk && (pk.status === "active" || pk.status === "countdown" || pk.status === "invited" || pk.status === "accepted")) {
      pk.status = "cancelled";
      pk.version += 1;
      this.enqueueOutbox(roomId, "notify-pk-opponent", {
        opponentRoomId: otherRoomId,
        pkId: pk.id,
      });
    }

    this.enqueueOutbox(roomId, "delete-livekit-room", {
      livekitRoom: `ic-party-${roomId}`,
    });
    this.enqueueOutbox(roomId, "delete-livekit-room", {
      livekitRoom: `ic-stream-${roomId}`,
    });

    this.patchDashboard(roomId, {
      roomState: "ending",
      roomVersion: room.version,
      pk: pk
        ? { state: pk.status, localScore: pk.localScore, opponentScore: pk.opponentScore, endsAt: pk.endsAt }
        : undefined,
    });

    const summary = this.buildSummary(room, command.reason);
    this.store.summaries.set(roomId, summary);

    const result: EndLiveResult = {
      commandId: command.commandId,
      actionId: LIVE_LIFECYCLE_COMMANDS.end,
      roomId,
      roomVersion: room.version,
      roomState: room.state,
      duplicate: false,
      summary,
      opponentRoomId: otherRoomId,
      opponentStillLive: otherRoomId ? this.opponentStillLive(roomId, otherRoomId) : false,
    };
    this.remember(command.commandId, LIVE_LIFECYCLE_COMMANDS.end, roomId, result);

    const hostUserId = room.hostUserId;
    for (const other of [...this.store.rooms.values()]) {
      if (other.roomId === roomId) continue;
      if (other.hostUserId !== hostUserId) continue;
      if (other.state === "ending" || other.state === "ended") continue;
      try {
        this.endLive(other.roomId, actor, {
          commandId: `${command.commandId}:host:${other.roomId}`,
          expectedRoomVersion: other.version,
          reason: command.reason,
        });
      } catch {
        /* sibling live may already be torn down */
      }
    }

    return result;
  }

  /** Post-commit only: ending → ended after LiveKit cleanup succeeds. */
  completeEnding(roomId: string): LiveRoomRecord | null {
    const room = this.store.rooms.get(roomId);
    if (!room || room.state !== "ending") return room ?? null;
    this.transition(room, "ended");
    this.patchDashboard(roomId, { roomState: "ended", roomVersion: room.version });
    return room;
  }

  endPk(
    roomId: string,
    actor: LiveLifecycleActor,
    command: EndPkCommand,
  ): EndPkResult {
    const cached = this.commandResult<EndPkResult>(command.commandId);
    if (cached) return cached;

    const room = this.requireRoom(roomId);
    if (!canAcceptMutations(room.state)) {
      throw Object.assign(new Error("room_not_accepting"), { code: "error.partyRoomEnded", status: 409 });
    }
    this.expireDuePk(roomId);
    const pk = this.activePk(roomId) ?? this.latestPk(roomId);
    if (pk) {
      this.assertPkParticipantOrAdmin(pk, actor);
    } else {
      this.assertHostOrAdmin(room, actor);
    }
    if (!pk) {
      const empty: EndPkResult = {
        commandId: command.commandId,
        actionId: LIVE_LIFECYCLE_COMMANDS.pkEnd,
        roomId,
        pkId: null,
        pkStatus: null,
        roomState: room.state,
        opponentRoomId: null,
        opponentStillLive: false,
        localScore: null,
        opponentScore: null,
      };
      this.remember(command.commandId, LIVE_LIFECYCLE_COMMANDS.pkEnd, roomId, empty);
      return empty;
    }
    if (pk.status === "ended" || pk.status === "cancelled" || pk.status === "expired") {
      const already: EndPkResult = {
        commandId: command.commandId,
        actionId: LIVE_LIFECYCLE_COMMANDS.pkEnd,
        roomId,
        pkId: pk.id,
        pkStatus: pk.status,
        roomState: room.state,
        opponentRoomId: pk.opponentRoomId,
        opponentStillLive: pk.opponentRoomId ? this.opponentStillLive(roomId, pk.opponentRoomId) : false,
        localScore: pk.localScore,
        opponentScore: pk.opponentScore,
      };
      this.remember(command.commandId, LIVE_LIFECYCLE_COMMANDS.pkEnd, roomId, already);
      return already;
    }
    // Gift scoring bumps pk.version; clients often hold a stale snapshot. End PK must still succeed.
    void command.expectedPkVersion;
    pk.status = "ended";
    pk.endsAt = nowIso(this.clock());
    pk.version += 1;
    this.patchPkDashboards(pk);
    this.enqueueOutbox(roomId, "notify-pk-opponent", {
      opponentRoomId: pk.opponentRoomId,
      pkId: pk.id,
    });
    const result: EndPkResult = {
      commandId: command.commandId,
      actionId: LIVE_LIFECYCLE_COMMANDS.pkEnd,
      roomId,
      pkId: pk.id,
      pkStatus: pk.status,
      roomState: room.state,
      opponentRoomId: pk.opponentRoomId,
      opponentStillLive: pk.opponentRoomId ? this.opponentStillLive(roomId, pk.opponentRoomId) : false,
      localScore: pk.localScore,
      opponentScore: pk.opponentScore,
    };
    this.remember(command.commandId, LIVE_LIFECYCLE_COMMANDS.pkEnd, roomId, result);
    return result;
  }

  attachPk(input: {
    roomId: string;
    hostUserId?: string;
    opponentUserId?: string | null;
    opponentRoomId?: string | null;
    hostMediaId?: string | null;
    opponentMediaId?: string | null;
    hostMediaSurface?: PkMediaSurface | null;
    opponentMediaSurface?: PkMediaSurface | null;
    pkType: "pk_1v1" | "pk_team";
    teamSize?: 2 | 3 | 4 | 6;
    hostTeamUserIds?: string[];
    opponentTeamUserIds?: string[];
    liveSell?: boolean;
    status?: LivePkSession["status"];
    durationSec?: number;
    multiplier?: number;
    endsAt?: string | null;
  }): LivePkSession {
    const room = this.requireRoom(input.roomId);
    if (!canAcceptMutations(room.state)) {
      throw Object.assign(new Error("room_not_accepting"), { code: "error.partyRoomEnded", status: 409 });
    }
    const durationSec = Math.max(30, Math.min(3600, Math.floor(input.durationSec ?? 180)));
    const now = this.clock();
    const status = input.status ?? "active";
    const hostUserId = input.hostUserId?.trim() || room.hostUserId;
    const opponentUserId = input.opponentUserId?.trim() || null;
    const teamSize =
      input.pkType === "pk_team"
        ? normalizeTeamPkSize(
            input.teamSize ??
              Math.max(input.hostTeamUserIds?.length ?? 0, input.opponentTeamUserIds?.length ?? 0),
          )
        : 1;
    const hostTeamUserIds = normalizePkTeamUserIds(
      input.hostTeamUserIds,
      hostUserId,
      teamSize,
    );
    const opponentTeamUserIds = opponentUserId
      ? normalizePkTeamUserIds(
          input.opponentTeamUserIds,
          opponentUserId,
          teamSize,
        )
      : [];
    const memberScores = Object.fromEntries(
      [...hostTeamUserIds, ...opponentTeamUserIds].map((userId) => [userId, 0]),
    );
    const memberGiftCounts = Object.fromEntries(
      [...hostTeamUserIds, ...opponentTeamUserIds].map((userId) => [userId, 0]),
    );
    const pk: LivePkSession = {
      id: newId("pk"),
      roomId: input.roomId,
      hostUserId,
      opponentUserId,
      opponentRoomId: input.opponentRoomId ?? null,
      hostMediaId: input.hostMediaId?.trim() || parsePkLiveMediaRef(input.roomId).mediaId || null,
      opponentMediaId:
        input.opponentMediaId?.trim() ||
        (input.opponentRoomId ? parsePkLiveMediaRef(input.opponentRoomId).mediaId : null),
      hostMediaSurface: resolvePkMediaSurface(input.hostMediaSurface, input.roomId),
      opponentMediaSurface: input.opponentRoomId
        ? resolvePkMediaSurface(input.opponentMediaSurface, input.opponentRoomId)
        : input.opponentMediaSurface ?? null,
      pkType: input.pkType,
      teamSize,
      hostTeamUserIds,
      opponentTeamUserIds,
      memberScores,
      memberGiftCounts,
      liveSell: Boolean(input.liveSell) || room.roomType === "commerce",
      status,
      localScore: 0,
      opponentScore: 0,
      endsAt: input.endsAt ?? (status === "active" ? nowIso(now + durationSec * 1000) : null),
      startedAt: status === "active" ? nowIso(now) : null,
      durationSec,
      multiplier: Math.max(1, Math.min(99, Math.floor(input.multiplier ?? 1))),
      version: 1,
      sequence: 0,
    };
    this.store.pk.set(pk.id, pk);
    this.patchDashboard(input.roomId, {
      pk: { state: pk.status, localScore: 0, opponentScore: 0, endsAt: pk.endsAt },
    });
    return pk;
  }

  startPk(
    roomId: string,
    actor: LiveLifecycleActor,
    input: {
      opponentUserId?: string | null;
      opponentRoomId?: string | null;
      hostMediaId?: string | null;
      opponentMediaId?: string | null;
      hostMediaSurface?: PkMediaSurface | null;
      opponentMediaSurface?: PkMediaSurface | null;
      pkType?: "pk_1v1" | "pk_team";
      teamSize?: 2 | 3 | 4 | 6;
      hostTeamUserIds?: string[];
      opponentTeamUserIds?: string[];
      liveSell?: boolean;
      durationSec?: number;
      multiplier?: number;
    } = {},
  ): LivePkSession {
    const room = this.requireRoom(roomId);
    if (!canAcceptMutations(room.state)) {
      throw Object.assign(new Error("room_not_accepting"), { code: "error.partyRoomEnded", status: 409 });
    }
    this.assertHostOrAdmin(room, actor);
    const existing = this.activePk(roomId);
    if (existing) {
      if (input.opponentUserId?.trim() && !existing.opponentUserId) {
        existing.opponentUserId = input.opponentUserId.trim();
        existing.version += 1;
      }
      if (input.opponentRoomId?.trim() && !existing.opponentRoomId) {
        existing.opponentRoomId = input.opponentRoomId.trim();
        existing.version += 1;
      }
      if (input.hostMediaId?.trim() && !existing.hostMediaId) {
        existing.hostMediaId = input.hostMediaId.trim();
        existing.version += 1;
      }
      if (input.opponentMediaId?.trim() && !existing.opponentMediaId) {
        existing.opponentMediaId = input.opponentMediaId.trim();
        existing.version += 1;
      }
      if (input.hostMediaSurface && !existing.hostMediaSurface) {
        existing.hostMediaSurface = input.hostMediaSurface;
        existing.version += 1;
      }
      if (input.opponentMediaSurface && !existing.opponentMediaSurface) {
        existing.opponentMediaSurface = input.opponentMediaSurface;
        existing.version += 1;
      }
      if (input.pkType && existing.pkType !== input.pkType) {
        existing.pkType = input.pkType;
        existing.version += 1;
      }
      if (input.teamSize && existing.pkType === "pk_team") {
        existing.teamSize = normalizeTeamPkSize(input.teamSize);
        existing.version += 1;
      }
      if (input.hostTeamUserIds?.length) {
        existing.hostTeamUserIds = normalizePkTeamUserIds(
          input.hostTeamUserIds,
          existing.hostUserId,
          existing.pkType === "pk_team"
            ? normalizeTeamPkSize(Math.max(input.hostTeamUserIds.length, existing.opponentTeamUserIds.length))
            : 1,
        );
        existing.version += 1;
      }
      if (input.opponentTeamUserIds?.length && existing.opponentUserId) {
        existing.opponentTeamUserIds = normalizePkTeamUserIds(
          input.opponentTeamUserIds,
          existing.opponentUserId,
          existing.pkType === "pk_team"
            ? normalizeTeamPkSize(Math.max(input.opponentTeamUserIds.length, existing.hostTeamUserIds.length))
            : 1,
        );
        existing.version += 1;
      }
      for (const userId of [...existing.hostTeamUserIds, ...existing.opponentTeamUserIds]) {
        existing.memberScores[userId] ??= 0;
        existing.memberGiftCounts[userId] ??= 0;
      }
      return existing;
    }
    return this.attachPk({
      roomId,
      hostUserId: room.hostUserId,
      opponentUserId: input.opponentUserId ?? null,
      opponentRoomId: input.opponentRoomId ?? null,
      hostMediaId: input.hostMediaId,
      opponentMediaId: input.opponentMediaId,
      hostMediaSurface: input.hostMediaSurface,
      opponentMediaSurface: input.opponentMediaSurface,
      pkType: input.pkType ?? (room.roomType === "pk_team" ? "pk_team" : "pk_1v1"),
      teamSize: input.teamSize,
      hostTeamUserIds: input.hostTeamUserIds,
      opponentTeamUserIds: input.opponentTeamUserIds,
      liveSell: input.liveSell,
      status: "active",
      durationSec: input.durationSec,
      multiplier: input.multiplier,
    });
  }

  getPkSnapshot(roomId: string): {
    roomId: string;
    roomState: string;
    hostUserId: string;
    pk: LivePkSession | null;
  } {
    const room = this.store.rooms.get(roomId);
    if (!room) {
      throw Object.assign(new Error("room_not_found"), { code: "error.notFound", status: 404 });
    }
    this.expireDuePk(roomId);
    const active = this.activePk(roomId);
    const latest = active ?? this.latestPk(roomId);
    return {
      roomId: room.roomId,
      roomState: room.state,
      hostUserId: latest?.hostUserId ?? room.hostUserId,
      pk: latest,
    };
  }

  expirePendingChallenges(nowMs = this.clock()): LivePkChallenge[] {
    const expired: LivePkChallenge[] = [];
    for (const challenge of this.store.challenges.values()) {
      if (challenge.status !== "pending") continue;
      if (Date.parse(challenge.expiresAt) > nowMs) continue;
      challenge.status = "expired";
      challenge.version += 1;
      expired.push(challenge);
    }
    return expired;
  }

  createChallenge(
    actor: LiveLifecycleActor,
    input: {
      hostRoomId: string;
      challengerRoomId: string;
      hostUserId?: string | null;
      pkType?: "pk_1v1" | "pk_team";
      challengerTeamUserIds?: string[];
      teamSize?: 2 | 3 | 4 | 6;
      liveSell?: boolean;
      hostMediaId?: string | null;
      challengerMediaId?: string | null;
      hostMediaSurface?: PkMediaSurface | null;
      challengerMediaSurface?: PkMediaSurface | null;
      durationSec?: number;
      ttlSec?: number;
    },
  ): LivePkChallenge {
    this.expirePendingChallenges();
    const hostRef = parsePkLiveMediaRef(input.hostRoomId);
    const challengerRef = parsePkLiveMediaRef(input.challengerRoomId);
    const hostRoomId = hostRef.lifecycleRoomId;
    const challengerRoomId = challengerRef.lifecycleRoomId;
    const hostMediaId = input.hostMediaId?.trim() || hostRef.mediaId;
    const challengerMediaId = input.challengerMediaId?.trim() || challengerRef.mediaId;
    const hostMediaSurface = resolvePkMediaSurface(input.hostMediaSurface, input.hostRoomId);
    const challengerMediaSurface = resolvePkMediaSurface(
      input.challengerMediaSurface,
      input.challengerRoomId,
    );
    if (!hostRoomId || !challengerRoomId || hostRoomId === challengerRoomId) {
      throw Object.assign(new Error("invalid_challenge_rooms"), { code: "error.invalidInput", status: 400 });
    }
    let challengerRoom = this.store.rooms.get(challengerRoomId);
    if (!challengerRoom) {
      challengerRoom = this.ensureRoom({
        roomId: challengerRoomId,
        roomType: "solo_video",
        hostUserId: actor.userId,
      });
    }
    this.assertHostOrAdmin(challengerRoom, actor);
    if (!canAcceptMutations(challengerRoom.state)) {
      throw Object.assign(new Error("challenger_room_not_live"), { code: "error.partyRoomEnded", status: 409 });
    }
    let hostRoom = this.store.rooms.get(hostRoomId);
    const hostUserId = (input.hostUserId?.trim() || hostRoom?.hostUserId || "").trim();
    if (!hostUserId) {
      throw Object.assign(new Error("host_user_required"), { code: "error.invalidInput", status: 400 });
    }
    if (hostUserId === actor.userId) {
      throw Object.assign(new Error("cannot_challenge_self"), { code: "error.invalidInput", status: 400 });
    }
    if (!hostRoom) {
      throw Object.assign(new Error("host_room_not_live"), { code: "error.notFound", status: 404 });
    }
    if (hostRoom.hostUserId !== hostUserId) {
      throw Object.assign(new Error("host_mismatch"), { code: "error.conflict", status: 409 });
    }
    if (!canAcceptMutations(hostRoom.state)) {
      throw Object.assign(new Error("host_room_not_live"), { code: "error.partyRoomEnded", status: 409 });
    }
    if (this.activePk(hostRoomId) || this.activePk(challengerRoomId)) {
      throw Object.assign(new Error("pk_already_active"), { code: "error.conflict", status: 409 });
    }
    for (const existing of this.store.challenges.values()) {
      if (existing.status !== "pending") continue;
      if (
        existing.hostRoomId === hostRoomId ||
        existing.challengerRoomId === challengerRoomId ||
        (existing.hostUserId === hostUserId && existing.challengerUserId === actor.userId)
      ) {
        existing.status = "cancelled";
        existing.version += 1;
      }
    }
    const now = this.clock();
    const ttlSec = Math.max(10, Math.min(120, Math.floor(input.ttlSec ?? 30)));
    const durationSec = Math.max(30, Math.min(3600, Math.floor(input.durationSec ?? 180)));
    const pkType = input.pkType === "pk_team" ? "pk_team" : "pk_1v1";
    const requestedTeamRosterSize: 2 | 3 | 4 | 6 = normalizeTeamPkSize(
      input.teamSize ?? input.challengerTeamUserIds?.length ?? 2,
    );
    const requestedTeamSize: 1 | 2 | 3 | 4 | 6 = pkType === "pk_team" ? requestedTeamRosterSize : 1;
    const challengerTeamUserIds =
      pkType === "pk_team"
        ? this.verifiedPkTeamRoster(
            challengerRoomId,
            actor.userId,
            input.challengerTeamUserIds,
            requestedTeamRosterSize,
          )
        : normalizePkTeamUserIds(input.challengerTeamUserIds, actor.userId, 1);
    if (pkType === "pk_team") {
      const requestedNormalized = normalizePkTeamUserIds(
        input.challengerTeamUserIds,
        actor.userId,
        requestedTeamRosterSize,
      );
      const dropped = requestedNormalized.filter((userId) => !challengerTeamUserIds.includes(userId));
      const soloCaptainLed =
        challengerRoom.roomType === "solo_video" &&
        challengerTeamUserIds.length >= 1 &&
        challengerTeamUserIds.length <= requestedTeamRosterSize;
      if (dropped.length || (challengerTeamUserIds.length !== requestedTeamRosterSize && !soloCaptainLed)) {
        throw teamPkSizeError(requestedTeamRosterSize);
      }
    }
    const challenge: LivePkChallenge = {
      id: newId("pkc"),
      hostRoomId,
      challengerRoomId,
      hostUserId,
      challengerUserId: actor.userId,
      pkType,
      challengerTeamUserIds,
      teamSize: requestedTeamSize,
      liveSell: Boolean(input.liveSell) || hostRoom.roomType === "commerce" || challengerRoom.roomType === "commerce",
      hostMediaId: hostMediaId || null,
      challengerMediaId: challengerMediaId || null,
      hostMediaSurface,
      challengerMediaSurface,
      status: "pending",
      createdAt: nowIso(now),
      expiresAt: nowIso(now + ttlSec * 1000),
      durationSec,
      version: 1,
      pkId: null,
    };
    this.store.challenges.set(challenge.id, challenge);
    return challenge;
  }

  getChallenge(challengeId: string): LivePkChallenge | null {
    this.expirePendingChallenges();
    return this.store.challenges.get(challengeId) ?? null;
  }

  getChallengeInbox(userId: string): {
    incoming: LivePkChallenge | null;
    outgoing: LivePkChallenge | null;
    activePk: LivePkSession | null;
  } {
    this.expirePendingChallenges();
    this.expireDuePkSessions();
    const uid = userId.trim();
    const pending = [...this.store.challenges.values()].filter((c) => c.status === "pending");
    return {
      incoming: pending.find((c) => c.hostUserId === uid) ?? null,
      outgoing: pending.find((c) => c.challengerUserId === uid) ?? null,
      activePk:
        [...this.store.pk.values()].find(
          (pk) =>
            (
              pk.hostUserId === uid ||
              pk.opponentUserId === uid ||
              pk.hostTeamUserIds.includes(uid) ||
              pk.opponentTeamUserIds.includes(uid)
            ) &&
            (pk.status === "active" || pk.status === "countdown" || pk.status === "accepted"),
        ) ?? null,
    };
  }

  acceptChallenge(
    actor: LiveLifecycleActor,
    challengeId: string,
    input: { hostTeamUserIds?: string[] } = {},
  ): { challenge: LivePkChallenge; pk: LivePkSession } {
    this.expirePendingChallenges();
    const challenge = this.requireChallenge(challengeId);
    if (challenge.status === "accepted" && challenge.pkId) {
      const existing = this.store.pk.get(challenge.pkId);
      if (existing) return { challenge, pk: existing };
    }
    this.assertChallengeHost(challenge, actor);
    if (challenge.status === "expired") {
      throw Object.assign(new Error("challenge_expired"), { code: "error.conflict", status: 409 });
    }
    if (challenge.status !== "pending") {
      throw Object.assign(new Error("challenge_not_pending"), { code: "error.conflict", status: 409 });
    }
    const hostRoom = this.requireRoom(challenge.hostRoomId);
    const challengerRoom = this.requireRoom(challenge.challengerRoomId);
    if (!canAcceptMutations(hostRoom.state) || !canAcceptMutations(challengerRoom.state)) {
      throw Object.assign(new Error("room_not_live"), { code: "error.partyRoomEnded", status: 409 });
    }
    if (this.activePk(challenge.hostRoomId) || this.activePk(challenge.challengerRoomId)) {
      throw Object.assign(new Error("pk_already_active"), { code: "error.conflict", status: 409 });
    }
    const hostTeamUserIds =
      challenge.pkType === "pk_team"
        ? this.verifiedPkTeamRoster(
            challenge.hostRoomId,
            challenge.hostUserId,
            input.hostTeamUserIds,
            challenge.teamSize === 6 ? 6 : challenge.teamSize === 4 ? 4 : challenge.teamSize === 3 ? 3 : 2,
          )
        : normalizePkTeamUserIds(input.hostTeamUserIds, challenge.hostUserId, 1);
    const acceptTeamSize = challenge.teamSize === 6 ? 6 : challenge.teamSize === 4 ? 4 : challenge.teamSize === 3 ? 3 : 2;
    if (challenge.pkType === "pk_team") {
      const requestedNormalized = normalizePkTeamUserIds(
        input.hostTeamUserIds,
        challenge.hostUserId,
        acceptTeamSize,
      );
      const dropped = requestedNormalized.filter((userId) => !hostTeamUserIds.includes(userId));
      const soloCaptainLed =
        hostRoom.roomType === "solo_video" &&
        hostTeamUserIds.length >= 1 &&
        hostTeamUserIds.length <= acceptTeamSize;
      if (dropped.length || (hostTeamUserIds.length !== acceptTeamSize && !soloCaptainLed)) {
        throw teamPkSizeError(acceptTeamSize);
      }
    }
    const pk = this.startPk(challenge.hostRoomId, actor, {
      opponentUserId: challenge.challengerUserId,
      opponentRoomId: challenge.challengerRoomId,
      hostMediaId: challenge.hostMediaId,
      opponentMediaId: challenge.challengerMediaId,
      hostMediaSurface: challenge.hostMediaSurface,
      opponentMediaSurface: challenge.challengerMediaSurface,
      pkType: challenge.pkType,
      teamSize: challenge.pkType === "pk_team" ? acceptTeamSize : undefined,
      hostTeamUserIds,
      opponentTeamUserIds: challenge.challengerTeamUserIds,
      liveSell: challenge.liveSell,
      durationSec: challenge.durationSec,
      multiplier: challenge.pkType === "pk_team" ? 2 : 1,
    });
    challenge.status = "accepted";
    challenge.pkId = pk.id;
    challenge.version += 1;
    return { challenge, pk };
  }

  declineChallenge(actor: LiveLifecycleActor, challengeId: string): LivePkChallenge {
    this.expirePendingChallenges();
    const challenge = this.requireChallenge(challengeId);
    this.assertChallengeHost(challenge, actor);
    if (challenge.status === "declined") return challenge;
    if (challenge.status === "accepted") {
      throw Object.assign(new Error("challenge_already_accepted"), { code: "error.conflict", status: 409 });
    }
    if (challenge.status !== "pending" && challenge.status !== "expired") {
      throw Object.assign(new Error("challenge_not_pending"), { code: "error.conflict", status: 409 });
    }
    challenge.status = "declined";
    challenge.version += 1;
    return challenge;
  }

  cancelChallenge(actor: LiveLifecycleActor, challengeId: string): LivePkChallenge {
    this.expirePendingChallenges();
    const challenge = this.requireChallenge(challengeId);
    if (actor.role !== "admin" && actor.userId !== challenge.challengerUserId) {
      throw Object.assign(new Error("challenger_required"), { code: "error.hostRequired", status: 403 });
    }
    if (challenge.status === "cancelled") return challenge;
    if (challenge.status !== "pending") {
      throw Object.assign(new Error("challenge_not_pending"), { code: "error.conflict", status: 409 });
    }
    challenge.status = "cancelled";
    challenge.version += 1;
    return challenge;
  }

  expireChallenge(challengeId: string): LivePkChallenge {
    this.expirePendingChallenges();
    const challenge = this.requireChallenge(challengeId);
    if (challenge.status === "expired") return challenge;
    if (challenge.status !== "pending") {
      throw Object.assign(new Error("challenge_not_pending"), { code: "error.conflict", status: 409 });
    }
    if (Date.parse(challenge.expiresAt) > this.clock()) {
      throw Object.assign(new Error("challenge_not_expired"), { code: "error.conflict", status: 409 });
    }
    challenge.status = "expired";
    challenge.version += 1;
    return challenge;
  }

  applyPkGiftScore(
    roomId: string,
    recipientUserId: string,
    points: number,
    eventId: string,
  ): {
    applied: boolean;
    duplicate: boolean;
    sequence: number;
    previousSequence: number;
    localScore: number | null;
    opponentScore: number | null;
    hostUserId: string | null;
    opponentUserId: string | null;
  } {
    const pk = this.activePk(roomId);
    const empty = {
      applied: false,
      duplicate: false,
      sequence: pk?.sequence ?? 0,
      previousSequence: pk?.sequence ?? 0,
      localScore: pk?.localScore ?? null,
      opponentScore: pk?.opponentScore ?? null,
      hostUserId: pk?.hostUserId ?? null,
      opponentUserId: pk?.opponentUserId ?? null,
    };
    if (!pk || pk.status !== "active") return empty;
    const dedupeKey = `pkscore:${eventId}`;
    if (this.store.commands.has(dedupeKey)) {
      return { ...empty, duplicate: true };
    }
    const recipient = recipientUserId.trim();
    let side: "local" | "opponent" | null = null;
    if (recipient && (recipient === pk.hostUserId || pk.hostTeamUserIds.includes(recipient))) side = "local";
    else if (
      recipient &&
      ((pk.opponentUserId && recipient === pk.opponentUserId) || pk.opponentTeamUserIds.includes(recipient))
    ) side = "opponent";
    if (!side) return empty;
    const basePoints = Math.max(0, Math.floor(points));
    const add = basePoints * Math.max(1, Math.floor(pk.multiplier || 1));
    if (add <= 0) return empty;
    const previousSequence = pk.sequence;
    if (side === "local") pk.localScore += add;
    else pk.opponentScore += add;
    pk.memberScores[recipient] = (pk.memberScores[recipient] ?? 0) + add;
    pk.memberGiftCounts[recipient] = (pk.memberGiftCounts[recipient] ?? 0) + 1;
    pk.sequence += 1;
    pk.version += 1;
    this.remember(dedupeKey, "live.pk.score", roomId, true);
    this.patchDashboard(roomId, {
      pk: {
        state: pk.status,
        localScore: pk.localScore,
        opponentScore: pk.opponentScore,
        endsAt: pk.endsAt,
      },
    });
    return {
      applied: true,
      duplicate: false,
      sequence: pk.sequence,
      previousSequence,
      localScore: pk.localScore,
      opponentScore: pk.opponentScore,
      hostUserId: pk.hostUserId,
      opponentUserId: pk.opponentUserId,
    };
  }

  rejectIfEnding(roomId: string, kind: "seat" | "pk" | "comment" | "gift" | "moderation"): void {
    const room = this.store.rooms.get(roomId);
    if (!room) return;
    if (canAcceptMutations(room.state)) return;
    throw Object.assign(new Error(`${kind}_rejected_while_ending`), {
      code: "error.partyRoomEnded",
      status: 409,
    });
  }

  beginGiftSettlement(roomId: string, giftCommandId: string, receiverUserId?: string): void {
    const existing = this.store.giftsInFlight.get(giftCommandId);
    if (existing) {
      if (receiverUserId?.trim() && !existing.receiverUserId) existing.receiverUserId = receiverUserId.trim();
      return;
    }
    this.rejectIfEnding(roomId, "gift");
    this.store.giftsInFlight.set(giftCommandId, {
      commandId: giftCommandId,
      roomId,
      receiverUserId: receiverUserId?.trim() || undefined,
      settled: false,
    });
  }

  completeGiftSettlement(giftCommandId: string, value: number, receiverUserId?: string): void {
    const row = this.store.giftsInFlight.get(giftCommandId);
    if (!row || row.settled) return;
    row.settled = true;
    if (receiverUserId?.trim() && !row.receiverUserId) row.receiverUserId = receiverUserId.trim();
    const dash = this.store.dashboards.get(row.roomId);
    if (!dash) return;
    this.patchDashboard(row.roomId, {
      gifts: {
        confirmedGiftCount: dash.gifts.confirmedGiftCount + 1,
        confirmedGrossGiftValue: (dash.gifts.confirmedGrossGiftValue ?? 0) + value,
        settlementState: "confirmed",
      },
    });
    const recipient = row.receiverUserId?.trim();
    if (recipient && value > 0) {
      this.applyPkGiftScore(row.roomId, recipient, value, giftCommandId);
    }
  }

  recordComment(roomId: string): void {
    this.rejectIfEnding(roomId, "comment");
    const room = this.requireRoom(roomId);
    const next = (this.store.comments.get(roomId) ?? 0) + 1;
    this.store.comments.set(roomId, next);
    const elapsedMin = Math.max(1 / 60, (this.clock() - Date.parse(room.startedAt)) / 60_000);
    this.patchDashboard(roomId, {
      engagement: { comments: next, commentsPerMinute: Math.round(next / elapsedMin) },
    });
  }

  recordReaction(roomId: string, count = 1): void {
    if (!this.store.rooms.get(roomId) || !canAcceptMutations(this.store.rooms.get(roomId)!.state)) return;
    const add = Math.max(1, Math.min(200, Math.floor(Number(count) || 1)));
    const next = (this.store.reactions.get(roomId) ?? 0) + add;
    this.store.reactions.set(roomId, next);
    this.patchDashboard(roomId, { engagement: { reactions: next } });
  }

  recordShare(roomId: string): void {
    const next = (this.store.shares.get(roomId) ?? 0) + 1;
    this.store.shares.set(roomId, next);
    this.patchDashboard(roomId, { engagement: { shares: next } });
  }

  recordFollowerGained(roomId: string): void {
    const next = (this.store.followers.get(roomId) ?? 0) + 1;
    this.store.followers.set(roomId, next);
    this.patchDashboard(roomId, { engagement: { followersGained: next } });
  }

  setSeatRequests(roomId: string, count: number): void {
    this.rejectIfEnding(roomId, "seat");
    this.store.seatRequests.set(roomId, count);
    const dash = this.store.dashboards.get(roomId);
    this.patchDashboard(roomId, {
      participants: { pendingSeatRequests: count, connected: dash?.participants.connected ?? 0, seated: dash?.participants.seated ?? 0 },
    });
  }

  setMediaTelemetry(
    roomId: string,
    media: Partial<LiveHostDashboardSnapshot["media"]>,
  ): void {
    const dash = this.store.dashboards.get(roomId);
    if (!dash) return;
    this.patchDashboard(roomId, { media: { ...dash.media, ...media } });
  }

  /** Host-reported occupancy from the live UI (more accurate than session map alone). */
  ingestAudienceSnapshot(
    roomId: string,
    actor: LiveLifecycleActor,
    audience: {
      currentUniqueViewers?: number;
      currentConnections?: number;
      seated?: number;
      pendingSeatRequests?: number;
    },
  ): LiveHostDashboardSnapshot {
    const room = this.requireRoom(roomId);
    this.assertHostOrAdmin(room, actor);
    const dash = this.store.dashboards.get(roomId);
    if (!dash) return this.cloneDashboard(roomId);
    const currentUnique = Math.max(0, Math.floor(audience.currentUniqueViewers ?? dash.audience.currentUniqueViewers));
    const connections = Math.max(0, Math.floor(audience.currentConnections ?? currentUnique));
    const seated = Math.max(0, Math.floor(audience.seated ?? dash.participants.seated));
    const pending = Math.max(0, Math.floor(audience.pendingSeatRequests ?? dash.participants.pendingSeatRequests));
    const unique = this.store.uniqueViewers.get(roomId) ?? new Set<string>();
    this.patchDashboard(roomId, {
      audience: {
        currentConnections: connections,
        currentUniqueViewers: currentUnique,
        peakConcurrentViewers: Math.max(dash.audience.peakConcurrentViewers, currentUnique, connections),
        uniqueViewers: Math.max(dash.audience.uniqueViewers, unique.size, currentUnique),
        joins: dash.audience.joins,
        leaves: dash.audience.leaves,
      },
      participants: {
        connected: connections,
        seated,
        pendingSeatRequests: pending,
      },
    });
    return this.cloneDashboard(roomId);
  }

  getDashboard(roomId: string, actor: LiveLifecycleActor): LiveHostDashboardSnapshot {
    const room = this.requireRoom(roomId);
    this.assertHostOrAdmin(room, actor);
    return this.cloneDashboard(roomId);
  }

  getDeltas(roomId: string, afterSequence: number): LiveHostDashboardDelta[] {
    return (this.store.deltas.get(roomId) ?? []).filter((d) => d.sequence > afterSequence);
  }

  getSummary(roomId: string, actor: LiveLifecycleActor): LiveHostSummary | null {
    const room = this.requireRoom(roomId);
    this.assertHostOrAdmin(room, actor);
    return this.store.summaries.get(roomId) ?? null;
  }

  listOutbox(status: LiveLifecycleOutboxJob["status"] = "pending"): LiveLifecycleOutboxJob[] {
    return [...this.store.outbox.values()].filter((job) => job.status === status);
  }

  markOutboxDone(id: string): void {
    const job = this.store.outbox.get(id);
    if (!job) return;
    job.status = "done";
  }

  markOutboxFailed(id: string, error: string): void {
    const job = this.store.outbox.get(id);
    if (!job) return;
    job.attempts += 1;
    job.lastError = error;
    if (job.attempts >= LIVEKIT_CLEANUP_MAX_ATTEMPTS) job.status = "failed";
  }

  listSessions(roomId: string): LiveParticipantSession[] {
    return [...this.store.sessions.values()].filter((s) => s.roomId === roomId);
  }

  private requireRoom(roomId: string): LiveRoomRecord {
    const room = this.store.rooms.get(roomId);
    if (!room) {
      throw Object.assign(new Error("room_not_found"), { code: "error.notFound", status: 404 });
    }
    return room;
  }

  private assertHostOrAdmin(room: LiveRoomRecord, actor: LiveLifecycleActor): void {
    if (actor.role === "admin") return;
    if (actor.userId === room.hostUserId) return;
    throw Object.assign(new Error("host_required"), { code: "error.hostRequired", status: 403 });
  }

  private transition(room: LiveRoomRecord, to: LiveRoomRecord["state"]): void {
    if (!assertTransition(room.state, to)) {
      throw Object.assign(new Error(`illegal_transition:${room.state}->${to}`), {
        code: "error.conflict",
        status: 409,
      });
    }
    room.state = to;
  }

  private disconnectSession(session: LiveParticipantSession): void {
    if (session.disconnectedAt) return;
    session.disconnectedAt = nowIso(this.clock());
    session.seated = false;
  }

  private recordJoin(room: LiveRoomRecord, session: LiveParticipantSession): void {
    const unique = this.store.uniqueViewers.get(room.roomId) ?? new Set();
    unique.add(session.userId);
    this.store.uniqueViewers.set(room.roomId, unique);
    const dash = this.store.dashboards.get(room.roomId);
    if (!dash) return;
    const connections = this.liveConnections(room.roomId);
    const uniqueNow = this.liveUniqueUsers(room.roomId);
    this.patchDashboard(room.roomId, {
      audience: {
        currentConnections: connections,
        currentUniqueViewers: uniqueNow,
        peakConcurrentViewers: Math.max(dash.audience.peakConcurrentViewers, connections),
        uniqueViewers: unique.size,
        joins: dash.audience.joins + 1,
        leaves: dash.audience.leaves,
      },
      participants: {
        connected: connections,
        seated: this.seatedCount(room.roomId),
        pendingSeatRequests: this.store.seatRequests.get(room.roomId) ?? 0,
      },
    });
  }

  private reconcileAudience(roomId: string): void {
    const dash = this.store.dashboards.get(roomId);
    if (!dash) return;
    const connections = this.liveConnections(roomId);
    const uniqueNow = this.liveUniqueUsers(roomId);
    this.patchDashboard(roomId, {
      audience: {
        currentConnections: connections,
        currentUniqueViewers: uniqueNow,
        peakConcurrentViewers: dash.audience.peakConcurrentViewers,
        uniqueViewers: this.store.uniqueViewers.get(roomId)?.size ?? dash.audience.uniqueViewers,
        joins: dash.audience.joins,
        leaves: dash.audience.leaves + 1,
      },
      participants: {
        connected: connections,
        seated: this.seatedCount(roomId),
        pendingSeatRequests: this.store.seatRequests.get(roomId) ?? 0,
      },
    });
  }

  private liveConnections(roomId: string): number {
    return [...this.store.sessions.values()].filter((s) => s.roomId === roomId && !s.disconnectedAt).length;
  }

  private liveUniqueUsers(roomId: string): number {
    return new Set(
      [...this.store.sessions.values()]
        .filter((s) => s.roomId === roomId && !s.disconnectedAt)
        .map((s) => s.userId),
    ).size;
  }

  private seatedCount(roomId: string): number {
    return [...this.store.sessions.values()].filter((s) => s.roomId === roomId && s.seated && !s.disconnectedAt).length;
  }

  private activePk(roomId: string): LivePkSession | null {
    this.expireDuePk(roomId);
    return (
      [...this.store.pk.values()].find(
        (pk) =>
          (pk.roomId === roomId || pk.opponentRoomId === roomId) &&
          (pk.status === "active" || pk.status === "countdown" || pk.status === "invited" || pk.status === "accepted"),
      ) ?? null
    );
  }

  private latestPk(roomId: string): LivePkSession | null {
    return (
      [...this.store.pk.values()]
        .filter((pk) => pk.roomId === roomId || pk.opponentRoomId === roomId)
        .at(-1) ?? null
    );
  }

  private expireDuePk(roomId: string): void {
    const pk = [...this.store.pk.values()].find(
      (session) =>
        (session.roomId === roomId || session.opponentRoomId === roomId) &&
        (session.status === "active" || session.status === "countdown"),
    );
    if (!pk?.endsAt) return;
    const endsAtMs = Date.parse(pk.endsAt);
    if (!Number.isFinite(endsAtMs) || endsAtMs > this.clock()) return;
    pk.status = "ended";
    pk.version += 1;
    this.patchPkDashboards(pk);
  }

  private expireDuePkSessions(): void {
    for (const pk of this.store.pk.values()) {
      if (pk.status !== "active" && pk.status !== "countdown") continue;
      if (!pk.endsAt) continue;
      const endsAtMs = Date.parse(pk.endsAt);
      if (!Number.isFinite(endsAtMs) || endsAtMs > this.clock()) continue;
      pk.status = "ended";
      pk.version += 1;
      this.patchPkDashboards(pk);
    }
  }

  private patchPkDashboards(pk: LivePkSession): void {
    const patch = {
      pk: {
        state: pk.status,
        localScore: pk.localScore,
        opponentScore: pk.opponentScore,
        endsAt: pk.endsAt,
      },
    };
    this.patchDashboard(pk.roomId, patch);
    if (pk.opponentRoomId && pk.opponentRoomId !== pk.roomId) {
      this.patchDashboard(pk.opponentRoomId, patch);
    }
  }

  private requireChallenge(challengeId: string): LivePkChallenge {
    const challenge = this.store.challenges.get(challengeId);
    if (!challenge) {
      throw Object.assign(new Error("challenge_not_found"), { code: "error.notFound", status: 404 });
    }
    return challenge;
  }

  private assertChallengeHost(challenge: LivePkChallenge, actor: LiveLifecycleActor): void {
    if (actor.role === "admin") return;
    if (actor.userId === challenge.hostUserId) return;
    throw Object.assign(new Error("host_required"), { code: "error.hostRequired", status: 403 });
  }

  private assertPkParticipantOrAdmin(pk: LivePkSession, actor: LiveLifecycleActor): void {
    if (actor.role === "admin") return;
    if (actor.userId === pk.hostUserId) return;
    if (pk.opponentUserId && actor.userId === pk.opponentUserId) return;
    throw Object.assign(new Error("pk_participant_required"), { code: "error.hostRequired", status: 403 });
  }

  setPkTeamRoster(
    roomId: string,
    actor: LiveLifecycleActor,
    userIds: string[],
  ): string[] {
    const room = this.requireRoom(roomId);
    this.assertHostOrAdmin(room, actor);
    const roster = normalizePkTeamUserIds(userIds, room.hostUserId, 6);
    room.pkRosterUserIds = roster;
    room.version += 1;
    return roster;
  }

  private verifiedPkTeamRoster(
    roomId: string,
    captainUserId: string,
    requested: string[] | undefined,
    maxMembers: 2 | 3 | 4 | 6,
  ): string[] {
    const allowed = new Set<string>([captainUserId]);
    const room = this.store.rooms.get(roomId);
    for (const userId of room?.pkRosterUserIds ?? []) {
      if (userId) allowed.add(userId);
    }
    for (const session of this.store.sessions.values()) {
      const sessionLifecycleRoomId = parsePkLiveMediaRef(session.roomId).lifecycleRoomId || session.roomId;
      if (sessionLifecycleRoomId !== roomId || session.disconnectedAt) continue;
      if (session.userId === captainUserId) {
        allowed.add(session.userId);
        continue;
      }
      if (session.role === "guest" && session.seated) allowed.add(session.userId);
    }
    return normalizePkTeamUserIds(requested, captainUserId, maxMembers).filter((userId) => allowed.has(userId));
  }

  private opponentStillLive(roomId: string, opponentRoomId?: string | null): boolean {
    const id = opponentRoomId ?? this.activePk(roomId)?.opponentRoomId;
    if (!id) return false;
    const opponent = this.store.rooms.get(id);
    if (!opponent) return true;
    return opponent.state !== "ended" && opponent.state !== "ending";
  }

  private buildSummary(room: LiveRoomRecord, _reason: EndLiveReason): LiveHostSummary {
    const dash = this.store.dashboards.get(room.roomId);
    const endedAt = room.endedAt ?? nowIso(this.clock());
    const pk = [...this.store.pk.values()].filter((p) => p.roomId === room.roomId).at(-1);
    return {
      roomId: room.roomId,
      roomVersion: room.version,
      startedAt: room.startedAt,
      endedAt,
      durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(room.startedAt)),
      uniqueViewers: dash?.audience.uniqueViewers ?? 0,
      peakViewers: dash?.audience.peakConcurrentViewers ?? 0,
      joins: dash?.audience.joins ?? 0,
      leaves: dash?.audience.leaves ?? 0,
      comments: dash?.engagement.comments ?? this.store.comments.get(room.roomId) ?? 0,
      reactions: dash?.engagement.reactions ?? 0,
      shares: dash?.engagement.shares ?? 0,
      followersGained: dash?.engagement.followersGained ?? 0,
      guestsSeated: dash?.participants.seated ?? 0,
      confirmedGiftCount: dash?.gifts.confirmedGiftCount ?? 0,
      giftValue: dash?.gifts.confirmedGrossGiftValue ?? null,
      giftSettlementState: dash?.gifts.settlementState ?? "not_applicable",
      pkResult: pk ? `${pk.status}:${pk.localScore}-${pk.opponentScore}` : null,
      reconnectCount: room.reconnectCount,
      averageConnectionQuality: dash?.media.connectionQuality ?? null,
    };
  }

  private patchDashboard(
    roomId: string,
    patch: LiveHostDashboardDelta["patch"],
  ): void {
    const current = this.store.dashboards.get(roomId);
    if (!current) return;
    const sequence = current.sequence + 1;
    const delta: LiveHostDashboardDelta = {
      eventId: newId("evt"),
      roomId,
      sequence,
      previousSequence: current.sequence,
      roomVersion: patch.roomVersion ?? current.roomVersion,
      occurredAt: nowIso(this.clock()),
      patch,
    };
    const next: LiveHostDashboardSnapshot = {
      ...current,
      ...patch,
      audience: { ...current.audience, ...(patch.audience ?? {}) },
      engagement: { ...current.engagement, ...(patch.engagement ?? {}) },
      participants: { ...current.participants, ...(patch.participants ?? {}) },
      gifts: { ...current.gifts, ...(patch.gifts ?? {}) },
      pk: { ...current.pk, ...(patch.pk ?? {}) },
      media: { ...current.media, ...(patch.media ?? {}) },
      sequence,
      generatedAt: delta.occurredAt,
      roomVersion: delta.roomVersion,
      roomState: patch.roomState ?? current.roomState,
    };
    this.store.dashboards.set(roomId, next);
    const list = this.store.deltas.get(roomId) ?? [];
    list.push(delta);
    this.store.deltas.set(roomId, list);
  }

  private cloneDashboard(roomId: string): LiveHostDashboardSnapshot {
    const dash = this.store.dashboards.get(roomId);
    if (!dash) return emptyHostDashboard(roomId, nowIso(this.clock()));
    return structuredClone(dash);
  }

  private enqueueOutbox(
    roomId: string,
    kind: LiveLifecycleOutboxJob["kind"],
    payload: Record<string, unknown>,
  ): void {
    const job: LiveLifecycleOutboxJob = {
      id: newId("job"),
      roomId,
      kind,
      payload,
      attempts: 0,
      status: "pending",
      lastError: null,
    };
    this.store.outbox.set(job.id, job);
  }

  private remember(commandId: string, actionId: string, roomId: string, result: unknown): void {
    this.store.commands.set(commandId, { commandId, actionId, roomId, result });
  }

  private commandResult<T>(commandId: string): T | null {
    const row = this.store.commands.get(commandId);
    return row ? (row.result as T) : null;
  }
}

let singleton: LiveLifecycleService | null = null;

export function getLiveLifecycleService(): LiveLifecycleService {
  singleton ??= new LiveLifecycleService();
  return singleton;
}

export function resetLiveLifecycleServiceForTests(): LiveLifecycleService {
  singleton = new LiveLifecycleService();
  return singleton;
}
