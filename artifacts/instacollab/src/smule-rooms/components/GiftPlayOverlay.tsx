import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  giftEffectDurationMs,
  resolveGiftEffect,
  resolvePlayTier,
  type GiftEffectTier,
} from '../../lib/live/giftEffectCatalog';
import { giftTierMeta } from '../../lib/live/giftTiers';
import {
  GiftPlaybackScheduler,
  type GiftPlaybackJob,
} from '../../lib/live/giftPlaybackScheduler';
import { canAcceptGiftPlayForFx } from '../../lib/live/giftAuthority';
import type { GiftPlayPayload } from '../utils/liveRoomTypes';
import { GiftSvgaPlayer } from './GiftSvgaPlayer';
import { UniLivesGiftThumbnail } from '../../components/gifts/brand';
import { resolveGiftPlayMedia } from '../../lib/unilives-assets/giftResolve';
import { UniLivesGiftFallback } from '../../components/gifts/brand/UniLivesGiftFallback';
import { findV14GiftSpec } from './liveToolsV14Artwork';
import { V14AnimatedGiftArtwork } from './V14AnimatedArtwork';

type GiftPlayOverlayProps = {
  gift: GiftPlayPayload | null;
  onDone: () => void;
  /** Admin / catalog preview may omit settlement ids. */
  allowPreview?: boolean;
};

type QueuedGift = GiftPlayPayload & { queueKey: string };

type ComboState = {
  key: string;
  senderName: string;
  giftName: string;
  giftIcon: string;
  giftId?: string;
  count: number;
  expiresAt: number;
};

function jobToQueuedGift(job: GiftPlaybackJob): QueuedGift {
  return {
    action: 'play',
    playId: job.playbackJobId,
    giftId: job.giftId,
    giftName: job.giftName,
    giftIcon: job.giftIcon,
    starValue: job.starValue,
    senderName: job.senderName,
    senderId: job.senderUserId,
    receiverName: job.receiverName,
    receiverUserId: job.recipientHostId,
    effectSvgaUrl: job.effectKind === 'svga' ? job.effectUrl ?? undefined : undefined,
    effectVideoUrl: job.effectKind === 'video' ? job.effectUrl ?? undefined : undefined,
    quantity: job.comboQuantity,
    combo: job.comboQuantity,
    roomId: job.roomId,
    giftTransactionId: job.giftTransactionIds[0],
    queueKey: job.playbackJobId,
  };
}

function payloadToIncoming(
  gift: GiftPlayPayload,
  roomFallback: string,
): Parameters<GiftPlaybackScheduler['ingest']>[0] {
  const qty = Math.max(
    1,
    Math.floor(
      typeof gift.quantity === 'number' && Number.isFinite(gift.quantity)
        ? gift.quantity
        : typeof gift.combo === 'number' && Number.isFinite(gift.combo)
          ? gift.combo
          : 1,
    ),
  );
  const tier = resolvePlayTier({
    giftId: gift.giftId,
    giftName: gift.giftName,
    starValue: gift.starValue,
  });
  const effectUrl = gift.effectSvgaUrl || gift.effectVideoUrl || null;
  const effectKind = gift.effectSvgaUrl ? 'svga' : gift.effectVideoUrl ? 'video' : null;
  return {
    eventId: gift.eventId ?? gift.giftTransactionId ?? gift.playId ?? null,
    sequence: gift.sequence ?? null,
    occurredAt: gift.occurredAt ?? (gift.timestamp ? gift.timestamp * 1000 : Date.now()),
    expiresAt: gift.expiresAt ?? null,
    replayPolicy: gift.replayPolicy ?? 'ACTIVE_FX',
    roomId: gift.roomId?.trim() || roomFallback || 'room',
    recipientHostId: gift.receiverUserId?.trim() || gift.receiverName || 'host',
    senderUserId: gift.senderId?.trim() || gift.senderName || 'guest',
    senderName: gift.senderName,
    giftId: gift.giftId?.trim() || gift.giftName,
    giftVariantId: gift.giftVariantId ?? 'default',
    giftName: gift.giftName,
    giftIcon: gift.giftIcon,
    quantity: qty,
    unitValue: gift.starValue,
    starValue: gift.starValue,
    effectUrl,
    effectKind,
    receiverName: gift.receiverName,
    barrageOnly: tier === 'normal',
    giftTransactionId: gift.giftTransactionId ?? null,
  };
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

/** Normal · 1–99 — small icon barrage (bottom-left). */
function ComboBarrage({ combo }: { combo: ComboState }) {
  const approved = findV14GiftSpec(combo.giftId, combo.giftName);
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
        {approved ? (
          <V14AnimatedGiftArtwork
            giftId={approved.giftId}
            giftName={approved.name}
            src={approved.artwork}
            className="h-5 w-5 align-middle"
            imgClassName="h-full w-full object-contain"
            playKey={`${combo.key}-${combo.count}`}
          />
        ) : (
          <UniLivesGiftThumbnail
            businessGiftId={combo.giftId}
            legacyIcon={combo.giftIcon}
            imgClassName="inline-block h-5 w-5 object-contain align-middle"
          />
        )}
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

/** Premium fallback — flies from bottom-right toward host. */
function StandardFlyIn({ gift }: { gift: QueuedGift }) {
  const approved = findV14GiftSpec(gift.giftId, gift.giftName);
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
      {approved ? (
        <V14AnimatedGiftArtwork
          giftId={approved.giftId}
          giftName={approved.name}
          src={approved.artwork}
          className="h-20 w-20 sm:h-24 sm:w-24"
          imgClassName="h-full w-full object-contain"
          playKey={gift.queueKey}
        />
      ) : (
        <UniLivesGiftThumbnail
          businessGiftId={gift.giftId}
          legacyIcon={gift.giftIcon}
          imgClassName="h-20 w-20 sm:h-24 sm:w-24 object-contain"
        />
      )}
    </motion.div>
  );
}

function MediumSvgaEffect({
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

function FullscreenSvgaEffect({
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
  const approved = findV14GiftSpec(gift.giftId, gift.giftName);
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
          {approved ? (
            <V14AnimatedGiftArtwork
              giftId={approved.giftId}
              giftName={approved.name}
              src={approved.artwork}
              className="h-[clamp(4.5rem,20vw,8rem)] w-[clamp(4.5rem,20vw,8rem)]"
              imgClassName="h-full w-full object-contain"
              playKey={gift.queueKey}
            />
          ) : (
            <UniLivesGiftThumbnail
              businessGiftId={gift.giftId}
              legacyIcon={gift.giftIcon}
              imgClassName="h-[clamp(4.5rem,20vw,8rem)] w-[clamp(4.5rem,20vw,8rem)] object-contain"
            />
          )}
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

/** Legendary · cinematic vignette + oversized icon / SVGA. */
function CinematicGiftEffect({
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
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0.45, 0] }}
        transition={{ duration: 5.2, times: [0, 0.12, 0.78, 1] }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.35),transparent_62%)]"
      />
      <FullscreenSvgaEffect gift={gift} svgaUrl={svgaUrl} videoUrl={videoUrl} onFinished={onFinished} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.92 }}
        animate={{ opacity: [0, 1, 1, 0], y: [24, 0, 0, -8], scale: [0.92, 1, 1, 1.02] }}
        transition={{ duration: 4.8, times: [0, 0.12, 0.8, 1] }}
        className="pointer-events-none absolute bottom-[12%] left-0 right-0 flex flex-col items-center gap-1 px-4 text-center"
      >
        <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">
          Legendary
        </span>
        <p className="text-sm font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {gift.senderName} sent {gift.giftName} to {gift.receiverName}
        </p>
      </motion.div>
    </>
  );
}

/** Mythic · multi-stage: global announcement → fullscreen effect. */
function MythicGiftEffect({
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
  const [stage, setStage] = useState<'announce' | 'effect'>('announce');

  useEffect(() => {
    const timer = window.setTimeout(() => setStage('effect'), 500);
    return () => window.clearTimeout(timer);
  }, [gift.queueKey]);

  return (
    <>
      <AnimatePresence>
        {stage === 'announce' ? (
          <motion.div
            key="mythic-announce"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-x-0 top-[12%] z-10 flex justify-center px-4"
          >
            <div className="max-w-md rounded-2xl border border-fuchsia-300/50 bg-gradient-to-r from-fuchsia-700/80 via-violet-700/80 to-amber-600/70 px-4 py-3 text-center shadow-[0_12px_40px_rgba(192,38,211,0.45)] backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-100">
                Global Mythic Gift
              </p>
              <p className="mt-1 text-sm font-black text-white inline-flex items-center justify-center gap-1.5 flex-wrap">
                {gift.senderName} sent{' '}
                <UniLivesGiftThumbnail
                  businessGiftId={gift.giftId}
                  legacyIcon={gift.giftIcon}
                  imgClassName="h-5 w-5 object-contain"
                />{' '}
                {gift.giftName}
              </p>
              <p className="text-[11px] font-semibold text-white/80">
                to {gift.receiverName} · {gift.starValue.toLocaleString()} coins
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.5, 0] }}
        transition={{ duration: 7.2, times: [0, 0.1, 0.82, 1] }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(232,121,249,0.4),transparent_58%)]"
      />

      {stage === 'effect' ? (
        <FullscreenSvgaEffect gift={gift} svgaUrl={svgaUrl} videoUrl={videoUrl} onFinished={onFinished} />
      ) : null}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 7, times: [0, 0.08, 0.86, 1] }}
        className="pointer-events-none absolute bottom-[10%] left-0 right-0 flex justify-center px-4"
      >
        <div className="rounded-full border border-fuchsia-200/40 bg-black/45 px-4 py-1.5 text-[11px] font-bold text-fuchsia-50 shadow-lg backdrop-blur-sm">
          Mythic event · room-wide announcement
        </div>
      </motion.div>
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
  const approved = findV14GiftSpec(gift.giftId, gift.giftName);
  const media = resolveGiftPlayMedia({
    businessGiftId: gift.giftId,
    legacySvgaUrl: gift.effectSvgaUrl ?? definition.effectSvgaUrl,
    legacyVideoUrl: gift.effectVideoUrl ?? definition.effectVideoUrl,
  });
  const svgaUrl = media.preferStatic ? undefined : media.svgaUrl;
  const videoUrl = media.preferStatic ? undefined : media.videoUrl;
  const usesMedia = Boolean(svgaUrl || videoUrl) || media.preferStatic;
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    if (usesMedia && tier !== 'mythic' && tier !== 'legendary') return undefined;
    // Mythic/legendary keep a timer even with media so multi-stage can finish cleanly
    // when SVGA ends early; media onEnded still wins via finishOnce.
    if (usesMedia && (tier === 'mythic' || tier === 'legendary')) return undefined;

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

  // Fallback timer for cinematic/mythic when media is present but may not fire onEnded.
  useEffect(() => {
    if (!(tier === 'legendary' || tier === 'mythic')) return undefined;
    const ms = giftEffectDurationMs(tier) + (tier === 'mythic' ? 400 : 0);
    const timer = window.setTimeout(() => finishOnce(), ms);
    return () => window.clearTimeout(timer);
  }, [finishOnce, gift.queueKey, tier]);

  if (media.preferStatic) {
    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
        {approved ? (
          <V14AnimatedGiftArtwork
            giftId={approved.giftId}
            giftName={approved.name}
            src={approved.artwork}
            className="h-[min(40vh,280px)] w-[min(70vw,280px)]"
            imgClassName="h-full w-full object-contain"
            animate={false}
            playKey={gift.queueKey}
          />
        ) : (
          <UniLivesGiftFallback
            src={media.staticUrl}
            className="max-h-[40vh] max-w-[min(70vw,280px)] object-contain"
          />
        )}
        <p className="px-4 text-center text-sm font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {gift.senderName} sent {gift.giftName} to {gift.receiverName}
        </p>
        <StaticFinish onFinished={finishOnce} />
      </div>
    );
  }

  if (tier === 'premium') {
    return (
      <MediumSvgaEffect gift={gift} svgaUrl={svgaUrl} videoUrl={videoUrl} onFinished={finishOnce} />
    );
  }

  if (tier === 'epic') {
    return (
      <FullscreenSvgaEffect gift={gift} svgaUrl={svgaUrl} videoUrl={videoUrl} onFinished={finishOnce} />
    );
  }

  if (tier === 'legendary') {
    return (
      <CinematicGiftEffect gift={gift} svgaUrl={svgaUrl} videoUrl={videoUrl} onFinished={finishOnce} />
    );
  }

  if (tier === 'mythic') {
    return (
      <MythicGiftEffect gift={gift} svgaUrl={svgaUrl} videoUrl={videoUrl} onFinished={finishOnce} />
    );
  }

  return null;
}

function StaticFinish({ onFinished }: { onFinished: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onFinished, 1800);
    return () => window.clearTimeout(timer);
  }, [onFinished]);
  return null;
}

export function GiftPlayOverlay({ gift, onDone, allowPreview = false }: GiftPlayOverlayProps) {
  const schedulerRef = useRef(new GiftPlaybackScheduler());
  const lastIngestKeyRef = useRef<string | null>(null);
  const [active, setActive] = useState<QueuedGift | null>(null);
  const [activeTiers, setActiveTiers] = useState<GiftEffectTier | null>(null);
  const [combos, setCombos] = useState<ComboState[]>([]);
  const [globalAnnouncement, setGlobalAnnouncement] = useState<QueuedGift | null>(null);
  const processingRef = useRef(false);

  const syncCombos = useCallback(() => {
    const rows = schedulerRef.current.getComboHud();
    setCombos(
      rows.map((row) => ({
        key: row.key,
        senderName: row.senderName,
        giftName: row.giftName,
        giftIcon: row.giftIcon,
        giftId: row.giftId,
        count: row.count,
        expiresAt: row.expiresAt,
      })),
    );
  }, []);

  const pumpQueue = useCallback(() => {
    const scheduler = schedulerRef.current;
    if (processingRef.current && scheduler.getActive()) {
      syncCombos();
      return;
    }

    const next = scheduler.pump();
    if (!next) {
      processingRef.current = false;
      setActive(null);
      setActiveTiers(null);
      syncCombos();
      onDone();
      return;
    }

    const queued = jobToQueuedGift(next);
    const tier = resolvePlayTier({
      giftId: queued.giftId,
      giftName: queued.giftName,
      starValue: queued.starValue,
    });
    processingRef.current = true;
    setActive(queued);
    setActiveTiers(tier);
    if (tier === 'mythic') {
      setGlobalAnnouncement(queued);
    }
    syncCombos();
  }, [onDone, syncCombos]);

  useEffect(() => {
    if (!gift) return;
    if (!canAcceptGiftPlayForFx(gift, { allowPreview })) return;
    const ingestKey =
      gift.eventId ??
      gift.giftTransactionId ??
      gift.playId ??
      `${gift.senderId}:${gift.giftId}:${gift.timestamp}:${gift.quantity}`;
    if (lastIngestKeyRef.current === ingestKey) return;
    lastIngestKeyRef.current = ingestKey;

    const result = schedulerRef.current.ingest(payloadToIncoming(gift, gift.roomId ?? 'room'));
    if (!result.accepted) return;

    // Combo update while PLAYING: refresh HUD only — do not restart animation.
    if (result.comboUpdated && processingRef.current) {
      syncCombos();
      return;
    }
    pumpQueue();
  }, [gift, allowPreview, pumpQueue, syncCombos]);

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

  useEffect(() => {
    if (!globalAnnouncement) return undefined;
    const timer = window.setTimeout(() => setGlobalAnnouncement(null), 9000);
    return () => window.clearTimeout(timer);
  }, [globalAnnouncement]);

  const finishActive = useCallback(() => {
    const activeJob = schedulerRef.current.getActive();
    schedulerRef.current.finishActive(activeJob?.playbackJobId);
    processingRef.current = false;
    setActive(null);
    setActiveTiers(null);
    window.setTimeout(pumpQueue, 60);
  }, [pumpQueue]);

  const showStage = Boolean(active && activeTiers && activeTiers !== 'normal');

  return (
    <div className="pointer-events-none absolute inset-0 z-[120] overflow-hidden bg-transparent">
      <AnimatePresence>
        {globalAnnouncement ? (
          <motion.div
            key={`global-${globalAnnouncement.queueKey}`}
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex justify-center px-3"
          >
            <div className="flex max-w-lg items-center gap-2 rounded-full border border-fuchsia-300/45 bg-black/70 px-3 py-1.5 text-[11px] font-bold text-fuchsia-50 shadow-xl backdrop-blur-md">
              <span className="text-base leading-none">
                <UniLivesGiftThumbnail
                  businessGiftId={globalAnnouncement.giftId}
                  legacyIcon={globalAnnouncement.giftIcon}
                  imgClassName="h-4 w-4 object-contain"
                />
              </span>
              <span className="truncate">
                Mythic · {globalAnnouncement.senderName} → {globalAnnouncement.receiverName} ·{' '}
                {globalAnnouncement.giftName}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 flex flex-col gap-1.5 sm:left-4">
        <AnimatePresence mode="popLayout">
          {combos.map((combo) => (
            <ComboBarrage key={combo.key} combo={combo} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showStage && active && activeTiers ? (
          <motion.div
            key={active.queueKey}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-transparent"
          >
            <ActiveGiftEffect gift={active} tier={activeTiers} onFinished={finishActive} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Optional helper for panel labels. */
export function giftTierLabel(tier: GiftEffectTier): string {
  return giftTierMeta(tier).label;
}
