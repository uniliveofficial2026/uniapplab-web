import { useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';

export type LiveLikeBurst = {
  id: string;
  xPct: number;
  yPct: number;
};

const HEART_COLORS = ['#ff2d55', '#ff4d6d', '#ff6b9d', '#fb7185', '#f43f5e', '#e11d48'];
const BURST_LIFETIME_MS = 1600;

function heartForBurst(burst: LiveLikeBurst) {
  const seed = burst.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return {
    key: burst.id,
    drift: ((seed % 9) - 4) * 0.8,
    size: 20 + (seed % 5),
    color: HEART_COLORS[seed % HEART_COLORS.length],
    rotate: (seed % 14) - 7,
  };
}

export function LiveLikeFx({
  bursts,
  onBurstDone,
}: {
  bursts: LiveLikeBurst[];
  onBurstDone: (id: string) => void;
}) {
  const scheduledRef = useRef(new Map<string, number>());
  const onBurstDoneRef = useRef(onBurstDone);
  onBurstDoneRef.current = onBurstDone;

  useEffect(() => {
    const scheduled = scheduledRef.current;
    const activeIds = new Set(bursts.map((burst) => burst.id));

    for (const burst of bursts) {
      if (scheduled.has(burst.id)) continue;
      const timer = window.setTimeout(() => {
        scheduled.delete(burst.id);
        onBurstDoneRef.current(burst.id);
      }, BURST_LIFETIME_MS);
      scheduled.set(burst.id, timer);
    }

    for (const [id, timer] of scheduled) {
      if (activeIds.has(id)) continue;
      window.clearTimeout(timer);
      scheduled.delete(id);
    }
  }, [bursts]);

  useEffect(
    () => () => {
      for (const timer of scheduledRef.current.values()) window.clearTimeout(timer);
      scheduledRef.current.clear();
    },
    [],
  );

  if (bursts.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[175] overflow-hidden"
      data-node-id="node.live.shared.reaction-layer"
      aria-hidden
    >
      {bursts.map((burst) => {
        const heart = heartForBurst(burst);
        return (
          <span
            key={heart.key}
            className="live-like-heart absolute"
            style={{
              left: `${burst.xPct}%`,
              top: `${burst.yPct}%`,
              color: heart.color,
              ['--live-like-drift' as string]: `${heart.drift}px`,
              ['--live-like-rotate' as string]: `${heart.rotate}deg`,
              width: heart.size,
              height: heart.size,
            }}
          >
            <Heart className="h-full w-full fill-current drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" />
          </span>
        );
      })}
    </div>
  );
}
