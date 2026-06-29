import React, { useEffect, useRef, useState } from 'react';

function typingDelayForChar(char: string, index: number): number {
  if (char === ' ') return 52;
  if (char.charCodeAt(0) > 127) return 165;
  if (/[.,!?…]/.test(char)) return 320;
  return 78 + (index % 4) * 24;
}

const ERASE_DELAY_MS = 28;

type ThoughtTypingTextProps = {
  text: string;
  className?: string;
  /** ms before the first character appears */
  startDelay?: number;
  /** Skip animation (accessibility / reduced motion) */
  instant?: boolean;
  /** Loop type → hold → erase → restart */
  loop?: boolean;
  /** Pause with full text visible before erasing */
  pauseAfterTypeMs?: number;
  /** Pause on empty text before the next cycle */
  pauseBeforeRestartMs?: number;
  onComplete?: () => void;
  /** Fired when a loop cycle ends (text fully erased) — use to replay pop animation */
  onLoopRestart?: () => void;
};

/** Reveals thought text one character at a time, like live thinking. */
export function ThoughtTypingText({
  text,
  className = '',
  startDelay = 0,
  instant = false,
  loop = false,
  pauseAfterTypeMs = 3400,
  pauseBeforeRestartMs = 650,
  onComplete,
  onLoopRestart,
}: ThoughtTypingTextProps) {
  const [started, setStarted] = useState(instant);
  const [visibleCount, setVisibleCount] = useState(instant ? text.length : 0);
  const [isErasing, setIsErasing] = useState(false);
  const completedOnceRef = useRef(false);

  useEffect(() => {
    completedOnceRef.current = false;
    setStarted(instant);
    setVisibleCount(instant ? text.length : 0);
    setIsErasing(false);
  }, [text, instant]);

  useEffect(() => {
    if (instant) return;
    const timer = window.setTimeout(() => setStarted(true), startDelay);
    return () => window.clearTimeout(timer);
  }, [instant, startDelay, text]);

  useEffect(() => {
    if (!started || instant) return;

    if (!isErasing && visibleCount >= text.length) {
      if (!completedOnceRef.current) {
        completedOnceRef.current = true;
        onComplete?.();
      }
      if (!loop) return;
      const timer = window.setTimeout(() => setIsErasing(true), pauseAfterTypeMs);
      return () => window.clearTimeout(timer);
    }

    if (isErasing && visibleCount > 0) {
      const timer = window.setTimeout(() => setVisibleCount((count) => count - 1), ERASE_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    if (isErasing && visibleCount === 0) {
      const timer = window.setTimeout(() => {
        setIsErasing(false);
        onLoopRestart?.();
      }, pauseBeforeRestartMs);
      return () => window.clearTimeout(timer);
    }

    if (!isErasing && visibleCount < text.length) {
      const nextChar = text[visibleCount] ?? '';
      const timer = window.setTimeout(
        () => setVisibleCount((count) => count + 1),
        typingDelayForChar(nextChar, visibleCount)
      );
      return () => window.clearTimeout(timer);
    }
  }, [
    started,
    instant,
    isErasing,
    loop,
    onComplete,
    onLoopRestart,
    pauseAfterTypeMs,
    pauseBeforeRestartMs,
    text,
    visibleCount,
  ]);

  const isTyping = started && !isErasing && visibleCount < text.length;
  const showCursor = started && (isTyping || (isErasing && visibleCount > 0));

  return (
    <span className={className} aria-label={text}>
      {text.slice(0, visibleCount)}
      {showCursor ? <span className="thought-type-cursor" aria-hidden="true" /> : null}
    </span>
  );
}
