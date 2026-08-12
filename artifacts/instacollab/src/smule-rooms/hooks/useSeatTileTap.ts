import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_DELAY_MS = 80;

/**
 * Distinguishes single vs double tap on seat/video tiles.
 * Single tap fires after delay unless a second tap arrives in time.
 */
export function useSeatTileTap(delayMs = DEFAULT_DELAY_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleSeatTileTap = useCallback(
    (onSingleTap: () => void, onDoubleTap?: () => void) => {
      const now = Date.now();
      if (onDoubleTap && now - lastTapRef.current < delayMs) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastTapRef.current = 0;
        onDoubleTap();
        return;
      }

      lastTapRef.current = now;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastTapRef.current = 0;
        onSingleTap();
      }, delayMs);
    },
    [delayMs],
  );

  return handleSeatTileTap;
}
