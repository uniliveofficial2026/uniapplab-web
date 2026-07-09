import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Active reel from snap scroll position.
 * Scroll is the source of truth — avoids IntersectionObserver thrash during remounts.
 */
export function useReelsActiveIndex(
  scrollRef: RefObject<HTMLDivElement | null>,
  itemCount: number,
): [number, (index: number) => void] {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || itemCount <= 0) return;

    const onScroll = () => {
      if (document.getElementById('reel-full-screen-modal')) return;
      const node = scrollRef.current;
      if (!node || node.clientHeight <= 0) return;
      const index = Math.max(
        0,
        Math.min(itemCount - 1, Math.round(node.scrollTop / node.clientHeight)),
      );
      if (index !== activeIndexRef.current) {
        setActiveIndex(index);
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('scrollend', onScroll);
    onScroll();

    return () => {
      root.removeEventListener('scroll', onScroll);
      root.removeEventListener('scrollend', onScroll);
    };
  }, [scrollRef, itemCount]);

  return [activeIndex, setActiveIndex];
}
