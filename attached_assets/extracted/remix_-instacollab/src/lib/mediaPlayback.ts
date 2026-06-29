/** True when a single item should repeat; false when carousel should advance. */
export function shouldLoopCarouselItem(itemCount: number): boolean {
  return itemCount <= 1;
}

export function nextCarouselIndex(current: number, itemCount: number): number {
  if (itemCount <= 1) return current;
  return (current + 1) % itemCount;
}

/** Post/reel effective slide count (mediaList or legacy single asset). */
export function postCarouselItemCount(post: {
  mediaList?: Array<unknown> | null;
  videoUrl?: string;
  imageUrl?: string;
}): number {
  const list = post.mediaList;
  if (list && list.length > 0) return list.length;
  if (post.videoUrl || post.imageUrl) return 1;
  return 0;
}

/** Milliseconds to show a still image before auto-advance in a multi-item carousel. */
export const IMAGE_CAROUSEL_MS = 5000;
