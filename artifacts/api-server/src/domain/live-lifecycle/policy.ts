import type {
  CanonicalLiveRoomType,
  HostDeparturePolicy,
  LiveExperienceId,
  LiveRoomLifecycleState,
} from "./types";

export const HOST_RECONNECT_GRACE_MS = 60_000;
export const LIVEKIT_CLEANUP_MAX_ATTEMPTS = 8;

export const SUPPORTED_EXPERIENCES: LiveExperienceId[] = [
  "experience.live.solo-audio",
  "experience.live.solo-video",
  "experience.live.multi-guest-audio",
  "experience.live.multi-guest-video",
  "experience.live.party-audio",
  "experience.live.party-video",
  "experience.live.pk-1v1",
  "experience.live.pk-team",
];

const SOLO_LIKE: ReadonlySet<CanonicalLiveRoomType> = new Set([
  "solo_audio",
  "solo_video",
  "pk_1v1",
  "pk_team",
]);

export function experienceToRoomType(experienceId: LiveExperienceId): CanonicalLiveRoomType {
  switch (experienceId) {
    case "experience.live.solo-audio":
      return "solo_audio";
    case "experience.live.solo-video":
      return "solo_video";
    case "experience.live.multi-guest-audio":
    case "experience.live.party-audio":
      return "audio_party";
    case "experience.live.multi-guest-video":
    case "experience.live.party-video":
      return "video_multi";
    case "experience.live.pk-1v1":
      return "pk_1v1";
    case "experience.live.pk-team":
      return "pk_team";
  }
}

/**
 * Backend-owned host departure policy.
 * Do not invent UI-only handoff — handoff only when canonical cohost transfer exists.
 */
export function resolveHostDeparturePolicy(input: {
  roomType: CanonicalLiveRoomType;
  hasCanonicalCohostTransfer: boolean;
  roomState: LiveRoomLifecycleState;
}): HostDeparturePolicy {
  if (input.hasCanonicalCohostTransfer) return "authorized-host-handoff";
  if (input.roomState === "ending" || input.roomState === "ended") return "end-required";
  if (SOLO_LIKE.has(input.roomType)) return "host-reconnect-grace";
  return "host-reconnect-grace";
}

export function leaveConfirmationKey(input: {
  role: "host" | "guest" | "viewer" | "moderator";
  policy: HostDeparturePolicy | null;
}): string {
  if (input.role === "viewer" || input.role === "moderator") return "live.leave.confirm.viewer";
  if (input.role === "guest") return "live.leave.confirm.guest";
  if (input.policy === "authorized-host-handoff") return "live.leave.confirm.hostHandoff";
  if (input.policy === "host-reconnect-grace") return "live.leave.confirm.hostGrace";
  return "live.leave.confirm.hostEndRequired";
}

export function canAcceptMutations(state: LiveRoomLifecycleState): boolean {
  return state === "live" || state === "host_reconnecting" || state === "preparing";
}

export function isTerminal(state: LiveRoomLifecycleState): boolean {
  return state === "ended";
}

export function assertTransition(
  from: LiveRoomLifecycleState,
  to: LiveRoomLifecycleState,
): boolean {
  if (from === to) return true;
  if (from === "preparing" && (to === "live" || to === "ending")) return true;
  if (from === "live" && (to === "host_reconnecting" || to === "ending")) return true;
  if (from === "host_reconnecting" && (to === "live" || to === "ending")) return true;
  if (from === "ending" && to === "ended") return true;
  return false;
}
