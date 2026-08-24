import { liveExperienceForCanonicalRoomType } from "../../ui-access/live/liveExperienceRegistry";
import type { LiveExperienceId } from "../../ui-access/live/contracts";

const UI_MODE_TO_CANONICAL: Record<string, string> = {
  "Solo-Live": "solo_video",
  Chat: "audio_party",
  Party: "audio_party",
  "Multi-Guest": "video_multi",
  Karaoke: "audio_party",
  Radio: "video_multi",
  "Commerce-Live": "commerce",
  "Game-Live": "game",
};

export function canonicalRoomTypeFromUiMode(uiMode: string, explicit?: string | null): string {
  if (explicit) return explicit;
  return UI_MODE_TO_CANONICAL[uiMode] || "solo_video";
}

export function presentationExperienceId(canonicalRoomType: string, uiRoomMode?: string | null): LiveExperienceId | null {
  return liveExperienceForCanonicalRoomType(canonicalRoomType, uiRoomMode)?.experienceId ?? null;
}
