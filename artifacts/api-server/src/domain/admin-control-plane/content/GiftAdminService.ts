import { createContentDraft, getContentDraft, listContentDrafts, patchContentDraft, validateContentDraft } from "./contentDrafts";

const REGISTERED_GIFT_RENDERERS = new Set([
  "renderer.gift.svga.v1",
  "renderer.gift.video.v1",
  "renderer.gift.static.v1",
]);

export function createGiftDraft(body: Record<string, unknown>, actorId: string) {
  const rendererId = String(body.rendererId || "renderer.gift.static.v1");
  if (!REGISTERED_GIFT_RENDERERS.has(rendererId)) {
    throw Object.assign(new Error("unregistered gift renderer"), { status: 400, code: "renderer.unregistered" });
  }
  return createContentDraft({
    kind: "gift",
    resourceType: "gift.definition",
    resourceId: String(body.giftId || body.resourceId || "").trim() || `gift.draft.${Date.now()}`,
    patch: {
      nameKey: body.nameKey,
      descriptionKey: body.descriptionKey,
      categoryId: body.categoryId,
      thumbnailAssetId: body.thumbnailAssetId,
      previewAssetId: body.previewAssetId,
      animationResourceId: body.animationResourceId,
      audioAssetId: body.audioAssetId,
      rendererId,
      fallbackAssetId: body.fallbackAssetId || "fallback.gift.static",
      sortOrder: body.sortOrder ?? 0,
      performanceProfileId: body.performanceProfileId || "perf.tier-2-medium",
      status: "draft",
    },
    actorId,
    title: `Gift ${String(body.giftId || "")}`,
  });
}

export function createGiftPricingDraft(body: Record<string, unknown>, actorId: string) {
  return createContentDraft({
    kind: "gift-pricing",
    resourceType: "gift.pricing",
    resourceId: String(body.giftId || "").trim() || "gift.pricing.canonical",
    patch: {
      giftId: body.giftId,
      coinPrice: body.coinPrice,
      priceVersion: body.priceVersion ?? 1,
      effectiveAt: body.effectiveAt,
      environment: body.environment,
      twoPersonApproval: true,
    },
    actorId,
    title: `Gift pricing ${String(body.giftId || "")}`,
  });
}

export function patchGiftDraft(id: string, patch: Record<string, unknown>, expectedRevision: number, actorId: string) {
  return patchContentDraft(id, patch, expectedRevision, actorId);
}

export function validateGiftDraft(id: string) {
  return validateContentDraft(id);
}

export function getGiftDraft(id: string) {
  return getContentDraft(id);
}

export function listGiftDrafts() {
  return listContentDrafts("gift").concat(listContentDrafts("gift-pricing"));
}
