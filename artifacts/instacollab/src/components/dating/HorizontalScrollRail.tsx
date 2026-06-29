import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type HorizontalScrollRailProps = {
  children: React.ReactNode;
  className?: string;
  scrollStep?: number;
  ariaLabel?: string;
};

/** Horizontal strip with prev/next controls on md+ viewports. */
export function HorizontalScrollRail({
  children,
  className = '',
  scrollStep = 280,
  ariaLabel = 'Scrollable list',
}: HorizontalScrollRailProps) {
  const ref = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: -1 | 1) => {
    ref.current?.scrollBy({ left: direction * scrollStep, behavior: 'smooth' });
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
        className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-secondary md:inline-flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        className="flex gap-3 overflow-x-auto no-scrollbar md:px-11"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-secondary md:inline-flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
