import { LIVE_UI_REGISTRY } from "./generated/liveRegistry.generated";
import { LIVE_LAYOUT_SLOTS, type LiveExperienceId, type LiveLayoutSlot } from "./contracts";
import { getLiveExperience } from "./liveExperienceRegistry";
import { requiredLiveNodeIds } from "./liveNodeRegistry";

export type LiveLayoutRecord = {
  layoutId: string;
  experienceId: LiveExperienceId;
  slots: readonly LiveLayoutSlot[];
  mediaMode: "audio" | "video" | "mixed";
  requiredNodeIds: readonly string[];
  cannotObscure: readonly string[];
};

export function listLiveLayouts(): LiveLayoutRecord[] {
  return LIVE_UI_REGISTRY.layouts as unknown as LiveLayoutRecord[];
}

export function getLiveLayout(layoutId: string): LiveLayoutRecord | null {
  return listLiveLayouts().find((l) => l.layoutId === layoutId) ?? null;
}

export function liveLayoutForExperience(experienceId: LiveExperienceId): LiveLayoutRecord | null {
  return listLiveLayouts().find((l) => l.experienceId === experienceId) ?? null;
}

export type LiveLayoutValidationIssue = { code: string; message: string };

export function validateLiveLayoutAssignment(layoutId: string, experienceId: LiveExperienceId): LiveLayoutValidationIssue[] {
  const layout = getLiveLayout(layoutId);
  const experience = getLiveExperience(experienceId);
  const issues: LiveLayoutValidationIssue[] = [];
  if (!layout) {
    issues.push({ code: "layout.missing", message: `unknown layout ${layoutId}` });
    return issues;
  }
  if (!experience) {
    issues.push({ code: "experience.missing", message: `unknown experience ${experienceId}` });
    return issues;
  }
  if (layout.experienceId !== experienceId) {
    issues.push({ code: "layout.experience_mismatch", message: `${layoutId} is not assigned to ${experienceId}` });
  }
  if (experience.mediaMode === "audio" && layout.mediaMode === "video") {
    issues.push({ code: "layout.media_incompatible", message: "video layout cannot be assigned to an audio-only experience" });
  }
  if (experience.mediaMode === "video" && layout.mediaMode === "audio") {
    issues.push({ code: "layout.media_incompatible", message: "audio layout cannot be assigned to a video experience" });
  }
  for (const slot of LIVE_LAYOUT_SLOTS) {
    if (!layout.slots.includes(slot)) {
      issues.push({ code: "layout.slot_missing", message: `missing slot ${slot}` });
    }
  }
  const required = requiredLiveNodeIds(experienceId);
  for (const nodeId of required) {
    if (!layout.requiredNodeIds.includes(nodeId) && !layout.cannotObscure.includes(nodeId)) {
      /* required nodes may live outside layout.requiredNodeIds if they are shared chrome */
    }
  }
  for (const safety of layout.cannotObscure) {
    if (!required.includes(safety) && !layout.cannotObscure.includes(safety)) {
      issues.push({ code: "layout.safety_missing", message: safety });
    }
  }
  return issues;
}
