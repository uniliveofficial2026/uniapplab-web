import type { PkMediaSurface } from "./types";

export type PkLiveMediaRef = {
  lifecycleRoomId: string;
  mediaId: string;
  surface: PkMediaSurface;
};

export function parsePkLiveMediaRef(raw: string | null | undefined): PkLiveMediaRef {
  const value = String(raw || "").trim();
  if (!value) return { lifecycleRoomId: "", mediaId: "", surface: "party" };
  if (value.startsWith("api-stream-")) {
    const mediaId = value.slice("api-stream-".length).trim();
    return { lifecycleRoomId: mediaId, mediaId, surface: "stream" };
  }
  if (value.startsWith("stream-")) {
    const mediaId = value.slice("stream-".length).trim();
    return { lifecycleRoomId: mediaId, mediaId, surface: "stream" };
  }
  return { lifecycleRoomId: value, mediaId: value, surface: "party" };
}

export function resolvePkMediaSurface(
  explicit: string | null | undefined,
  fallbackRoomId: string | null | undefined,
): PkMediaSurface {
  if (explicit === "stream" || explicit === "party") return explicit;
  return parsePkLiveMediaRef(fallbackRoomId).surface;
}
