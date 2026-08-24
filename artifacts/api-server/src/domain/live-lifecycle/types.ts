export const LIVE_LIFECYCLE_COMMANDS = {
  leave: "live.room.leave",
  end: "live.room.end",
  pkEnd: "live.pk.end",
} as const;

export type LiveLifecycleCommandId =
  (typeof LIVE_LIFECYCLE_COMMANDS)[keyof typeof LIVE_LIFECYCLE_COMMANDS];

export type LiveRoomLifecycleState =
  | "preparing"
  | "live"
  | "host_reconnecting"
  | "ending"
  | "ended";

export type HostDeparturePolicy =
  | "authorized-host-handoff"
  | "host-reconnect-grace"
  | "end-required";

export type CanonicalLiveRoomType =
  | "solo_audio"
  | "solo_video"
  | "audio_party"
  | "video_multi"
  | "pk_1v1"
  | "pk_team"
  | "game"
  | "commerce";

export type LiveExperienceId =
  | "experience.live.solo-audio"
  | "experience.live.solo-video"
  | "experience.live.multi-guest-audio"
  | "experience.live.multi-guest-video"
  | "experience.live.party-audio"
  | "experience.live.party-video"
  | "experience.live.pk-1v1"
  | "experience.live.pk-team";

export type ParticipantRole = "host" | "guest" | "viewer" | "moderator";

export type LeaveReason =
  | "user_selected_leave"
  | "navigation"
  | "app_background"
  | "connection_lost";

export type EndLiveReason =
  | "host_selected_end"
  | "host_grace_expired"
  | "authorized_moderation"
  | "system_shutdown";

export type PkEndReason = "host_selected_pk_end" | "system" | "live_ended";

export type GiftSettlementState = "not_applicable" | "provisional" | "confirmed";

export type LiveParticipantSession = {
  participantSessionId: string;
  roomId: string;
  userId: string;
  role: ParticipantRole;
  connectionId: string;
  connectedAt: string;
  disconnectedAt: string | null;
  seated: boolean;
};

export type PkMediaSurface = "stream" | "party";

export type LivePkSession = {
  id: string;
  roomId: string;
  hostUserId: string;
  opponentUserId: string | null;
  opponentRoomId: string | null;
  hostMediaId: string | null;
  opponentMediaId: string | null;
  hostMediaSurface: PkMediaSurface | null;
  opponentMediaSurface: PkMediaSurface | null;
  pkType: "pk_1v1" | "pk_team";
  /** Declared creators per side (2/3/4/6). May exceed seated roster length on Solo Live. */
  teamSize: 1 | 2 | 3 | 4 | 6;
  /** Canonical auth user_ids for each team. 1v1 sessions contain one id per side. */
  hostTeamUserIds: string[];
  opponentTeamUserIds: string[];
  /** Per-member PK score and settled-gift event count. Team totals remain localScore/opponentScore. */
  memberScores: Record<string, number>;
  memberGiftCounts: Record<string, number>;
  /** Live Sell PK uses the same 1v1 session with commerce presentation. */
  liveSell: boolean;
  status: "invited" | "accepted" | "countdown" | "active" | "ended" | "cancelled" | "expired";
  localScore: number;
  opponentScore: number;
  endsAt: string | null;
  startedAt: string | null;
  durationSec: number;
  multiplier: number;
  version: number;
  sequence: number;
};

export type LivePkChallengeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

/** Server-authoritative PK challenge. Identity is auth user_id only. */
export type LivePkChallenge = {
  id: string;
  hostRoomId: string;
  challengerRoomId: string;
  hostUserId: string;
  challengerUserId: string;
  pkType: "pk_1v1" | "pk_team";
  /** Challenger roster is captured at create; host roster is supplied on accept for Team PK. */
  challengerTeamUserIds: string[];
  /** Canonical number of creators per side for Team PK. 1 for 1v1, 2, 3, 4 or 6 for Team PK. */
  teamSize: 1 | 2 | 3 | 4 | 6;
  liveSell: boolean;
  hostMediaId: string | null;
  challengerMediaId: string | null;
  hostMediaSurface: PkMediaSurface | null;
  challengerMediaSurface: PkMediaSurface | null;
  status: LivePkChallengeStatus;
  createdAt: string;
  expiresAt: string;
  durationSec: number;
  version: number;
  pkId: string | null;
};

export type LiveRoomRecord = {
  roomId: string;
  roomType: CanonicalLiveRoomType;
  hostUserId: string;
  version: number;
  state: LiveRoomLifecycleState;
  startedAt: string;
  endedAt: string | null;
  endReason: EndLiveReason | null;
  endActorUserId: string | null;
  hostReconnectDeadlineAt: string | null;
  reconnectCount: number;
  hasCanonicalCohostTransfer: boolean;
  /** Canonical Team PK roster (captain + teammates). Independent of Solo Live guest-seat count. */
  pkRosterUserIds: string[];
};

export type LeaveLiveRoomCommand = {
  commandId: string;
  participantSessionId: string;
  expectedRoomVersion?: number;
  reason: LeaveReason;
};

export type EndLiveRoomCommand = {
  commandId: string;
  expectedRoomVersion: number;
  reason: EndLiveReason;
};

export type EndPkCommand = {
  commandId: string;
  expectedPkVersion?: number;
  reason?: PkEndReason;
};

export type LiveHostDashboardSnapshot = {
  roomId: string;
  roomVersion: number;
  sequence: number;
  generatedAt: string;
  startedAt: string;
  roomState: LiveRoomLifecycleState;
  audience: {
    currentConnections: number;
    currentUniqueViewers: number;
    peakConcurrentViewers: number;
    uniqueViewers: number;
    joins: number;
    leaves: number;
  };
  engagement: {
    comments: number;
    commentsPerMinute: number;
    reactions: number;
    shares: number;
    followersGained: number;
  };
  participants: {
    connected: number;
    seated: number;
    pendingSeatRequests: number;
  };
  gifts: {
    confirmedGiftCount: number;
    confirmedGrossGiftValue: number | null;
    settlementState: GiftSettlementState;
  };
  pk: {
    state: string | null;
    localScore: number | null;
    opponentScore: number | null;
    endsAt: string | null;
  };
  media: {
    connectionState: string;
    connectionQuality: string;
    uploadBitrate: number | null;
    framesPerSecond: number | null;
    packetLoss: number | null;
    roundTripTime: number | null;
  };
};

export type LiveHostDashboardDelta = {
  eventId: string;
  roomId: string;
  sequence: number;
  previousSequence: number;
  roomVersion: number;
  occurredAt: string;
  patch: Omit<
    Partial<LiveHostDashboardSnapshot>,
    "audience" | "engagement" | "participants" | "gifts" | "pk" | "media"
  > & {
    audience?: Partial<LiveHostDashboardSnapshot["audience"]>;
    engagement?: Partial<LiveHostDashboardSnapshot["engagement"]>;
    participants?: Partial<LiveHostDashboardSnapshot["participants"]>;
    gifts?: Partial<LiveHostDashboardSnapshot["gifts"]>;
    pk?: Partial<LiveHostDashboardSnapshot["pk"]>;
    media?: Partial<LiveHostDashboardSnapshot["media"]>;
  };
};

export type LiveHostSummary = {
  roomId: string;
  roomVersion: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  uniqueViewers: number;
  peakViewers: number;
  joins: number;
  leaves: number;
  comments: number;
  reactions: number;
  shares: number;
  followersGained: number;
  guestsSeated: number;
  confirmedGiftCount: number;
  giftValue: number | null;
  giftSettlementState: GiftSettlementState;
  pkResult: string | null;
  reconnectCount: number;
  averageConnectionQuality: string | null;
};

export type LiveLifecycleOutboxJob = {
  id: string;
  roomId: string;
  kind: "delete-livekit-room" | "remove-participant" | "notify-pk-opponent";
  payload: Record<string, unknown>;
  attempts: number;
  status: "pending" | "done" | "failed";
  lastError: string | null;
};

export type LeaveResult = {
  commandId: string;
  actionId: typeof LIVE_LIFECYCLE_COMMANDS.leave;
  roomId: string;
  roomVersion: number;
  roomState: LiveRoomLifecycleState;
  role: ParticipantRole;
  hostDeparturePolicy: HostDeparturePolicy | null;
  hostReconnectDeadlineAt: string | null;
  ended: false;
  confirmationKey: string;
};

export type EndLiveResult = {
  commandId: string;
  actionId: typeof LIVE_LIFECYCLE_COMMANDS.end;
  roomId: string;
  roomVersion: number;
  roomState: LiveRoomLifecycleState;
  duplicate: boolean;
  summary: LiveHostSummary | null;
  opponentRoomId: string | null;
  opponentStillLive: boolean;
};

export type EndPkResult = {
  commandId: string;
  actionId: typeof LIVE_LIFECYCLE_COMMANDS.pkEnd;
  roomId: string;
  pkId: string | null;
  pkStatus: LivePkSession["status"] | null;
  roomState: LiveRoomLifecycleState;
  opponentRoomId: string | null;
  opponentStillLive: boolean;
  localScore: number | null;
  opponentScore: number | null;
};
