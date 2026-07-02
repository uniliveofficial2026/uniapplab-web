import React, { useCallback, useEffect, useLayoutEffect, useState, useRef, useSyncExternalStore, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Pencil } from 'lucide-react';
import { ThoughtTypingText } from './ThoughtTypingText';
import {
  pickActiveThoughtBubblePortal,
  registerThoughtBubblePortal,
  subscribeThoughtBubblePortal,
  unregisterThoughtBubblePortal,
  updateThoughtBubblePortalVisibility,
} from './thoughtBubblePortalRegistry';
import { useAppOverlayOpen } from '../../lib/appOverlayDetect';
import { useFeedScrolling } from '../../lib/feedScrollActivity';

const BUBBLE_WIDTH = 64;

/** Slower, bouncier pop — reads more “dramatic” than the previous snappy spring */
const POP_SPRING = { type: 'spring' as const, stiffness: 320, damping: 17, mass: 1.05 };
const TAIL_SPRING = { type: 'spring' as const, stiffness: 380, damping: 16, mass: 0.85 };
const TYPING_START_DELAY_MS = 720;

const TAIL_2_DELAY_S = 0.06;
const TAIL_1_DELAY_S = 0.28;
const BODY_DELAY_S = 0.48;

type ThoughtBubbleShellProps = {
  noteText: string;
  /** Bumps when the thought was saved — replays pop/typing on cross-device sync. */
  animationEpoch?: number;
  onOpen: () => void;
  className?: string;
  style?: React.CSSProperties;
};

function noteTypography(noteLength: number) {
  if (noteLength > 45) return 'text-[7.5px] tracking-tight line-clamp-3';
  if (noteLength > 30) return 'text-[8px] tracking-tight line-clamp-3';
  if (noteLength > 15) return 'text-[8.5px] line-clamp-2';
  return 'text-[9px] line-clamp-2';
}

/** Shared thought bubble — pops from avatar, then types the thought letter by letter. */
export function ThoughtBubbleShell({
  noteText,
  animationEpoch = 0,
  onOpen,
  className = '',
  style,
}: ThoughtBubbleShellProps) {
  const reduceMotion = useReducedMotion();
  const instant = !!reduceMotion;
  const [introDone, setIntroDone] = useState(instant);
  const [cycleKey, setCycleKey] = useState(0);
  const fontSizeClass = noteTypography(noteText.length);

  useEffect(() => {
    setIntroDone(instant);
    setCycleKey((key) => key + 1);
  }, [noteText, animationEpoch, instant]);

  useEffect(() => {
    if (instant) {
      setIntroDone(true);
      return;
    }
    const ms = (BODY_DELAY_S + 0.4) * 1000;
    const timer = window.setTimeout(() => setIntroDone(true), ms);
    return () => window.clearTimeout(timer);
  }, [cycleKey, instant]);

  const handleLoopRestart = useCallback(() => {
    if (instant) return;
    setCycleKey((key) => key + 1);
  }, [instant]);

  const tailFromAvatar = instant
    ? false
    : { scale: 0, opacity: 0, x: 14, y: 16 };
  const tailVisible = { scale: 1, opacity: 1, x: 0, y: 0 };
  const bodyFromAvatar = instant
    ? false
    : { scale: 0.04, opacity: 0, x: 22, y: 26 };
  const bodyVisible = { scale: 1, opacity: 1, x: 0, y: 0 };

  return (
    <div
      className={`${introDone ? 'thought-bubble-living' : ''} ${className}`}
      style={style}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`View thought: ${noteText}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            onOpen();
          }
        }}
        className="thought-bubble-interactive relative h-[42px] w-[64px] origin-bottom-left cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
      {/* Tail nearest avatar — emerges first */}
      <motion.div
        key={`thought-tail-2-${cycleKey}`}
        className="thought-bubble-tail-2 absolute bottom-[-2px] left-[1px] w-1.5 h-1.5 rounded-full bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border-[1px] border-white/80 dark:border-white/10 z-[-1]"
        initial={tailFromAvatar}
        animate={tailVisible}
        transition={{ ...TAIL_SPRING, delay: instant ? 0 : TAIL_2_DELAY_S }}
      />

      {/* Middle tail */}
      <motion.div
        key={`thought-tail-1-${cycleKey}`}
        className="thought-bubble-tail-1 absolute bottom-[1px] left-[6px] w-2.5 h-2.5 rounded-full bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border-[1.5px] border-white/80 dark:border-white/10 shadow-[0_4px_8px_rgba(0,0,0,0.08),inset_0_2px_3px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_8px_rgba(0,0,0,0.4),inset_0_2px_3px_rgba(255,255,255,0.05)] z-[-1]"
        initial={tailFromAvatar}
        animate={tailVisible}
        transition={{ ...TAIL_SPRING, delay: instant ? 0 : TAIL_1_DELAY_S }}
      >
        <div className="absolute top-[1px] left-[1px] w-[70%] h-[40%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-full pointer-events-none" />
      </motion.div>

      {/* Main bubble — pops out from avatar */}
      <motion.div
        key={`thought-body-${cycleKey}`}
        className="thought-bubble-body flex justify-center items-center w-[64px] h-[42px] px-[8px] py-[3px] relative bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border-[1.5px] border-white/80 dark:border-white/10 shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_3px_5px_rgba(255,255,255,0.9),inset_0_-1.5px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_6px_12px_rgba(0,0,0,0.4),inset_0_3px_5px_rgba(255,255,255,0.05),inset_0_-1.5px_4px_rgba(0,0,0,0.2)] text-black dark:text-white"
        style={{ borderRadius: '50%', transformOrigin: 'bottom left' }}
        initial={bodyFromAvatar}
        animate={bodyVisible}
        transition={{
          ...(instant ? { duration: 0 } : POP_SPRING),
          delay: instant ? 0 : BODY_DELAY_S,
        }}
      >
        <div className="thought-bubble-shimmer absolute top-[2px] left-[5%] w-[90%] h-[35%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-t-full pointer-events-none" />
        <ThoughtTypingText
          key={`thought-text-${cycleKey}`}
          text={noteText}
          instant={instant}
          loop={!instant}
          startDelay={instant ? 0 : TYPING_START_DELAY_MS}
          pauseAfterTypeMs={3400}
          pauseBeforeRestartMs={650}
          onLoopRestart={handleLoopRestart}
          className={`relative z-10 px-1 whitespace-normal break-words drop-shadow-md dark:drop-shadow-none text-center w-full leading-[1.05] font-black ${fontSizeClass}`}
        />
      </motion.div>
      </div>
    </div>
  );
}

/** Inline bubble anchored to avatar — scrolls with carousel rows and feed post headers. */
export function InlineAvatarThoughtBubble({
  noteText,
  animationEpoch,
  onOpen,
}: {
  noteText: string;
  animationEpoch?: number;
  onOpen: () => void;
}) {
  return (
    <ThoughtBubbleShell
      noteText={noteText}
      animationEpoch={animationEpoch}
      onOpen={onOpen}
      className="absolute bottom-[85%] left-[70%] mb-[10px] z-30 pointer-events-auto"
    />
  );
}

type AvatarThoughtBubbleProps = {
  anchorRef: RefObject<HTMLElement | null>;
  noteText: string;
  animationEpoch?: number;
  userId: string;
  onOpen: () => void;
};

export function AvatarThoughtBubble({
  anchorRef,
  noteText,
  animationEpoch,
  userId,
  onOpen,
}: AvatarThoughtBubbleProps) {
  const instanceIdRef = useRef<number | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [isAnchorVisible, setIsAnchorVisible] = useState(false);

  const activeInstanceId = useSyncExternalStore(
    subscribeThoughtBubblePortal,
    () => pickActiveThoughtBubblePortal(userId),
    () => null
  );

  const isActiveWinner = activeInstanceId !== null && activeInstanceId === instanceIdRef.current;

  useLayoutEffect(() => {
    const instanceId = registerThoughtBubblePortal({
      userId,
      anchorRef,
      noteText,
      onOpen: () => onOpenRef.current(),
    });
    instanceIdRef.current = instanceId;

    return () => {
      unregisterThoughtBubblePortal(instanceId);
      instanceIdRef.current = null;
    };
  }, [anchorRef, noteText, userId]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const instanceId = instanceIdRef.current;
    if (!anchor || instanceId === null || typeof window === 'undefined') {
      setCoords(null);
      setIsAnchorVisible(false);
      updateThoughtBubblePortalVisibility(instanceId ?? -1, 0, false);
      return;
    }

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const margin = 8;

      let left = rect.left + rect.width * 0.7;
      if (left + BUBBLE_WIDTH > window.innerWidth - margin) {
        left = window.innerWidth - BUBBLE_WIDTH - margin;
      }
      left = Math.max(margin, left);

      const top = Math.max(margin, rect.top - 10);
      setCoords({ left, top });
    };

    const updateVisibility = (entry: IntersectionObserverEntry | undefined) => {
      const ratio = entry?.intersectionRatio ?? 0;
      const intersecting = !!(entry?.isIntersecting && ratio >= 0.35);
      setIsAnchorVisible(intersecting);
      updateThoughtBubblePortalVisibility(instanceId, ratio, intersecting);
    };

    updatePosition();

    const scrollParents = collectScrollParents(anchor);
    const resizeObserver = new ResizeObserver(() => {
      updatePosition();
    });

    resizeObserver.observe(anchor);
    for (const parent of scrollParents) {
      resizeObserver.observe(parent);
      parent.addEventListener('scroll', updatePosition, { passive: true });
    }

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => updateVisibility(entry),
      { root: null, threshold: [0, 0.35, 0.6, 1] }
    );
    intersectionObserver.observe(anchor);

    window.addEventListener('resize', updatePosition);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      updateThoughtBubblePortalVisibility(instanceId, 0, false);
      for (const parent of scrollParents) {
        parent.removeEventListener('scroll', updatePosition);
      }
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, noteText, userId]);

  if (!coords || !isAnchorVisible || !isActiveWinner || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed z-[125] pointer-events-none"
      style={{
        left: coords.left,
        top: coords.top,
        transform: 'translateY(-100%)',
      }}
    >
      <ThoughtBubbleShell
        noteText={noteText}
        animationEpoch={animationEpoch}
        onOpen={onOpen}
        className="pointer-events-auto"
      />
    </div>,
    document.body
  );
}

function collectScrollParents(node: HTMLElement | null): HTMLElement[] {
  const parents: HTMLElement[] = [];
  let current = node?.parentElement ?? null;
  while (current) {
    const style = window.getComputedStyle(current);
    if (
      /(auto|scroll|overlay)/.test(style.overflowY) ||
      /(auto|scroll|overlay)/.test(style.overflowX)
    ) {
      parents.push(current);
    }
    current = current.parentElement;
  }
  return parents;
}

type ThoughtComposerBubblePortalProps = {
  anchorRef: RefObject<HTMLElement | null>;
  visible: boolean;
  onOpen: () => void;
  mode: 'add' | 'edit';
  variant?: 'feed' | 'profile';
};

/** Portaled + / Edit affordance — avoids sibling columns stealing clicks above the avatar. */
export function ThoughtComposerBubblePortal({
  anchorRef,
  visible,
  onOpen,
  mode,
  variant = 'feed',
}: ThoughtComposerBubblePortalProps) {
  const overlayOpen = useAppOverlayOpen();
  const feedScrolling = useFeedScrolling();
  const hideWhileScrolling = variant === 'feed' && feedScrolling;
  const showBubble = visible && !overlayOpen && !hideWhileScrolling;
  const [coords, setCoords] = useState<{ left: number; top: number; scale: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!showBubble) {
      setCoords(null);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor || typeof window === 'undefined') {
      setCoords(null);
      return;
    }

    const anchorX = variant === 'profile' ? 0.66 : 0.7;
    const scale = variant === 'profile' ? 1.35 : 1;

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const width = mode === 'edit' ? 72 : BUBBLE_WIDTH;

      let left = rect.left + rect.width * anchorX;
      if (left + width * scale > window.innerWidth - margin) {
        left = window.innerWidth - width * scale - margin;
      }
      left = Math.max(margin, left);

      const top = Math.max(margin, rect.top - (variant === 'profile' ? 6 : 10));
      setCoords({ left, top, scale });
    };

    updatePosition();

    const scrollParents = collectScrollParents(anchor);
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(anchor);
    for (const parent of scrollParents) {
      resizeObserver.observe(parent);
      parent.addEventListener('scroll', updatePosition, { passive: true });
    }

    window.addEventListener('resize', updatePosition);

    return () => {
      resizeObserver.disconnect();
      for (const parent of scrollParents) {
        parent.removeEventListener('scroll', updatePosition);
      }
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, showBubble, mode, variant]);

  if (!showBubble || !coords || typeof document === 'undefined') {
    return null;
  }

  const openProps = {
    role: 'button' as const,
    tabIndex: 0,
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onOpen();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.stopPropagation();
      e.preventDefault();
      onOpen();
    },
  };

  return createPortal(
    <div
      id="story-thought-composer-portal"
      className="fixed z-[9998] pointer-events-none"
      style={{
        left: coords.left,
        top: coords.top,
        transform: `translateY(-100%) scale(${coords.scale})`,
        transformOrigin: 'bottom left',
      }}
    >
      {mode === 'add' ? (
        <div
          {...openProps}
          aria-label="Add a thought"
          className="pointer-events-auto w-[64px] h-[42px] cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none"
        >
          <div
            className="flex justify-center items-center w-[64px] h-[42px] px-[8px] py-[3px] relative bg-white/15 dark:bg-zinc-800/20 backdrop-blur-sm border-[1.5px] border-dashed border-black/25 dark:border-white/20 hover:bg-white/30 dark:hover:bg-zinc-800/40 hover:border-black/40 dark:hover:border-white/40 shadow-sm text-black/40 dark:text-white/40 transition-all duration-200"
            style={{ borderRadius: '50%' }}
            title="Add a thought..."
          >
            <span className="text-[10px] font-bold select-none">+</span>
          </div>
          <div className="absolute bottom-[1px] left-[6px] w-2.5 h-2.5 rounded-full border-[1.5px] border-dashed border-black/25 dark:border-white/20 z-[-1]" />
          <div className="absolute bottom-[-2px] left-[1px] w-1.5 h-1.5 rounded-full border-[1px] border-dashed border-black/20 dark:border-white/15 z-[-1]" />
        </div>
      ) : (
        <div
          {...openProps}
          aria-label="Edit your thought"
          title="Edit thought..."
          className="pointer-events-auto flex h-[34px] w-[72px] cursor-pointer items-center justify-center gap-1 rounded-full border-[1.5px] border-dashed border-black/25 bg-white/15 shadow-sm transition-transform duration-200 hover:scale-105 hover:border-black/40 hover:bg-white/30 active:scale-95 dark:border-white/20 dark:bg-zinc-800/20 dark:hover:border-white/40 dark:hover:bg-zinc-800/40 motion-reduce:transition-none"
        >
          <Pencil className="h-3 w-3 text-black/50 dark:text-white/50" strokeWidth={2.5} />
          <span className="text-[9px] font-bold text-black/50 dark:text-white/50">Edit</span>
        </div>
      )}
    </div>,
    document.body,
  );
}
