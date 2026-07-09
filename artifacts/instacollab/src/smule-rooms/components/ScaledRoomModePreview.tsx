import { useLayoutEffect, useRef, useState } from 'react';
import { RoomModePreviewShell } from './RoomModePreviewShell';

const PREVIEW_WIDTH = 390;

const PREVIEW_HEIGHT_BY_MODE: Record<string, number> = {
  Chat: 720,
  Party: 760,
  Karaoke: 820,
  Radio: 800,
  'Game-Live': 760,
  'Multi-Guest': 780,
  'Solo-Live': 700,
  'Commerce-Live': 700,
};

function resolvePreviewHeight(mode: string): number {
  return PREVIEW_HEIGHT_BY_MODE[mode] ?? 760;
}

type ScaledRoomModePreviewProps = {
  mode: string;
  className?: string;
};

export function ScaledRoomModePreview({ mode, className = '' }: ScaledRoomModePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const previewHeight = resolvePreviewHeight(mode);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const syncScale = () => {
      const width = host.clientWidth;
      if (width > 0) {
        setScale(width / PREVIEW_WIDTH);
      }
    };

    syncScale();
    const observer = new ResizeObserver(syncScale);
    observer.observe(host);
    window.addEventListener('resize', syncScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncScale);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`room-mode-preview-scale-host ${className}`}
      style={{ aspectRatio: `${PREVIEW_WIDTH} / ${previewHeight}` }}
      aria-hidden="true"
    >
      <div
        className="room-mode-preview-canvas"
        style={{
          width: PREVIEW_WIDTH,
          height: previewHeight,
          transform: `scale(${scale})`,
        }}
      >
        <RoomModePreviewShell mode={mode} />
      </div>
    </div>
  );
}
