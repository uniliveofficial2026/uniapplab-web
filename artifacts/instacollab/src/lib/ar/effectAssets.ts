const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadEffectImage(url: string): Promise<HTMLImageElement | null> {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      }),
    );
  }
  return imageCache.get(url)!;
}

export function clearEffectImageCache(): void {
  imageCache.clear();
}
