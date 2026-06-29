import { useEffect, useRef, useState } from 'react';
import { formatTrackTime } from '../utils/songPerformance';

export function useSongPerformanceTimer(
  active: boolean,
  durationSec: number,
  songKey: string | null,
  onComplete: () => void,
) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setElapsedSec(0);
  }, [songKey]);

  useEffect(() => {
    if (!active || !songKey) return;

    const startedAt = performance.now();
    let rafId = 0;
    let completed = false;

    const tick = () => {
      const nextElapsed = (performance.now() - startedAt) / 1000;
      setElapsedSec(nextElapsed);

      if (nextElapsed >= durationSec) {
        if (!completed) {
          completed = true;
          setElapsedSec(durationSec);
          onCompleteRef.current();
        }
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [active, durationSec, songKey]);

  const progressPercent = durationSec > 0
    ? Math.min(100, (elapsedSec / durationSec) * 100)
    : 0;

  return {
    elapsedSec,
    progressPercent,
    elapsedLabel: formatTrackTime(elapsedSec),
    totalLabel: formatTrackTime(durationSec),
  };
}
