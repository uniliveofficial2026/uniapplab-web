import { useEffect, type RefObject } from 'react';

export function useLyricAutoScroll(
  activeIndex: number,
  containerRef: RefObject<HTMLElement | null>,
  lineRefs: RefObject<(HTMLElement | null)[]>,
  behavior: ScrollBehavior = 'smooth',
) {
  useEffect(() => {
    const container = containerRef.current;
    const line = lineRefs.current[activeIndex];
    if (!container || !line) return;

    const lineTop = line.offsetTop;
    const lineHeight = line.offsetHeight;
    const containerHeight = container.clientHeight;
    const targetTop = lineTop - containerHeight / 2 + lineHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior,
    });
  }, [activeIndex, containerRef, lineRefs, behavior]);
}
