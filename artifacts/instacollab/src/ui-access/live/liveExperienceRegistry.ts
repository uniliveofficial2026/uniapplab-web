import { LIVE_UI_REGISTRY } from "./generated/liveRegistry.generated";
import {
  isLiveExperienceId,
  type LiveBackendStatus,
  type LiveExperienceId,
  type LiveExperienceManifest,
} from "./contracts";

export type LiveExperienceRecord = {
  experienceId: LiveExperienceId;
  displayName: string;
  canonicalRoomTypes: readonly string[];
  uiRoomModes: readonly string[];
  mediaMode: "audio" | "video" | "mixed";
  seats: { min: number; max: number };
  pkSupport: boolean;
  hostViewerGuest: boolean;
  backendStatus: LiveBackendStatus;
  backendNote?: string;
  sourcePath: string;
  layoutId: string;
  fallbackExperienceId: LiveExperienceId;
  existingExperienceKey: string;
  manifest: LiveExperienceManifest;
};

export function listLiveExperiences(): LiveExperienceRecord[] {
  return LIVE_UI_REGISTRY.experiences as unknown as LiveExperienceRecord[];
}

export function getLiveExperience(id: LiveExperienceId): LiveExperienceRecord | null {
  return listLiveExperiences().find((e) => e.experienceId === id) ?? null;
}

export function liveExperienceForCanonicalRoomType(
  roomType: string,
  uiRoomMode?: string | null,
): LiveExperienceRecord | null {
  const type = String(roomType || "").trim();
  const mode = String(uiRoomMode || "").trim();
  const all = listLiveExperiences();
  if (mode) {
    const byMode = all.find((e) => e.canonicalRoomTypes.includes(type) && e.uiRoomModes.includes(mode));
    if (byMode) return byMode;
  }
  return all.find((e) => e.canonicalRoomTypes.includes(type)) ?? null;
}

export function liveExperienceManifest(id: LiveExperienceId): LiveExperienceManifest | null {
  return getLiveExperience(id)?.manifest ?? null;
}

export function extraLiveUiModes() {
  return LIVE_UI_REGISTRY.extraUiModes;
}

export function canonicalLiveRoomTypes(): readonly string[] {
  return LIVE_UI_REGISTRY.canonicalRoomTypes;
}

export function assertKnownLiveExperience(id: string): LiveExperienceId {
  if (!isLiveExperienceId(id)) {
    throw new Error(`unknown live experience: ${id}`);
  }
  return id;
}
