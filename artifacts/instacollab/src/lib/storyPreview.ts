import type { StoryDraftMedia } from '../components/stories/storyDraft';

/** Best thumbnail for a story segment card (last segment of a day is typical). */
export function pickStoryCardPreviewSegment(
  segments: StoryDraftMedia[],
): StoryDraftMedia | undefined {
  if (!segments.length) return undefined;
  return segments[segments.length - 1];
}

export function getStorySegmentPreviewUrl(
  segment: StoryDraftMedia | undefined | null,
  fallback?: string,
): string | undefined {
  if (!segment || segment.isText) return fallback;
  return segment.url || fallback;
}
