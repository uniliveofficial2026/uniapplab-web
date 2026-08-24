import { fallbackFor } from "./fallbackRendererRegistry.ts";

export const FACE_EFFECT_RENDERERS = {
  "renderer.face.deepar.v1": { requiresCamera: true, maxFaces: 4 },
  "renderer.beauty.trtc.v1": { requiresCamera: true, maxFaces: 1 },
  "renderer.beauty.css.v1": { requiresCamera: false, maxFaces: 1 },
} as const;

export type FaceEffectRendererId = keyof typeof FACE_EFFECT_RENDERERS;

export function resolveFaceEffectRenderer(id?: string): FaceEffectRendererId | null {
  if (id && id in FACE_EFFECT_RENDERERS) return id as FaceEffectRendererId;
  return null;
}

export function faceEffectFailureFallback() {
  return fallbackFor("unfiltered-camera");
}
