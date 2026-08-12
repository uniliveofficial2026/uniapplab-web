import React, { useEffect, useRef } from 'react';
import { UniLivesSeatInteractionFallback } from './UniLivesSeatInteractionFallback';

type Props = {
  svgaUrl?: string;
  videoUrl?: string;
  staticUrl?: string;
  preferStatic?: boolean;
  className?: string;
  onEnded: () => void;
  renderSvga?: (args: { url: string; className: string; onEnded: () => void }) => React.ReactNode;
};

export function UniLivesSeatInteractionAnimation({
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
      <div className={`flex items-center justify-center ${className}`} data-unilives-seat-interaction-animation="static">
        <UniLivesSeatInteractionFallback src={staticUrl} className="max-h-full max-w-full object-contain" />
        <StaticEndSignal onEnded={onEnded} />
      </div>
    );
  }
  if (videoUrl) {
    return (
      <video key={videoUrl} src={videoUrl} autoPlay muted playsInline className={className} data-unilives-seat-interaction-animation="webm" onEnded={onEnded} onError={onEnded} />
    );
  }
  if (svgaUrl && renderSvga) {
    return <div className={className} data-unilives-seat-interaction-animation="svga">{renderSvga({ url: svgaUrl, className, onEnded })}</div>;
  }
  return (
    <div className={`flex items-center justify-center ${className}`} data-unilives-seat-interaction-animation="fallback">
      <UniLivesSeatInteractionFallback src={staticUrl} className="max-h-full max-w-full object-contain" />
      <StaticEndSignal onEnded={onEnded} />
    </div>
  );
}

function StaticEndSignal({ onEnded }: { onEnded: () => void }) {
  const ref = useRef(onEnded);
  ref.current = onEnded;
  useEffect(() => {
    const t = window.setTimeout(() => ref.current(), 1800);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
