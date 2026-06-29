import React from 'react';

export function SeatSpeakingLevelBars({
  active,
  audioPulse,
}: {
  active: boolean;
  audioPulse: number;
}) {
  if (!active) return null;
  const heights = [
    9 + (audioPulse % 8),
    13 + (audioPulse % 6),
    10 + (audioPulse % 7),
  ];

  return (
    <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 flex items-end justify-center gap-[3px] pointer-events-none z-30">
      {heights.map((height, index) => (
        <span
          key={index}
          className="w-[3px] rounded-full bg-cyan-200 animate-bounce shadow-[0_0_7px_rgba(165,243,252,0.9)]"
          style={{ height: `${height}px`, animationDelay: `${index * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function SeatVoiceGlowEffect({
  active,
  audioPulse = 0,
  variant = 'cyan',
}: {
  active: boolean;
  audioPulse?: number;
  variant?: 'cyan' | 'pink';
}) {
  if (!active) return null;

  const glow = 12 + (audioPulse % 6);
  const borderClass =
    variant === 'pink'
      ? 'border-pink-200 party-voice-water-core'
      : 'border-cyan-200 party-voice-water-core';
  const rippleClass =
    variant === 'pink' ? 'border-pink-300/70 party-voice-water-ripple' : 'border-cyan-300/70 party-voice-water-ripple';
  const shadow =
    variant === 'pink'
      ? `0 0 ${glow}px rgba(236,72,153,0.78)`
      : `0 0 ${glow}px rgba(34,211,238,0.78)`;

  return (
    <span className="absolute inset-0 z-[25] pointer-events-none" aria-hidden>
      <span className="absolute -inset-[3px] rounded-full border border-black/55" />
      <span
        className={`absolute -inset-[2px] rounded-full border-2 ${borderClass}`}
        style={{ boxShadow: shadow }}
      />
      {[0, 0.75, 1.5].map((delay) => (
        <span
          key={delay}
          className={`absolute -inset-[5px] rounded-full border ${rippleClass}`}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}
