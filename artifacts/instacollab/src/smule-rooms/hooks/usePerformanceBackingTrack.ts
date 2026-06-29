import { useEffect, useRef } from 'react';
import { getChordForLyricLine, triggerSynthChord } from '../utils/singingBacking';

/** Instrumental backing chords synced to the performance lyric clock. */
export function usePerformanceBackingTrack(active: boolean, activeLyricIndex: number) {
  const contextRef = useRef<AudioContext | null>(null);
  const lastChordIndexRef = useRef(-1);

  useEffect(() => {
    if (!active) {
      lastChordIndexRef.current = -1;
      void contextRef.current?.close().catch(() => undefined);
      contextRef.current = null;
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass({ latencyHint: 'interactive' });
    contextRef.current = context;
    void context.resume();

    lastChordIndexRef.current = -1;
    triggerSynthChord(context, getChordForLyricLine(0));
    lastChordIndexRef.current = 0;

    return () => {
      lastChordIndexRef.current = -1;
      void context.close().catch(() => undefined);
      contextRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (!active || !contextRef.current) return;
    if (activeLyricIndex === lastChordIndexRef.current) return;

    lastChordIndexRef.current = activeLyricIndex;
    void contextRef.current.resume();
    triggerSynthChord(contextRef.current, getChordForLyricLine(activeLyricIndex));
  }, [active, activeLyricIndex]);
}
