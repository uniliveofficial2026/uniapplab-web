import React, { useEffect, useRef } from 'react';
import { UniLivesStickerFallback } from './UniLivesStickerFallback';
import { V14AnimatedStickerArtwork } from '../../../smule-rooms/components/V14AnimatedArtwork';
import { findV14StickerSpec } from '../../../smule-rooms/components/liveToolsV14Artwork';

type Props = {
  svgaUrl?: string;
  videoUrl?: string;
  staticUrl?: string;
  businessStickerId?: string | null;
  preferStatic?: boolean;
  className?: string;
  onEnded: () => void;
  renderSvga?: (args: { url: string; className: string; onEnded: () => void }) => React.ReactNode;
};

export function UniLivesStickerAnimation({
  svgaUrl,
  videoUrl,
  staticUrl,
  businessStickerId,
  preferStatic = false,
  className = 'pointer-events-none h-full w-full object-contain',
  onEnded,
  renderSvga,
}: Props) {
  const staticDurationMs = (findV14StickerSpec(businessStickerId)?.motionDurationMs ?? 1600) + 120;
  if (preferStatic || (!svgaUrl && !videoUrl)) {
    return (
      <div className={`flex items-center justify-center ${className}`} data-unilives-sticker-animation="static">
        {staticUrl ? (
          <V14AnimatedStickerArtwork
            stickerId={businessStickerId}
            src={staticUrl}
            className="h-full w-full"
            imgClassName="max-h-full max-w-full object-contain"
            animate={!preferStatic}
          />
        ) : (
          <UniLivesStickerFallback className="max-h-full max-w-full object-contain" />
        )}
        <StaticEndSignal durationMs={staticDurationMs} onEnded={onEnded} />
      </div>
    );
  }
  if (videoUrl) {
    return (
      <video
        key={videoUrl}
        src={videoUrl}
        autoPlay
        muted
        playsInline
        className={className}
        data-unilives-sticker-animation="webm"
        onEnded={onEnded}
        onError={onEnded}
      />
    );
  }
  if (svgaUrl && renderSvga) {
    return <div className={className} data-unilives-sticker-animation="svga">{renderSvga({ url: svgaUrl, className, onEnded })}</div>;
  }
  return (
    <div className={`flex items-center justify-center ${className}`} data-unilives-sticker-animation="fallback">
      {staticUrl ? (
        <V14AnimatedStickerArtwork
          stickerId={businessStickerId}
          src={staticUrl}
          className="h-full w-full"
          imgClassName="max-h-full max-w-full object-contain"
        />
      ) : (
        <UniLivesStickerFallback className="max-h-full max-w-full object-contain" />
      )}
      <StaticEndSignal durationMs={staticDurationMs} onEnded={onEnded} />
    </div>
  );
}

function StaticEndSignal({ onEnded, durationMs }: { onEnded: () => void; durationMs: number }) {
  const ref = useRef(onEnded);
  ref.current = onEnded;
  useEffect(() => {
    const t = window.setTimeout(() => ref.current(), durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);
  return null;
}
