import type { LiveExperienceId } from "../../../../ui-access/live/contracts";

export type LivePreviewRole = "host" | "viewer" | "cohost" | "seated-guest" | "moderator";
export type LivePreviewNetwork = "good" | "degraded" | "offline" | "reconnecting";
export type LivePreviewPk = "invite" | "countdown" | "active" | "ended" | "cancelled" | "winner" | "loser" | "draw" | "none";
export type LivePreviewSeat = "empty" | "occupied" | "requested" | "invited" | "locked" | "muted" | "speaking";

export type LivePreviewFixture = {
  id: string;
  experienceId: LiveExperienceId;
  role: LivePreviewRole;
  network: LivePreviewNetwork;
  pk: LivePreviewPk;
  seats: LivePreviewSeat[];
  viewerCount: number;
  commentCount: number;
  giftBurst: boolean;
  cameraOn: boolean;
  micOn: boolean;
  dir: "ltr" | "rtl";
  longCopy: boolean;
  viewport: "small-phone" | "large-phone" | "tablet" | "landscape";
  reducedMotion: boolean;
  deviceTier: "tier-0-static" | "tier-1-low" | "tier-2-medium" | "tier-3-high";
};

export const livePreviewFixtures: LivePreviewFixture[] = [
  { id: "solo-video.host", experienceId: "experience.live.solo-video", role: "host", network: "good", pk: "none", seats: ["occupied"], viewerCount: 12, commentCount: 4, giftBurst: false, cameraOn: true, micOn: true, dir: "ltr", longCopy: false, viewport: "large-phone", reducedMotion: false, deviceTier: "tier-2-medium" },
  { id: "solo-video.viewer", experienceId: "experience.live.solo-video", role: "viewer", network: "good", pk: "none", seats: ["occupied"], viewerCount: 0, commentCount: 0, giftBurst: false, cameraOn: false, micOn: false, dir: "ltr", longCopy: false, viewport: "small-phone", reducedMotion: false, deviceTier: "tier-1-low" },
  { id: "solo-audio.host", experienceId: "experience.live.solo-audio", role: "host", network: "good", pk: "none", seats: ["speaking"], viewerCount: 3, commentCount: 1, giftBurst: false, cameraOn: false, micOn: true, dir: "ltr", longCopy: false, viewport: "large-phone", reducedMotion: false, deviceTier: "tier-1-low" },
  { id: "multi-guest.seats", experienceId: "experience.live.multi-guest-video", role: "host", network: "good", pk: "none", seats: ["occupied", "empty", "requested", "invited", "locked", "muted", "speaking"], viewerCount: 240, commentCount: 80, giftBurst: true, cameraOn: true, micOn: true, dir: "ltr", longCopy: true, viewport: "tablet", reducedMotion: false, deviceTier: "tier-3-high" },
  { id: "multi-guest.guest", experienceId: "experience.live.multi-guest-audio", role: "seated-guest", network: "degraded", pk: "none", seats: ["occupied", "muted"], viewerCount: 8, commentCount: 2, giftBurst: false, cameraOn: false, micOn: false, dir: "rtl", longCopy: true, viewport: "large-phone", reducedMotion: true, deviceTier: "tier-0-static" },
  { id: "party.audio", experienceId: "experience.live.party-audio", role: "moderator", network: "good", pk: "none", seats: ["occupied", "empty"], viewerCount: 18, commentCount: 6, giftBurst: false, cameraOn: false, micOn: true, dir: "ltr", longCopy: false, viewport: "large-phone", reducedMotion: false, deviceTier: "tier-2-medium" },
  { id: "party.video", experienceId: "experience.live.party-video", role: "cohost", network: "reconnecting", pk: "none", seats: ["occupied"], viewerCount: 40, commentCount: 12, giftBurst: false, cameraOn: true, micOn: true, dir: "ltr", longCopy: false, viewport: "landscape", reducedMotion: false, deviceTier: "tier-2-medium" },
  { id: "pk.1v1.active", experienceId: "experience.live.pk-1v1", role: "host", network: "good", pk: "active", seats: ["occupied", "occupied"], viewerCount: 90, commentCount: 30, giftBurst: true, cameraOn: true, micOn: true, dir: "ltr", longCopy: false, viewport: "large-phone", reducedMotion: false, deviceTier: "tier-3-high" },
  { id: "pk.1v1.invite", experienceId: "experience.live.pk-1v1", role: "host", network: "good", pk: "invite", seats: ["occupied"], viewerCount: 20, commentCount: 3, giftBurst: false, cameraOn: true, micOn: true, dir: "ltr", longCopy: false, viewport: "large-phone", reducedMotion: false, deviceTier: "tier-2-medium" },
  { id: "pk.team.result", experienceId: "experience.live.pk-team", role: "viewer", network: "offline", pk: "winner", seats: ["occupied", "occupied", "empty"], viewerCount: 0, commentCount: 0, giftBurst: false, cameraOn: false, micOn: false, dir: "ltr", longCopy: false, viewport: "tablet", reducedMotion: true, deviceTier: "tier-0-static" },
  { id: "system.ended", experienceId: "experience.live.solo-video", role: "viewer", network: "offline", pk: "ended", seats: ["empty"], viewerCount: 0, commentCount: 0, giftBurst: false, cameraOn: false, micOn: false, dir: "ltr", longCopy: false, viewport: "small-phone", reducedMotion: true, deviceTier: "tier-0-static" },
];
