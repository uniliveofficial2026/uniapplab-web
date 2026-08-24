import { createContentDraft, getContentDraft, listContentDrafts, patchContentDraft, validateContentDraft } from "./contentDrafts";

const REGISTERED = new Set(["renderer.face.deepar.v1", "renderer.beauty.trtc.v1", "renderer.beauty.css.v1"]);

export function createFaceEffectDraft(body: Record<string, unknown>, actorId: string) {
  const rendererId = String(body.rendererId || "");
  if (!REGISTERED.has(rendererId)) {
    throw Object.assign(new Error("unregistered face-effect renderer"), { status: 400, code: "renderer.unregistered" });
  }
  return createContentDraft({
    kind: "face-effect",
    resourceType: "face-effect.definition",
    resourceId: String(body.faceEffectId || body.resourceId || "").trim() || `face-effect.draft.${Date.now()}`,
    patch: {
      nameKey: body.nameKey,
      thumbnailAssetId: body.thumbnailAssetId,
      rendererId,
      rendererVersionRange: body.rendererVersionRange || "*",
      effectPackageId: body.effectPackageId,
      landmarkBindingPresetId: body.landmarkBindingPresetId,
      textureAssetIds: body.textureAssetIds || [],
      intensityRange: body.intensityRange || { min: 0, max: 1, default: 0.5 },
      maxFaces: body.maxFaces ?? 1,
      capabilityProfileIds: body.capabilityProfileIds || ["tier-2-medium", "tier-3-high"],
      performanceProfileId: body.performanceProfileId || "perf.tier-2-medium",
      fallbackEffectId: body.fallbackEffectId || "fallback.face-effect.none",
      privacy: {
        landmarksEphemeral: true,
        storeRawFrames: false,
        uploadLandmarks: false,
        identityUse: false,
      },
      status: "draft",
    },
    actorId,
  });
}

export const patchFaceEffectDraft = patchContentDraft;
export const validateFaceEffectDraft = validateContentDraft;
export const getFaceEffectDraft = getContentDraft;
export function listFaceEffectDrafts() {
  return listContentDrafts("face-effect");
}
