import { fallbackFor } from "./fallbackRendererRegistry.ts";

export const GIFT_RENDERERS = {
  "renderer.gift.svga.v1": { formats: ["svga"], maxConcurrent: 1, maxDurationMs: 8000 },
  "renderer.gift.video.v1": { formats: ["mp4", "webm"], maxConcurrent: 1, maxDurationMs: 12000 },
  "renderer.gift.static.v1": { formats: ["png", "webp"], maxConcurrent: 4, maxDurationMs: 2500 },
} as const;

export type GiftRendererId = keyof typeof GIFT_RENDERERS;

export function resolveGiftRenderer(id?: string): GiftRendererId {
  if (id && id in GIFT_RENDERERS) return id as GiftRendererId;
  return "renderer.gift.static.v1";
}

export function giftRendererFallback(): { id: string; mode: string } {
  return fallbackFor("gift-static");
}
