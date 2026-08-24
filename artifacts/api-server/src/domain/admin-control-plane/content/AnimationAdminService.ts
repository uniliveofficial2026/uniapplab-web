import { createContentDraft, listContentDrafts, patchContentDraft, validateContentDraft } from "./contentDrafts";

const REGISTERED = new Set([
  "renderer.gift.svga.v1",
  "renderer.gift.video.v1",
  "renderer.animation.gif.v1",
  "renderer.animation.lottie.v1",
  "renderer.gift.static.v1",
]);

export function createAnimationDraft(body: Record<string, unknown>, actorId: string) {
  const rendererId = String(body.rendererId || "");
  if (!REGISTERED.has(rendererId)) {
    throw Object.assign(new Error("unregistered animation renderer"), { status: 400, code: "renderer.unregistered" });
  }
  return createContentDraft({
    kind: "animation",
    resourceType: "animation.pack",
    resourceId: String(body.animationId || body.resourceId || "").trim() || `animation.draft.${Date.now()}`,
    patch: {
      name: body.name,
      rendererId,
      format: body.format,
      durationMs: body.durationMs,
      loopPolicy: body.loopPolicy || "once",
      maximumRuntimeMs: body.maximumRuntimeMs || body.durationMs || 8000,
      frameRateTarget: body.frameRateTarget || 30,
      dimensions: body.dimensions,
      transparency: body.transparency ?? true,
      audioBehavior: body.audioBehavior || "optional",
      qualityVariants: body.qualityVariants || [],
      deviceTiers: body.deviceTiers || ["tier-0-static", "tier-1-low", "tier-2-medium", "tier-3-high"],
      fallbackResourceId: body.fallbackResourceId || "fallback.animation.static",
      reducedMotionResourceId: body.reducedMotionResourceId || "fallback.animation.static",
      performanceProfileId: body.performanceProfileId || "perf.tier-2-medium",
      status: "draft",
    },
    actorId,
  });
}

export const patchAnimationDraft = patchContentDraft;
export const validateAnimationDraft = validateContentDraft;
export function listAnimationDrafts() {
  return listContentDrafts("animation");
}
