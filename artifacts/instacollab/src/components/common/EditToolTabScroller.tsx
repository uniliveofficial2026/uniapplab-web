import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type EditToolTabScrollerProps = {
  children: React.ReactNode;
  /** Re-measure scroll edges when tab set changes (e.g. Trim for video). */
  scrollKey: string;
  /** Optional label above the tab row. */
  label?: string;
  showHeader?: boolean;
};

/**
 * Horizontally scrollable editor tool tabs: swipe on mobile, ◀/▶ on md+.
 * Used in post/reel/text/story create flows.
 */
export function EditToolTabScroller({
  children,
  scrollKey,
  label = 'Tools',
  showHeader = false,
}: EditToolTabScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ atStart: true, atEnd: false });

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollEdges({
      atStart: el.scrollLeft <= 4,
      atEnd: maxScroll <= 4 || el.scrollLeft >= maxScroll - 4,
    });
  }, []);

  useEffect(() => {
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
  }, [updateScrollEdges, scrollKey]);

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(120, el.clientWidth * 0.65),
      behavior: 'smooth',
    });
  };

  const navButtonClass = (disabled: boolean) =>
    `hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-foreground shadow-md transition-all ${
      disabled
        ? 'opacity-40 cursor-not-allowed pointer-events-none'
        : 'hover:bg-secondary hover:border-primary/50 active:scale-95'
    }`;

  return (
    <div className="shrink-0 min-w-0 w-full border-b border-border/40">
      {showHeader && (
        <div className="flex items-center justify-between gap-2 px-2 pt-1.5 md:px-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 md:hidden">
            Swipe for more
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 hidden md:inline">
            Use arrows for more
          </span>
        </div>
      )}
      <div
        className={`grid w-full min-w-0 grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-0 md:gap-1.5 ${
          showHeader ? 'px-1 md:px-2 pb-2' : 'p-2 md:py-2 md:pl-0 md:pr-2'
        }`}
      >
        <button
          type="button"
          aria-label="Scroll tools left"
          onClick={() => scrollBy(-1)}
          disabled={scrollEdges.atStart}
          className={navButtonClass(scrollEdges.atStart)}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <div className="relative min-w-0 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar items-center py-0.5 px-1 md:px-0.5 scroll-smooth snap-x snap-mandatory scroll-px-2 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]"
          >
            {children}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-background to-transparent md:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-background to-transparent md:hidden"
            aria-hidden
          />
        </div>

        <button
          type="button"
          aria-label="Scroll tools right"
          onClick={() => scrollBy(1)}
          disabled={scrollEdges.atEnd}
          className={navButtonClass(scrollEdges.atEnd)}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
