import React, { useEffect, useState } from 'react';
import { Ban, Clock3 } from 'lucide-react';
import { formatSeatBanRemaining, type SeatBanEntry } from '../utils/roomSeatBans';

type SeatBanCountdownBannerProps = {
  ban: SeatBanEntry;
  onExpired: () => void;
};

export function SeatBanCountdownBanner({ ban, onExpired }: SeatBanCountdownBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [ban.userId, ban.expiresAt]);

  const remainingMs = ban.expiresAt - now;

  useEffect(() => {
    if (remainingMs > 0) return;
    onExpired();
  }, [remainingMs, onExpired]);

  if (remainingMs <= 0) return null;

  const progress = Math.max(0, Math.min(1, remainingMs / Math.max(1, ban.durationMs)));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[130] flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-orange-400/35 bg-[#1a0f2e]/95 shadow-[0_10px_35px_rgba(249,115,22,0.28)] backdrop-blur-md">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-300">
            <Ban size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-orange-300">
              Seat ban active
            </p>
            <p className="mt-0.5 text-xs font-semibold text-white">
              You cannot take a seat in this room until the timer ends.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-black tabular-nums text-orange-100">
              <Clock3 size={14} className="text-orange-300" />
              <span>{formatSeatBanRemaining(remainingMs)}</span>
            </div>
          </div>
        </div>
        <div className="h-1 w-full bg-orange-950/60">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width] duration-200 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
