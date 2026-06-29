import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, AudioLines, Maximize2, Minimize2, Mic2, Mic, Disc, RotateCcw } from 'lucide-react';
import { formatTrackTime, getActiveLyricIndex, resolveActiveSong } from '../utils/songPerformance';
import { getUploadMetaById } from '../utils/karaokeUploadBridge';
import { loadKaraokeUploadMedia } from '../../lib/karaokeUploads';
import { useLyricAutoScroll } from '../hooks/useLyricAutoScroll';
import {
  VOICE_CHANGER_EFFECTS,
  getVoiceChangerEffect,
  type VoiceChangerEffectId,
} from '../utils/voiceEffects';
import type { SingingVoiceStatus } from '../hooks/useSingingSession';
import { formatSingingStatusLine, voiceStatusLabel } from '../utils/singingVoiceStatus';

interface LyricsOverlayProps {
  isOpen: boolean;
  song: { id?: string; title: string; artist: string } | null;
  onClose: () => void;
  onSing?: () => void;
  isPerforming?: boolean;
  elapsedSec?: number;
  progressPercent?: number;
  micLevel?: number;
  voiceStatus?: SingingVoiceStatus;
  voiceEffect?: VoiceChangerEffectId;
  onVoiceEffectChange?: (effect: VoiceChangerEffectId) => void;
}

function LyricsLines({
  lines,
  activeIndex,
  large,
  lineRefs,
}: {
  lines: string[];
  activeIndex: number;
  large?: boolean;
  lineRefs?: React.MutableRefObject<(HTMLParagraphElement | null)[]>;
}) {
  const muted = large
    ? 'text-[15px] text-white/45 leading-relaxed'
    : 'text-[10px] text-gray-500 leading-tight';
  const upcoming = large
    ? 'text-[15px] text-white/75 leading-relaxed'
    : 'text-[10px] text-gray-400 leading-tight';
  const active = large
    ? 'text-[20px] text-[#ffd147] font-black leading-relaxed drop-shadow-[0_0_10px_rgba(255,209,71,0.4)]'
    : 'text-[10px] text-[#ffd147] font-black leading-tight';

  return (
    <>
      {lines.map((line, index) => (
        <p
          key={`${line}-${index}`}
          ref={(node) => {
            if (lineRefs) lineRefs.current[index] = node;
          }}
          className={
            index === activeIndex
              ? active
              : index < activeIndex
                ? muted
                : upcoming
          }
        >
          {line}
        </p>
      ))}
    </>
  );
}

function SingingMicRail({
  progressPercent,
  micLevel,
  voiceStatus,
}: {
  progressPercent: number;
  micLevel: number;
  voiceStatus: SingingVoiceStatus;
}) {
  const railClass =
    voiceStatus === 'strong'
      ? 'bg-red-500/20 border-red-500/40'
      : voiceStatus === 'good'
        ? 'bg-green-500/20 border-green-500/40'
        : voiceStatus === 'warming'
          ? 'bg-amber-500/20 border-amber-500/40'
          : 'bg-white/5 border-white/10';

  const barClass =
    voiceStatus === 'strong'
      ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
      : voiceStatus === 'good'
        ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]'
        : voiceStatus === 'warming'
          ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
          : 'bg-white/30';

  return (
    <div className={`absolute left-4 top-1/4 bottom-1/3 w-[3px] rounded-full z-20 flex flex-col justify-end border ${railClass}`}>
      <div
        className={`w-full rounded-full transition-all duration-300 relative ${barClass}`}
        style={{ height: `${Math.max(micLevel, progressPercent * 0.35)}%` }}
      >
        <div className="absolute -left-[10px] -top-[12px] w-6 h-6 rounded-full border-2 border-white/80 bg-black/70 flex items-center justify-center shadow-lg">
          <Mic className="w-3.5 h-3.5 text-white fill-white/80" />
        </div>
        {micLevel > 8 && (
          <div className="absolute left-8 -top-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap bg-black/85 backdrop-blur border border-white/15 text-white">
            {voiceStatusLabel(voiceStatus)}
          </div>
        )}
      </div>
    </div>
  );
}

export function LyricsOverlay({
  isOpen,
  song,
  onClose,
  onSing,
  isPerforming = false,
  elapsedSec = 0,
  progressPercent = 0,
  micLevel = 0,
  voiceStatus = 'silent',
  voiceEffect = 'studio',
  onVoiceEffectChange,
}: LyricsOverlayProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isVoiceChangerOpen, setIsVoiceChangerOpen] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewElapsedSec, setPreviewElapsedSec] = useState(0);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const previewStartedAtRef = useRef(0);
  const previewStartOffsetRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const compactCardRef = useRef<HTMLDivElement | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const clampCardPosition = useCallback((x: number, y: number) => {
    const card = compactCardRef.current;
    const width = card?.offsetWidth ?? 280;
    const height = card?.offsetHeight ?? 311;
    const margin = 8;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - width - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - height - margin, y)),
    };
  }, []);

  const handleCardDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isFullScreen || event.button !== 0) return;
    const card = compactCardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cardPosition?.x ?? rect.left,
      originY: cardPosition?.y ?? rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [cardPosition, isFullScreen]);

  const handleCardDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const next = clampCardPosition(
      drag.originX + (event.clientX - drag.startX),
      drag.originY + (event.clientY - drag.startY),
    );
    setCardPosition(next);
  }, [clampCardPosition]);

  const handleCardDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsFullScreen(false);
      setIsVoiceChangerOpen(false);
      setIsPreviewPlaying(false);
      setPreviewElapsedSec(0);
      setCardPosition(null);
      dragRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isPerforming) {
      setIsPreviewPlaying(false);
    }
  }, [isPerforming]);

  const resolvedSong = song ? resolveActiveSong(song) : null;
  const displayElapsedSec = isPerforming ? elapsedSec : previewElapsedSec;
  const displayDurationSec = resolvedSong?.durationSec ?? 0;
  const displayProgressPercent = displayDurationSec > 0
    ? Math.min(100, (displayElapsedSec / displayDurationSec) * 100)
    : progressPercent;
  const activeLyricIndex = resolvedSong
    ? getActiveLyricIndex(
        displayElapsedSec,
        displayDurationSec,
        resolvedSong.lyrics.length,
        resolvedSong.lyricStartTimes,
      )
    : 0;

  useLyricAutoScroll(activeLyricIndex, scrollRef, lineRefs, isFullScreen ? 'smooth' : 'auto');

  useEffect(() => {
    if (!isOpen || !resolvedSong) return;
    setPreviewElapsedSec(0);
    setIsPreviewPlaying(false);
  }, [isOpen, resolvedSong?.id]);

  useEffect(() => {
    if (!isOpen || !song?.id || isPerforming) {
      setPreviewAudioUrl(null);
      return;
    }

    const songId = song.id;
    const uploadMeta = getUploadMetaById(songId);
    if (!uploadMeta?.hasAudio) {
      setPreviewAudioUrl(null);
      return;
    }

    let cancelled = false;

    void loadKaraokeUploadMedia(songId).then((media) => {
      if (cancelled || !media) return;
      setPreviewAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(media.blob);
      });
    });

    return () => {
      cancelled = true;
      setPreviewAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
    };
  }, [isOpen, song?.id, isPerforming]);

  useEffect(() => {
    if (!isOpen || isPerforming || !isPreviewPlaying || !resolvedSong) return;
    if (previewAudioUrl && previewAudioRef.current) {
      const audio = previewAudioRef.current;
      void audio.play().catch(() => setIsPreviewPlaying(false));
      return () => {
        audio.pause();
      };
    }

    previewStartedAtRef.current = performance.now();
    previewStartOffsetRef.current = previewElapsedSec;

    const tick = () => {
      const nextElapsed = previewStartOffsetRef.current + (performance.now() - previewStartedAtRef.current) / 1000;
      if (nextElapsed >= resolvedSong.durationSec) {
        setPreviewElapsedSec(resolvedSong.durationSec);
        setIsPreviewPlaying(false);
        return;
      }
      setPreviewElapsedSec(nextElapsed);
      previewRafRef.current = requestAnimationFrame(tick);
    };

    previewRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
    };
  }, [isOpen, isPerforming, isPreviewPlaying, previewElapsedSec, resolvedSong, previewAudioUrl]);

  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio || !previewAudioUrl || isPerforming) return;

    const onTimeUpdate = () => setPreviewElapsedSec(audio.currentTime);
    const onEnded = () => {
      setPreviewElapsedSec(audio.duration || resolvedSong?.durationSec || 0);
      setIsPreviewPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [previewAudioUrl, isPerforming, resolvedSong?.durationSec]);

  if (!isOpen || !song || !resolvedSong) return null;

  const activeSong = resolvedSong;
  const activeEffect = getVoiceChangerEffect(voiceEffect);
  const previewAudio = previewAudioUrl ? (
    <audio ref={previewAudioRef} src={previewAudioUrl} preload="metadata" className="hidden" />
  ) : null;

  const toolbar = (
    <div className="flex justify-center items-center space-x-3 w-full mt-2 shrink-0">
      <button
        type="button"
        onClick={() => setIsVoiceChangerOpen((open) => !open)}
        className={`p-2 rounded-full border transition-all active:scale-95 ${
          isVoiceChangerOpen
            ? 'border-pink-400/60 bg-pink-500/20 text-pink-200'
            : 'border-white/20 text-gray-300 hover:bg-white/10'
        }`}
        aria-label="Voice changer"
        title="Voice changer"
      >
        <AudioLines size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (isPerforming) return;
          setIsPreviewPlaying(false);
          setPreviewElapsedSec(0);
          if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current.currentTime = 0;
          }
        }}
        disabled={isPerforming}
        className="p-2 rounded-full border border-white/20 text-gray-300 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-default"
        aria-label="Restart preview"
        title="Restart preview"
      >
        <RotateCcw size={14} />
      </button>
      <button
        type="button"
        onClick={onSing}
        disabled={isPerforming}
        className="bg-[#ff3b70] hover:bg-[#ff3b70]/90 disabled:opacity-60 disabled:cursor-default text-white font-bold px-8 py-2 rounded-full uppercase tracking-widest text-[10px] shadow-[0_0_10px_rgba(255,59,112,0.3)] active:scale-95 transition-all"
      >
        {isPerforming ? 'SINGING' : 'SING'}
      </button>
      <button
        type="button"
        onClick={() => {
          setIsFullScreen((expanded) => !expanded);
          setIsVoiceChangerOpen(false);
        }}
        className="p-2 rounded-full border border-white/20 text-gray-300 hover:bg-white/10 active:scale-95 transition-all"
        aria-label={isFullScreen ? 'Exit full screen' : 'Full screen'}
      >
        {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );

  const voiceChangerPanel = (
    <div className="w-full pt-3 border-t border-white/10 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[9px] font-black text-pink-300 uppercase tracking-wider">Voice Changer</span>
        <span className="text-[9px] text-gray-400">{activeEffect.emoji} {activeEffect.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {VOICE_CHANGER_EFFECTS.map((effect) => (
          <button
            key={effect.id}
            type="button"
            onClick={() => onVoiceEffectChange?.(effect.id)}
            className={`rounded-xl px-1.5 py-2 text-[8px] font-bold transition active:scale-95 ${
              voiceEffect === effect.id
                ? 'bg-pink-500/25 border border-pink-400/50 text-pink-100'
                : 'bg-black/30 border border-white/10 text-gray-300 hover:bg-white/5'
            }`}
          >
            <span className="block text-sm mb-0.5">{effect.emoji}</span>
            {effect.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[110] flex flex-col pointer-events-auto overflow-hidden">
        {previewAudio}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-zinc-900">
            <Disc className={`w-36 h-36 text-white/5 ${isPerforming ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none opacity-80" />
        </div>

        {isPerforming && (
          <SingingMicRail
            progressPercent={progressPercent}
            micLevel={micLevel}
            voiceStatus={voiceStatus}
          />
        )}

        <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5 z-20">
          <div
            className="h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] transition-[width] duration-300 ease-linear"
            style={{ width: `${displayProgressPercent}%` }}
          />
        </div>

        <div className="relative flex items-center justify-between px-4 pt-4 pb-2 shrink-0 z-20">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white"
            aria-label="Cancel song"
          >
            <X size={16} />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-black/30">
            <Mic2 size={12} className="text-pink-400" />
            <span className="text-[10px] font-black text-gray-200 font-mono">
              {formatTrackTime(displayElapsedSec)} / {formatTrackTime(activeSong.durationSec)}
            </span>
          </div>
          <div className="w-8 shrink-0" aria-hidden />
        </div>

        <div className="relative px-5 pb-2 text-center shrink-0 z-20 min-h-[52px]">
          <h2 className="text-lg font-black text-white truncate">{activeSong.title}</h2>
          <p className="text-xs text-gray-400 truncate">{activeSong.artist}</p>
          <p
            className={`text-[10px] font-bold text-pink-400 mt-1 uppercase tracking-wider min-h-[14px] ${
              isPerforming ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={!isPerforming}
          >
            {formatSingingStatusLine(voiceEffect, voiceStatus)}
          </p>
        </div>

        <div
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto px-6 py-4 flex flex-col items-center justify-start space-y-3 text-center scrollbar-hide min-h-0 z-10"
        >
          <LyricsLines large lines={activeSong.lyrics} activeIndex={activeLyricIndex} lineRefs={lineRefs} />
        </div>

        <div className="relative px-4 pb-6 pt-2 shrink-0 border-t border-white/5 bg-black/30 z-20">
          <div className={`w-full overflow-hidden transition-[max-height] duration-200 ${isVoiceChangerOpen ? 'max-h-48' : 'max-h-0'}`}>
            {voiceChangerPanel}
          </div>
          {toolbar}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={compactCardRef}
      className="fixed z-[110] w-[280px] max-w-[90vw]"
      style={
        cardPosition
          ? { left: cardPosition.x, top: cardPosition.y }
          : { top: '5rem', right: '0.5rem' }
      }
    >
      {previewAudio}
      <div className="relative w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-4 shadow-2xl text-center flex flex-col items-center pointer-events-auto min-h-[305px]">
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex w-full justify-center px-10 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={handleCardDragStart}
          onPointerMove={handleCardDragMove}
          onPointerUp={handleCardDragEnd}
          onPointerCancel={handleCardDragEnd}
          aria-label="Drag lyrics card"
          title="Drag to move"
        >
          <div className="h-1.5 w-12 rounded-full bg-white/25" />
        </div>
        <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5 rounded-t-3xl overflow-hidden">
          <div
            className="h-full bg-pink-500 transition-[width] duration-300 ease-linear"
            style={{ width: `${displayProgressPercent}%` }}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-300 hover:text-white"
          aria-label="Cancel song"
        >
          <X size={16} />
        </button>

        <h2 className="text-sm font-bold text-pink-300 truncate w-full px-2">{activeSong.title}</h2>
        <p className="text-[10px] text-gray-400 truncate w-full px-2">{activeSong.artist}</p>
        <p
          className={`text-[8px] font-bold text-pink-400/90 mt-1 mb-1 uppercase tracking-wide min-h-[12px] ${
            isPerforming ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={!isPerforming}
        >
          {formatSingingStatusLine(voiceEffect, voiceStatus)}
        </p>

        <div
          ref={scrollRef}
          className="overflow-y-auto mb-2 text-gray-300 font-medium space-y-1 text-center px-1 h-[160px] scrollbar-hide w-full"
        >
          <LyricsLines lines={activeSong.lyrics} activeIndex={activeLyricIndex} lineRefs={lineRefs} />
        </div>

        <div className="w-full h-1.5 bg-white/10 rounded-full mb-2 overflow-hidden shrink-0">
          <div
            className={`h-full bg-gradient-to-r from-amber-400 via-green-400 to-pink-500 transition-[width] duration-150 ${
              isPerforming ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ width: `${isPerforming ? micLevel : 0}%` }}
          />
        </div>

        <div className={`w-full shrink-0 overflow-hidden transition-[max-height] duration-200 ${isVoiceChangerOpen ? 'max-h-40' : 'max-h-0'}`}>
          {voiceChangerPanel}
        </div>
        {toolbar}
      </div>
    </div>
  );
}
