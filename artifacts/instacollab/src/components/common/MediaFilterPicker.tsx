import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useResolvedMediaUrl } from '../../hooks/useResolvedMediaUrl';
import {
  MEDIA_FILTER_PRESETS,
  type MediaFilterId,
  buildMediaFilterStyle,
} from '../../lib/mediaFilters';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

type PreviewMedia = {
  url: string;
  type: 'image' | 'video' | 'audio';
};

type MediaFilterPickerProps = {
  value: string;
  onChange: (id: MediaFilterId) => void;
  /** Live preview on the main editor canvas while hovering or touching a chip. */
  onPreviewChange?: (id: MediaFilterId | null) => void;
  previewMedia?: PreviewMedia | null;
  brightness?: number;
  contrast?: number;
};

export function MediaFilterPicker({
  value,
  onChange,
  onPreviewChange,
  previewMedia,
  brightness = 100,
  contrast = 100,
}: MediaFilterPickerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = React.useState({ atStart: true, atEnd: false });
  const activeId = (value || 'none') as MediaFilterId;
  const resolvedPreviewUrl = useResolvedMediaUrl(previewMedia?.url);
  const hasVisualPreview =
    !!resolvedPreviewUrl &&
    previewMedia &&
    (previewMedia.type === 'image' || previewMedia.type === 'video');

  const updateScrollEdges = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollEdges({
      atStart: el.scrollLeft <= 4,
      atEnd: maxScroll <= 4 || el.scrollLeft >= maxScroll - 4,
    });
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener('scroll', updateScrollEdges, { passive: true });
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollEdges);
      ro.disconnect();
    };
  }, [updateScrollEdges]);

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(168, el.clientWidth * 0.72),
      behavior: 'smooth',
    });
  };

  const navButtonClass = (disabled: boolean) =>
    `hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-foreground shadow-md transition-all ${
      disabled
        ? 'opacity-40 cursor-not-allowed pointer-events-none'
        : 'hover:bg-secondary hover:border-primary/50 active:scale-95'
    }`;

  return (
    <div className="space-y-2 min-w-0 w-full max-w-full">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Filters
        </span>
        <span className="text-[10px] text-muted-foreground md:hidden">Swipe to see more</span>
        <span className="text-[10px] text-muted-foreground hidden md:inline">
          Use arrows to browse
        </span>
      </div>

      <div className="grid w-full max-w-full grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-0 md:gap-2">
        <button
          type="button"
          aria-label="Scroll filters left"
          onClick={() => scrollBy(-1)}
          disabled={scrollEdges.atStart}
          className={navButtonClass(scrollEdges.atStart)}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>

        <div className="relative min-w-0 overflow-hidden">
          <div
            ref={scrollRef}
            onPointerLeave={() => onPreviewChange?.(null)}
            className="flex gap-2 overflow-x-auto overflow-y-visible no-scrollbar py-2 px-1 md:px-0.5 scroll-smooth snap-x snap-mandatory scroll-px-2 md:scroll-px-1 min-h-[5.25rem] touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]"
          >
            {MEDIA_FILTER_PRESETS.map((preset) => {
              const isActive = activeId === preset.id;
              const chipStyle = buildMediaFilterStyle(preset.id, {
                brightness,
                contrast,
                preview: true,
              });

              return (
                <div key={preset.id} className="shrink-0 snap-start p-1">
                  <button
                    type="button"
                    onClick={() => {
                      onPreviewChange?.(null);
                      onChange(preset.id);
                    }}
                    onPointerEnter={() => onPreviewChange?.(preset.id)}
                    onPointerDown={() => onPreviewChange?.(preset.id)}
                    onFocus={() => onPreviewChange?.(preset.id)}
                    onBlur={() => onPreviewChange?.(null)}
                    aria-pressed={isActive}
                    className={`relative block w-[5.25rem] h-16 rounded-xl border-2 overflow-hidden font-bold text-[10px] transition-colors ${
                      isActive
                        ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.35)]'
                        : 'border-border hover:border-foreground/40'
                    }`}
                  >
                    {hasVisualPreview ? (
                      previewMedia!.type === 'video' ? (
                        <video
                          src={resolvedPreviewUrl || undefined}
                          muted
                          autoPlay
                          loop
                          playsInline
                          controls
                          preload="auto"
                          className="absolute inset-0 h-full w-full object-cover"
                          style={chipStyle}
                          {...nativeVideoControlGuardProps()}
                        />
                      ) : (
                        <img
                          src={resolvedPreviewUrl || undefined}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                          style={chipStyle}
                        />
                      )
                    ) : (
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900"
                        style={chipStyle}
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-2 z-10 px-1 text-center leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                      {preset.name}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div
            className="pointer-events-none absolute inset-y-2 left-0 w-6 bg-gradient-to-r from-secondary/40 to-transparent md:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-2 right-0 w-6 bg-gradient-to-l from-secondary/40 to-transparent md:hidden"
            aria-hidden
          />
        </div>

        <button
          type="button"
          aria-label="Scroll filters right"
          onClick={() => scrollBy(1)}
          disabled={scrollEdges.atEnd}
          className={navButtonClass(scrollEdges.atEnd)}
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {hasVisualPreview && (
        <p className="text-[10px] text-muted-foreground px-0.5">
          Tap or hover a filter to preview live on your{' '}
          {previewMedia!.type === 'video' ? 'video' : 'photo'}.
          {brightness !== 100 || contrast !== 100
            ? ' Brightness and contrast adjustments apply too.'
            : ''}
        </p>
      )}
    </div>
  );
}
