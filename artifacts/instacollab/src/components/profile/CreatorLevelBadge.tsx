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

/** Dark profile widget surface for creator level UI. */
export const CREATOR_WIDGET_SURFACE =
  'rounded-2xl border border-border bg-secondary/90 dark:bg-zinc-800';

export const CREATOR_MODAL_SHELL =
  'bg-muted/80 dark:bg-zinc-950 border border-border';

export const CREATOR_MODAL_HEADER =
  'bg-secondary/70 dark:bg-zinc-900 border-b border-border';

export const CREATOR_MODAL_BODY =
  'bg-secondary/50 dark:bg-zinc-950/90';

export const CREATOR_MODAL_SECTION_HEADER =
  'bg-secondary/75 dark:bg-zinc-800 border-b border-border';

export const CREATOR_MODAL_SECTION_BODY =
  'bg-secondary/60 dark:bg-zinc-900 divide-y divide-border';

const WIDGET_SHELL_CLASS = `${CREATOR_WIDGET_SURFACE} p-4 w-full max-w-[320px]`;

export function CreatorLevelBadge({
  progress,
  showProgressBar = true,
  className = '',
  onClick,
  shell = 'pill',
  compact = false,
}: {
  progress: CreatorProgress;
  showProgressBar?: boolean;
  className?: string;
  onClick?: () => void;
  shell?: 'pill' | 'widget' | 'embedded';
  compact?: boolean;
}) {
  const animatedXp = useAnimatedCount(progress.xp);
  const xpToGo = Math.max(0, progress.xpToNextLevel - progress.xpIntoLevel);
  const pillClassName = compact
    ? 'flex items-center gap-2 bg-secondary/90 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-border inline-flex w-fit max-w-full'
    : 'flex items-center gap-3 bg-secondary/90 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-border inline-flex w-fit max-w-full';
  const rowClassName =
    shell === 'pill'
      ? pillClassName
      : 'flex items-center gap-3 w-fit max-w-full';

  const badgeRow = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${rowClassName} ${
        shell === 'pill'
          ? 'hover:bg-secondary dark:hover:bg-zinc-700 transition-colors cursor-pointer'
          : shell === 'widget'
            ? 'hover:opacity-80 transition-opacity cursor-pointer'
            : 'hover:opacity-80 transition-opacity cursor-pointer'
      }`}
      aria-label={`Creator level ${progress.level}, ${progress.xp.toLocaleString()} XP. View breakdown.`}
    >
      <BadgeContents progress={progress} animatedXp={animatedXp} compact={compact} />
    </button>
  ) : (
    <div className={rowClassName}>
      <BadgeContents progress={progress} animatedXp={animatedXp} compact={compact} />
    </div>
  );

  const progressBlock =
    showProgressBar && !compact ? (
    <div className="w-full space-y-1">
      <div
        className="h-1.5 w-full rounded-full bg-background/70 dark:bg-black/50 overflow-hidden border border-border"
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
  ) : null;

  if (shell === 'widget' || shell === 'embedded') {
    const content = (
      <>
        {badgeRow}
        {progressBlock}
      </>
    );

    if (shell === 'embedded') {
      return (
        <div className={`flex flex-col gap-3 ${className}`.trim()}>
          {content}
        </div>
      );
    }

    return (
      <div className={`${WIDGET_SHELL_CLASS} flex flex-col gap-3 ${className}`.trim()}>
        {content}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'} ${className}`.trim()}>
      {badgeRow}
      {progressBlock}
    </div>
  );
}

function BadgeContents({
  progress,
  animatedXp,
  compact = false,
}: {
  progress: CreatorProgress;
  animatedXp: number;
  compact?: boolean;
}) {
  const iconClass = compact ? 'w-3 h-3' : 'w-4 h-4';
  const textClass = compact ? 'text-[10px]' : 'text-xs';
  const dividerClass = compact ? 'h-3' : 'h-4';

  return (
    <>
      <div className={`flex items-center gap-1 font-bold text-orange-500 shrink-0 ${textClass}`}>
        <Zap className={`${iconClass} fill-orange-500`} />
        Lvl {progress.level} {progress.tierLabel}
      </div>
      <div className={`w-px bg-border shrink-0 ${dividerClass}`} />
      <div className={`flex items-center gap-1 font-bold text-accent shrink-0 tabular-nums ${textClass}`}>
        <Award className={iconClass} />
        {animatedXp.toLocaleString()} XP
      </div>
    </>
  );
}
