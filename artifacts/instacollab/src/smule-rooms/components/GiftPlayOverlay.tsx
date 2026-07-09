import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  giftEffectDurationMs,
  resolveGiftEffect,
  type GiftEffectTier,
} from '../../lib/live/giftEffectCatalog';
import type { GiftPlayPayload } from '../utils/liveRoomTypes';
import { GiftSvgaPlayer } from './GiftSvgaPlayer';

type GiftPlayOverlayProps = {
  gift: GiftPlayPayload | null;
  onDone: () => void;
};

type QueuedGift = GiftPlayPayload & { queueKey: string };

type ComboState = {
  key: string;
  senderName: string;
  giftName: string;
  giftIcon: string;
  count: number;
  expiresAt: number;
};

function queueKeyFor(gift: GiftPlayPayload): string {
  return gift.playId ?? `${gift.senderId ?? gift.senderName}-${gift.giftName}-${Date.now()}`;
}

function GiftVideoEffect({ url, onEnded }: { url: string; onEnded: () => void }) {
  return (
    <video
      key={url}
      src={url}
      autoPlay
      muted
      playsInline
      className="pointer-events-none h-full w-full object-contain"
      onEnded={onEnded}
      onError={onEnded}
    />
  );
}

/** TRTC barrage gift — bottom-left strip, no container background. */
function ComboBarrage({ combo }: { combo: ComboState }) {
  return (
    <motion.div
      key={`${combo.key}-${combo.count}`}
      initial={{ opacity: 0, x: -56 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="pointer-events-none flex max-w-[min(76vw,300px)] items-center gap-2"
    >
      <span className="truncate text-xs font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
        {combo.senderName}
      </span>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
        sent
      </span>
      <span className="shrink-0 text-xl leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
        {combo.giftIcon}
      </span>
      {combo.count > 1 ? (
        <motion.span
          key={combo.count}
          initial={{ scale: 1.35, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className="shrink-0 text-sm font-black text-amber-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
        >
          ×{combo.count}
        </motion.span>
      ) : null}
    </motion.div>
  );
}

/** TRTC path gift — flies from bottom-right toward host area (fallback when no SVGA). */
function StandardFlyIn({ gift }: { gift: QueuedGift }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.45, x: '34vw', y: '28vh' }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.45, 1.05, 0.95, 0.8],
        x: ['34vw', '6vw', '-8vw', '-22vw'],
        y: ['28vh', '-4vh', '-16vh', '-24vh'],
      }}
      transition={{ duration: 2.8, ease: 'easeInOut', times: [0, 0.22, 0.72, 1] }}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl sm:text-7xl drop-shadow-[0_6px_20px_rgba(0,0,0,0.55)]"
    >
      {gift.giftIcon}
    </motion.div>
  );
}

function StandardGiftEffect({
  gift,
  svgaUrl,
  videoUrl,
  onFinished,
}: {
  gift: QueuedGift;
  svgaUrl?: string;
  videoUrl?: string;
  onFinished: () => void;
}) {
  if (videoUrl) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[18%] top-[22%] flex items-center justify-center">
        <GiftVideoEffect url={videoUrl} onEnded={onFinished} />
      </div>
    );
  }

  if (svgaUrl) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[12%] top-[18%] flex items-end justify-center">
        <GiftSvgaPlayer
          url={svgaUrl}
          className="pointer-events-none max-h-full max-w-[min(92vw,420px)] w-full"
          onEnded={onFinished}
        />
      </div>
    );
  }

  return <StandardFlyIn gift={gift} />;
}

function FullscreenGiftEffect({
  gift,
  svgaUrl,
  videoUrl,
  onFinished,
}: {
  gift: QueuedGift;
  svgaUrl?: string;
  videoUrl?: string;
  onFinished: () => void;
}) {
  if (videoUrl) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <GiftVideoEffect url={videoUrl} onEnded={onFinished} />
      </div>
    );
  }

  if (svgaUrl) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <GiftSvgaPlayer
          url={svgaUrl}
          className="pointer-events-none h-full w-full max-h-full max-w-full"
          onEnded={onFinished}
        />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.25 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.25, 1.2, 1.05, 1.3] }}
        transition={{ duration: 3.2, ease: 'easeOut', times: [0, 0.16, 0.74, 1] }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span className="text-[clamp(4.5rem,20vw,8rem)] drop-shadow-[0_10px_32px_rgba(0,0,0,0.55)]">
          {gift.giftIcon}
        </span>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -10] }}
        transition={{ duration: 2.6, ease: 'easeOut', times: [0, 0.14, 0.78, 1] }}
        className="pointer-events-none absolute bottom-[16%] left-0 right-0 text-center text-sm font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
      >
        {gift.senderName} sent {gift.giftName} to {gift.receiverName}
      </motion.p>
    </>
  );
}

function ActiveGiftEffect({
  gift,
  tier,
  onFinished,
}: {
  gift: QueuedGift;
  tier: GiftEffectTier;
  onFinished: () => void;
}) {
  const definition = resolveGiftEffect(gift.giftId, gift.giftName);
  const svgaUrl = gift.effectSvgaUrl ?? definition.effectSvgaUrl;
  const videoUrl = gift.effectVideoUrl ?? definition.effectVideoUrl;
  const usesMedia = Boolean(svgaUrl || videoUrl);
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    if (usesMedia) return undefined;

    const ms = giftEffectDurationMs(tier);
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinished();
    }, ms);
    return () => window.clearTimeout(timer);
  }, [gift.queueKey, onFinished, tier, usesMedia]);

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinished();
  }, [onFinished]);

  if (tier === 'standard') {
    return (
      <StandardGiftEffect
        gift={gift}
        svgaUrl={svgaUrl}
        videoUrl={videoUrl}
        onFinished={finishOnce}
      />
    );
  }

  if (tier === 'fullscreen') {
    return (
      <FullscreenGiftEffect
        gift={gift}
        svgaUrl={svgaUrl}
        videoUrl={videoUrl}
        onFinished={finishOnce}
      />
    );
  }

  return null;
}

export function GiftPlayOverlay({ gift, onDone }: GiftPlayOverlayProps) {
  const queueRef = useRef<QueuedGift[]>([]);
  const [active, setActive] = useState<QueuedGift | null>(null);
  const [activeTier, setActiveTier] = useState<GiftEffectTier | null>(null);
  const [combos, setCombos] = useState<ComboState[]>([]);
  const processingRef = useRef(false);

  const pumpQueue = useCallback(() => {
    while (queueRef.current.length > 0) {
      const next = queueRef.current[0];
      const definition = resolveGiftEffect(next.giftId, next.giftName);

      if (definition.tier === 'combo') {
        queueRef.current.shift();
        const comboKey = `${next.senderId ?? next.senderName}:${next.giftId ?? next.giftName}`;
        setCombos((prev) => {
          const existing = prev.find((entry) => entry.key === comboKey);
          if (existing) {
            return prev.map((entry) =>
              entry.key === comboKey
                ? { ...entry, count: entry.count + 1, expiresAt: Date.now() + 2600 }
                : entry,
            );
          }
          return [
            ...prev.slice(-4),
            {
              key: comboKey,
              senderName: next.senderName,
              giftName: next.giftName,
              giftIcon: next.giftIcon,
              count: 1,
              expiresAt: Date.now() + 2600,
            },
          ];
        });
        continue;
      }

      if (processingRef.current) return;
      queueRef.current.shift();
      processingRef.current = true;
      setActive(next);
      setActiveTier(definition.tier);
      return;
    }

    if (!processingRef.current) onDone();
  }, [onDone]);

  useEffect(() => {
    if (!gift) return;
    queueRef.current.push({ ...gift, queueKey: queueKeyFor(gift) });
    pumpQueue();
  }, [gift, pumpQueue]);

  useEffect(() => {
    if (combos.length === 0) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setCombos((prev) => {
        const next = prev.filter((entry) => entry.expiresAt > now);
        return next.length === prev.length ? prev : next;
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [combos.length]);

  const finishActive = useCallback(() => {
    processingRef.current = false;
    setActive(null);
    setActiveTier(null);
    window.setTimeout(pumpQueue, 60);
  }, [pumpQueue]);

  const showStage = Boolean(active && activeTier && activeTier !== 'combo');

  return (
    <div className="pointer-events-none absolute inset-0 z-[120] overflow-hidden bg-transparent">
      <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 flex flex-col gap-1.5 sm:left-4">
        <AnimatePresence mode="popLayout">
          {combos.map((combo) => (
            <ComboBarrage key={combo.key} combo={combo} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {showStage && active && activeTier ? (
          <motion.div
            key={active.queueKey}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-transparent"
          >
            <ActiveGiftEffect gift={active} tier={activeTier} onFinished={finishActive} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
