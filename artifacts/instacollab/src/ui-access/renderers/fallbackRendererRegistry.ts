export type FallbackKind = "gift-static" | "unfiltered-camera" | "beauty-off" | "silent-visual" | "snapshot-lkg" | "translation-en";

export function fallbackFor(kind: FallbackKind): { id: string; mode: FallbackKind } {
  switch (kind) {
    case "gift-static":
      return { id: "fallback.gift.static", mode: kind };
    case "unfiltered-camera":
      return { id: "fallback.face-effect.none", mode: kind };
    case "beauty-off":
      return { id: "fallback.beauty-effect.off", mode: kind };
    case "silent-visual":
      return { id: "fallback.animation.static", mode: kind };
    case "snapshot-lkg":
      return { id: "fallback.snapshot.bundled", mode: kind };
    case "translation-en":
      return { id: "i18n.en", mode: kind };
    default:
      return { id: "fallback.catalog.bundled", mode: "snapshot-lkg" };
  }
}
