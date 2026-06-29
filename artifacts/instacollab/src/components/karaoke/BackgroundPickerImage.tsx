import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

/** Static thumbnail for virtual-background picker tiles (preset URL or upload blob). */
export function BackgroundPickerImage({ src, alt = '' }: { src: string; alt?: string }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (!src || broken) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-800 text-muted-foreground">
        <ImageOff className="w-5 h-5 shrink-0 opacity-70" />
        <span className="px-1 text-center text-[8px] leading-tight">Preview unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      onError={() => setBroken(true)}
    />
  );
}
