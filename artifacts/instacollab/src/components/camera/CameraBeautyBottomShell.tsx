import React from 'react';
import { Loader2, X } from 'lucide-react';

export type CameraBeautyBottomShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleIcon?: React.ReactNode;
  accent?: 'rose' | 'fuchsia';
  anchorBottom?: number;
  loading?: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
};

/**
 * Bottom-anchored beauty tray shell — no panel backdrop, always fixed to viewport bottom.
 */
export function CameraBeautyBottomShell({
  isOpen,
  onClose,
  title,
  titleIcon,
  accent = 'rose',
  anchorBottom = 0,
  loading = false,
  loadingLabel = 'Loading…',
  children,
}: CameraBeautyBottomShellProps) {
  if (!isOpen) return null;

  const titleClass =
    accent === 'fuchsia'
      ? 'text-fuchsia-100'
      : 'text-rose-100';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[250] px-2 sm:px-3"
      style={{ bottom: anchorBottom }}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-full pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${titleClass}`}
          >
            {titleIcon}
            {title}
          </span>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/70">
                <Loader2 size={12} className="animate-spin" />
                {loadingLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur-sm transition active:scale-95 hover:bg-black/60 hover:text-white touch-manipulation"
              aria-label={`Close ${title}`}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="bg-transparent p-0">{children}</div>
      </div>
    </div>
  );
}
