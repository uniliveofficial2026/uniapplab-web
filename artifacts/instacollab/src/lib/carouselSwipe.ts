import { useEffect, useRef, type RefObject } from 'react';

export type CarouselSwipeHandlers = {
  onPrev: () => void;
  onNext: () => void;
};

/** Horizontal swipe on `ref` without stealing vertical scroll (e.g. reels snap list). */
export function useHorizontalCarouselSwipe(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  handlers: CarouselSwipeHandlers,
  minDistance = 50
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let lock: 'horizontal' | 'vertical' | null = null;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lock = null;
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!lock && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        lock = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (lock === 'horizontal') {
        e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (lock !== 'horizontal') {
        lock = null;
        return;
      }
      const endX = e.changedTouches[0]?.clientX ?? startX;
      const distance = startX - endX;
      if (distance > minDistance) {
        handlersRef.current.onNext();
      } else if (distance < -minDistance) {
        handlersRef.current.onPrev();
      }
      lock = null;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref, enabled, minDistance]);
}
