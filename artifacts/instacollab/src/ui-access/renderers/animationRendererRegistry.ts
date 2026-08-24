import { fallbackFor } from "./fallbackRendererRegistry.ts";

export const ANIMATION_RENDERERS = {
  "renderer.gift.svga.v1": { formats: ["svga"] },
  "renderer.gift.video.v1": { formats: ["mp4", "webm"] },
  "renderer.animation.gif.v1": { formats: ["gif"] },
  "renderer.animation.lottie.v1": { formats: ["lottie", "json"] },
  "renderer.gift.static.v1": { formats: ["png", "webp"] },
} as const;

export function resolveAnimationRenderer(format: string): keyof typeof ANIMATION_RENDERERS {
  const f = format.toLowerCase();
  if (f === "svga") return "renderer.gift.svga.v1";
  if (f === "mp4" || f === "webm") return "renderer.gift.video.v1";
  if (f === "gif") return "renderer.animation.gif.v1";
  if (f === "lottie" || f === "json") return "renderer.animation.lottie.v1";
  return "renderer.gift.static.v1";
}

export function animationFallback() {
  return fallbackFor("silent-visual");
}
