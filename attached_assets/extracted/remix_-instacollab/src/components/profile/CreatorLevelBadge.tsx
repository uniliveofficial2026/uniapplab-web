import React, { useEffect, useRef, useState } from 'react';
import { Award, Zap } from 'lucide-react';
import type { CreatorProgress } from '../../lib/creatorXP';

function useAnimatedCount(target: number, durationMs = 420): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const to = target;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (to - from) * eased);
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  useEffect(() => {
    fromRef.current = display;
  }, [display]);

  return display;
}

export function CreatorLevelBadge({
  progress,
  showProgressBar = true,
  className = '',
}: {
  progress: CreatorProgress;
  showProgressBar?: boolean;
  className?: string;
}) {
  const animatedXp = useAnimatedCount(progress.xp);
  const xpToGo = Math.max(0, progress.xpToNextLevel - progress.xpIntoLevel);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <div className="flex items-center gap-3 bg-secondary/30 px-3 py-1.5 rounded-xl border border-border inline-flex w-fit max-w-full">
        <div className="flex items-center gap-1 text-xs font-bold text-orange-500 shrink-0">
          <Zap className="w-4 h-4 fill-orange-500" />
          Lvl {progress.level} {progress.tierLabel}
        </div>
        <div className="w-px h-4 bg-border shrink-0" />
        <div className="flex items-center gap-1 text-xs font-bold text-accent shrink-0 tabular-nums">
          <Award className="w-4 h-4" />
          {animatedXp.toLocaleString()} XP
        </div>
      </div>
      {showProgressBar ? (
        <div className="w-full max-w-[280px] space-y-1">
          <div
            className="h-1.5 w-full rounded-full bg-secondary overflow-hidden border border-border/60"
            role="progressbar"
            aria-valuenow={progress.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress.progressPercent}% to level ${progress.level + 1}`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width] duration-500 ease-out"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <p className="text-[10px] font-semibold text-foreground/50 tabular-nums">
            {xpToGo.toLocaleString()} XP to level {progress.level + 1}
          </p>
        </div>
      ) : null}
    </div>
  );
}
