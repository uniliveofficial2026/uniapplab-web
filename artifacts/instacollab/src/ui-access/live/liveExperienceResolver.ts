import { assertSafeUiJson } from "../schemas";
import type { LiveExperienceId, LiveExperienceManifest, ResolvedLiveExperienceSnapshot } from "./contracts";
import { liveExperienceForCanonicalRoomType, getLiveExperience } from "./liveExperienceRegistry";
import { validateLiveLayoutAssignment } from "./liveLayoutRegistry";
import { isRegisteredLiveAction } from "./liveActionRegistry";
import { isRegisteredLiveBinding } from "./liveBindingRegistry";
import { listLiveNodes } from "./liveNodeRegistry";
import { resolveLiveExperienceSnapshot, type LiveSessionAssignmentInput } from "./liveSessionSnapshot";
import { fallbackLiveSnapshot } from "./liveFallback";

export type LiveExperienceResolveInput = LiveSessionAssignmentInput & {
  canonicalRoomType: string;
  uiRoomMode?: string | null;
};

export function resolveLiveExperience(input: LiveExperienceResolveInput): ResolvedLiveExperienceSnapshot {
  const rec = liveExperienceForCanonicalRoomType(input.canonicalRoomType, input.uiRoomMode);
  const snapshot = resolveLiveExperienceSnapshot({
    ...input,
    globalPublishedSnapshot: input.globalPublishedSnapshot || (rec
      ? {
          experienceId: rec.experienceId,
          experienceVersionId: rec.manifest.versionId,
          layoutVersionId: rec.manifest.layoutVersionId,
          nodeVersionIds: rec.manifest.nodeVersionIds,
          checksum: rec.manifest.checksum,
        }
      : null),
  });
  const issues = validateLiveManifest(getLiveExperience(snapshot.experienceId)?.manifest);
  if (issues.length) {
    return fallbackLiveSnapshot({
      appSessionId: input.appSessionId,
      liveRoomSessionId: input.liveRoomSessionId || "",
      roomId: input.roomId || "",
      canonicalRoomType: input.canonicalRoomType,
    });
  }
  return snapshot;
}

export function validateLiveManifest(manifest: LiveExperienceManifest | null | undefined): string[] {
  const issues: string[] = [];
  if (!manifest) {
    return ["manifest.missing"];
  }
  try {
    assertSafeUiJson(manifest, manifest.experienceId);
  } catch (e) {
    issues.push(e instanceof Error ? e.message : "unsafe_manifest");
  }
  const rec = getLiveExperience(manifest.experienceId);
  if (!rec) issues.push("experience.unknown");
  if (rec) {
    issues.push(...validateLiveLayoutAssignment(rec.layoutId, rec.experienceId).map((i) => i.code));
  }
  const nodes = listLiveNodes().filter((n) => n.allowedExperienceIds.includes(manifest.experienceId));
  for (const node of nodes) {
    for (const actionId of node.actionIds) {
      if (!isRegisteredLiveAction(actionId)) issues.push(`action.unregistered:${actionId}`);
    }
    for (const bindingId of node.bindingIds) {
      if (!isRegisteredLiveBinding(bindingId)) issues.push(`binding.unregistered:${bindingId}`);
    }
    if (!node.translationKeys.length) issues.push(`i18n.missing:${node.nodeId}`);
    if (!node.sourcePath) issues.push(`source.missing:${node.nodeId}`);
  }
  const text = JSON.stringify(manifest);
  if (/service[_-]?role|livekit.*secret|BEGIN (RSA |OPENSSH )?PRIVATE/i.test(text)) {
    issues.push("secret.exposed");
  }
  return [...new Set(issues)];
}

export function publishedLiveRuntimeBundle(experienceId: LiveExperienceId) {
  const rec = getLiveExperience(experienceId);
  if (!rec) return null;
  const issues = validateLiveManifest(rec.manifest);
  if (issues.length) return null;
  return {
    schemaVersion: 1,
    brand: "UniLive’s",
    experienceId,
    versionId: rec.manifest.versionId,
    layoutVersionId: rec.manifest.layoutVersionId,
    checksum: rec.manifest.checksum,
    mediaMode: rec.mediaMode,
    canonicalRoomTypes: rec.canonicalRoomTypes,
    backendStatus: rec.backendStatus,
    secrets: undefined,
  };
}
