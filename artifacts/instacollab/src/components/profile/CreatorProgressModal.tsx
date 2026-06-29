import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Award, Sparkles, X, Zap } from 'lucide-react';
import {
  buildCreatorXpBreakdown,
  type CreatorProgress,
} from '../../lib/creatorXP';
import {
  CreatorLevelBadge,
  CREATOR_MODAL_BODY,
  CREATOR_MODAL_HEADER,
  CREATOR_MODAL_SECTION_BODY,
  CREATOR_MODAL_SECTION_HEADER,
  CREATOR_MODAL_SHELL,
  CREATOR_WIDGET_SURFACE,
} from './CreatorLevelBadge';

export function CreatorProgressModal({
  progress,
  username,
  onClose,
}: {
  progress: CreatorProgress;
  username?: string;
  onClose: () => void;
}) {
  const breakdown = useMemo(
    () => buildCreatorXpBreakdown(progress.activity),
    [progress.activity]
  );
  const xpToGo = Math.max(0, progress.xpToNextLevel - progress.xpIntoLevel);

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-progress-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close creator progress"
        onClick={onClose}
      />
      <div className={`relative w-full sm:max-w-md shadow-2xl rounded-t-[28px] sm:rounded-[28px] max-h-[88vh] overflow-hidden flex flex-col ${CREATOR_MODAL_SHELL}`}>
        <div className={`flex items-center justify-between px-5 py-4 shrink-0 ${CREATOR_MODAL_HEADER}`}>
          <h2 id="creator-progress-title" className="font-bold text-base text-foreground">
            Creator progress
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-foreground/70 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`overflow-y-auto no-scrollbar px-5 py-5 space-y-5 ${CREATOR_MODAL_BODY}`}>
          <div className={`${CREATOR_WIDGET_SURFACE} p-4 space-y-4`}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground/70">
                  {username ? `@${username}` : 'Creator level'}
                </p>
                <p className="text-lg font-bold text-foreground">
                  Level {progress.level} · {progress.tierLabel}
                </p>
                <p className="text-sm text-foreground/60 mt-0.5 tabular-nums">
                  {progress.xp.toLocaleString()} total XP
                </p>
              </div>
            </div>

            <CreatorLevelBadge
              progress={progress}
              showProgressBar
              shell="embedded"
              className="max-w-none"
            />
          </div>

          <div className={`${CREATOR_WIDGET_SURFACE} overflow-hidden`}>
            <div className={`px-4 py-3 flex items-center justify-between ${CREATOR_MODAL_SECTION_HEADER}`}>
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/55">
                XP breakdown
              </span>
              <span className="text-xs font-bold text-accent tabular-nums">
                {progress.xp.toLocaleString()} XP
              </span>
            </div>
            <ul className={CREATOR_MODAL_SECTION_BODY}>
              {breakdown.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{line.label}</p>
                    <p className="text-[11px] text-foreground/50 truncate">{line.detail}</p>
                  </div>
                  <span className="font-bold text-foreground tabular-nums shrink-0">
                    +{line.xp.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${CREATOR_WIDGET_SURFACE} px-4 py-3 flex items-center gap-3`}>
            <div className="flex items-center gap-1 text-orange-500">
              <Zap className="w-4 h-4 fill-orange-500" />
              <Award className="w-4 h-4 text-accent" />
            </div>
            <p className="text-sm text-foreground/80">
              <span className="font-bold text-foreground tabular-nums">
                {xpToGo.toLocaleString()} XP
              </span>{' '}
              until level {progress.level + 1}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
