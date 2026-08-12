import React, { useEffect, useRef } from 'react';
import { UniLivesGiftFallback } from './UniLivesGiftFallback';

type Props = {
  svgaUrl?: string;
  videoUrl?: string;
  staticUrl?: string;
  preferStatic?: boolean;
  className?: string;
  onEnded: () => void;
  /**
   * Optional SVGA renderer supplied by the host (e.g. existing GiftSvgaPlayer).
   * Brand layer does not import a second SVGA library.
   */
  renderSvga?: (args: { url: string; className: string; onEnded: () => void }) => React.ReactNode;
};

/**
 * Animation surface only — parents own queue timing and gift business IDs.
 * SVGA playback is injected via renderSvga to reuse the existing player.
 */
export function UniLivesGiftAnimation({
  svgaUrl,
  videoUrl,
  staticUrl,
  preferStatic = false,
  className = 'pointer-events-none h-full w-full object-contain',
  onEnded,
  renderSvga,
}: Props) {
  if (preferStatic || (!svgaUrl && !videoUrl)) {
    return (
      <div className={`flex items-center justify-center ${className}`} data-unilives-gift-animation="static">
        <UniLivesGiftFallback
          src={staticUrl}
          className="max-h-full max-w-full object-contain"
        />
        <StaticEndSignal onEnded={onEnded} />
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
        data-unilives-gift-animation="webm"
        onEnded={onEnded}
        onError={onEnded}
      />
    );
  }

  if (svgaUrl && renderSvga) {
    return (
      <div className={className} data-unilives-gift-animation="svga">
        {renderSvga({ url: svgaUrl, className, onEnded })}
      </div>
    );
  }

  // No SVGA host provided — static fallback rather than inventing a second player.
  return (
    <div className={`flex items-center justify-center ${className}`} data-unilives-gift-animation="svga-fallback">
      <UniLivesGiftFallback src={staticUrl} className="max-h-full max-w-full object-contain" />
      <StaticEndSignal onEnded={onEnded} />
    </div>
  );
}

function StaticEndSignal({ onEnded }: { onEnded: () => void }) {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  useEffect(() => {
    const t = window.setTimeout(() => onEndedRef.current(), 1800);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
