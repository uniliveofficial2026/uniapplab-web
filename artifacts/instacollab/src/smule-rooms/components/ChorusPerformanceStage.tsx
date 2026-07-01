import React, { useRef } from 'react';
import { Activity, AudioLines, Disc, Plus } from 'lucide-react';
import type { ActiveSong } from '../utils/songPerformance';
import { getActiveLyricIndex } from '../utils/songPerformance';
import { useLyricAutoScroll } from '../hooks/useLyricAutoScroll';
import {
  VOICE_CHANGER_EFFECTS,
  getVoiceChangerEffect,
  type VoiceChangerEffectId,
} from '../utils/voiceEffects';
import type { SingingVoiceStatus } from '../hooks/useSingingSession';
import { formatSingingStatusLine } from '../utils/singingVoiceStatus';

type ChorusPerformanceStageProps = {
  song: ActiveSong;
  singerLabel: string;
  elapsedSec: number;
  elapsedLabel: string;
  totalLabel: string;
  progressPercent: number;
  chorusScore: number;
  audioPulse: number;
  micLevel?: number;
  voiceStatus?: SingingVoiceStatus;
  isSelfPerforming: boolean;
  voiceEffect?: VoiceChangerEffectId;
  onVoiceEffectChange?: (effect: VoiceChangerEffectId) => void;
  onOpenQueue: () => void;
  onCancel: () => void;
};

export function ChorusPerformanceStage({
  song,
  singerLabel,
  elapsedSec,
  elapsedLabel,
  totalLabel,
  progressPercent,
  chorusScore,
  audioPulse,
  micLevel = 0,
  voiceStatus = 'silent',
  isSelfPerforming,
  voiceEffect = 'studio',
  onVoiceEffectChange,
  onOpenQueue,
  onCancel,
}: ChorusPerformanceStageProps) {
  const [voiceChangerOpen, setVoiceChangerOpen] = React.useState(false);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lyrics = song.lyrics ?? [];

  const activeLyricIndex = getActiveLyricIndex(
    elapsedSec,
    song.durationSec,
    lyrics.length,
    song.lyricStartTimes,
  );
  const activeEffect = getVoiceChangerEffect(voiceEffect);
  const levelSource = isSelfPerforming ? micLevel : audioPulse;
  const eqHeights = [
    Math.min(100, 35 + levelSource * 0.65),
    Math.min(100, 25 + (levelSource % 50)),
    Math.min(100, 45 + (levelSource % 25)),
  ];

  useLyricAutoScroll(activeLyricIndex, scrollContainerRef, lineRefs);

  return (
    <div className="mx-3 sm:mx-4 mt-2 shrink-0 chorus-performance-stage bg-gradient-to-b from-purple-900/40 to-black/40 backdrop-blur-xl rounded-[28px] border border-white/10 flex flex-col overflow-hidden shadow-2xl relative">
      {isSelfPerforming && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/50 via-black/30 to-zinc-900/40" />
          <Disc
            className="absolute -right-8 top-1/2 -translate-y-1/2 w-28 h-28 text-white/[0.04] animate-spin"
            style={{ animationDuration: '10s' }}
          />
        </div>
      )}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-1 pointer-events-none">
        <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-teal-400 font-black text-xl">
          C
        </div>
        <span className="text-[#ffd147] text-xs font-black tabular-nums">{chorusScore}</span>
      </div>

      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-white/5">
        <div
          className="h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] transition-[width] duration-300 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-5 pt-3.5 pb-2 border-b border-white/5 pr-14">
        <div className="flex items-center space-x-2 min-w-0">
          <Activity size={10} className="text-pink-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[8px] font-bold text-pink-400 uppercase truncate">{singerLabel}</p>
            <h3 className="text-white text-[11px] font-black truncate">{song.title}</h3>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full border border-white/10 bg-black/20 shrink-0">
          <div className="flex items-end space-x-[1px] h-2">
            {eqHeights.map((height, index) => (
              <div
                key={index}
                className="w-[1.5px] bg-pink-500 transition-all duration-150"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <span className="text-[10px] font-black text-gray-300 font-mono tracking-tighter tabular-nums">
            {elapsedLabel}/{totalLabel}
          </span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 py-4 flex flex-col items-center justify-start space-y-3 text-center scrollbar-hide min-h-0 pr-12"
      >
        <h2 className="text-[17px] font-black text-[#ffd147] leading-tight drop-shadow-lg shrink-0">{song.title}</h2>
        <div className="space-y-1.5 w-full min-h-0">
          <div className="flex flex-col space-y-1">
            {song.composer && (
              <span className="text-[11px] text-gray-100 font-bold">တေးရေး - {song.composer}</span>
            )}
            <span className="text-[11px] text-gray-100 font-bold">
              တေးဆို - {song.lyricist ?? song.artist}
            </span>
          </div>
          {lyrics.map((line, index) => (
            <p
              key={`${song.id}-${index}`}
              ref={(node) => {
                lineRefs.current[index] = node;
              }}
              className={`text-[12px] font-black leading-relaxed transition-all duration-300 ${
                index === activeLyricIndex
                  ? 'text-[#ffd147] scale-[1.03] drop-shadow-[0_0_10px_rgba(255,209,71,0.45)]'
                  : index < activeLyricIndex
                    ? 'text-white/45'
                    : 'text-white/80'
              }`}
            >
              {line}
            </p>
          ))}
        </div>
        {isSelfPerforming && (
          <p className="text-[9px] font-bold text-pink-300/90 uppercase tracking-wider">
            {formatSingingStatusLine(voiceEffect, voiceStatus)}
          </p>
        )}
      </div>

      <div className="relative px-5 py-3.5 flex items-center justify-between border-t border-white/5 bg-black/40">
        <button
          type="button"
          onClick={onOpenQueue}
          className="bg-[#d946ef] hover:bg-[#c026d3] text-white text-[11px] font-bold px-5 py-1.5 rounded-full flex items-center space-x-2 transition shadow-lg shadow-purple-900/50"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <span>Queue</span>
        </button>
        <div className="flex items-center space-x-3">
          {isSelfPerforming && (
            <div className="relative">
              {voiceChangerOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-[min(240px,70vw)] rounded-2xl border border-pink-500/30 bg-[#1a0f2e]/95 backdrop-blur-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.55)] z-20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-pink-300 uppercase tracking-wider">
                      Voice Changer
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {activeEffect.emoji} {activeEffect.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {VOICE_CHANGER_EFFECTS.map((effect) => (
                      <button
                        key={effect.id}
                        type="button"
                        onClick={() => {
                          onVoiceEffectChange?.(effect.id);
                          setVoiceChangerOpen(false);
                        }}
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
              )}
              <button
                type="button"
                onClick={() => setVoiceChangerOpen((open) => !open)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 border transition active:scale-95 ${
                  voiceChangerOpen || voiceEffect !== 'studio'
                    ? 'border-pink-400/50 bg-pink-500/15 text-pink-200'
                    : 'border-white/15 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                aria-label="Voice changer"
                title="Voice changer"
              >
                <AudioLines size={16} className="shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-wide">
                  {voiceEffect !== 'studio' ? activeEffect.emoji : 'FX'}
                </span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-white cursor-pointer transition active:scale-95"
            aria-label="Stop performance"
          >
            <Plus className="rotate-45" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
