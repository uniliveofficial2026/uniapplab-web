import type { LiveExperienceId, LiveExperienceManifest, ResolvedLiveExperienceSnapshot } from "./contracts";
import { getLiveExperience, listLiveExperiences } from "./liveExperienceRegistry";

export const BUNDLED_LIVE_FALLBACK_EXPERIENCE: LiveExperienceId = "experience.live.solo-audio";

export function bundledLiveManifest(experienceId: LiveExperienceId = BUNDLED_LIVE_FALLBACK_EXPERIENCE): LiveExperienceManifest {
  const rec = getLiveExperience(experienceId) || listLiveExperiences()[0];
  if (!rec) {
    throw new Error("no bundled live experience");
  }
  return rec.manifest;
}

export function fallbackLiveSnapshot(partial: Partial<ResolvedLiveExperienceSnapshot> = {}): ResolvedLiveExperienceSnapshot {
  const manifest = bundledLiveManifest(
    (partial.experienceId as LiveExperienceId | undefined) || BUNDLED_LIVE_FALLBACK_EXPERIENCE,
  );
  return {
    appSessionId: partial.appSessionId || "app.anonymous",
    liveRoomSessionId: partial.liveRoomSessionId || "live.unknown",
    roomId: partial.roomId || "",
    canonicalRoomType: partial.canonicalRoomType || "solo_audio",
    experienceId: manifest.experienceId,
    experienceVersionId: manifest.versionId,
    layoutVersionId: manifest.layoutVersionId,
    nodeVersionIds: { ...manifest.nodeVersionIds },
    assetVersionIds: partial.assetVersionIds || {},
    translationBundleVersion: partial.translationBundleVersion || "bundled",
    checksum: manifest.checksum,
    assignmentReason: "bundled-fallback",
  };
}
