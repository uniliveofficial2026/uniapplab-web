import React, { useMemo, useState } from 'react';
import { Ban, X } from 'lucide-react';
import {
  formatSeatBanDurationLabel,
  parseCustomSeatBanDurationMs,
  SEAT_BAN_DURATION_PRESETS,
} from '../utils/roomSeatBans';

type SeatBanDurationPickerProps = {
  userName: string;
  onClose: () => void;
  onConfirm: (durationMs: number) => void;
};

export function SeatBanDurationPicker({ userName, onClose, onConfirm }: SeatBanDurationPickerProps) {
  const [preset, setPreset] = useState<(typeof SEAT_BAN_DURATION_PRESETS)[number]['id'] | 'custom'>('15m');
  const [customAmount, setCustomAmount] = useState('45');
  const [customUnit, setCustomUnit] = useState<'m' | 'h' | 'd'>('m');

  const selectedMs = useMemo(() => {
    if (preset !== 'custom') {
      return SEAT_BAN_DURATION_PRESETS.find((entry) => entry.id === preset)?.ms ?? null;
    }
    return parseCustomSeatBanDurationMs(customAmount, customUnit);
  }, [preset, customAmount, customUnit]);

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center pointer-events-auto">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Close ban duration picker"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-t-3xl border-t border-orange-500/30 bg-[#1a0f2e] p-5 shadow-[0_-12px_40px_rgba(249,115,22,0.18)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-orange-300">
              <Ban size={16} />
              <h3 className="text-sm font-black uppercase tracking-widest">Ban from Seats</h3>
            </div>
            <p className="mt-1 text-xs text-gray-300">
              Choose how long <span className="font-bold text-white">{userName}</span> cannot take a seat.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {SEAT_BAN_DURATION_PRESETS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPreset(entry.id)}
              className={`rounded-xl border py-3 text-sm font-black transition active:scale-95 ${
                preset === entry.id
                  ? 'border-orange-400/50 bg-orange-500/20 text-orange-200'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPreset('custom')}
          className={`mt-2 w-full rounded-xl border py-3 text-sm font-black transition active:scale-95 ${
            preset === 'custom'
              ? 'border-orange-400/50 bg-orange-500/20 text-orange-200'
              : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          Custom amount
        </button>

        {preset === 'custom' ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-3">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none focus:border-orange-400/40"
              placeholder="Amount"
            />
            <div className="flex shrink-0 gap-1">
              {(['m', 'h', 'd'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setCustomUnit(unit)}
                  className={`rounded-lg px-2.5 py-2 text-[11px] font-black uppercase transition ${
                    customUnit === unit
                      ? 'bg-orange-500/25 text-orange-200'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-[11px] text-gray-500">
          {selectedMs
            ? `Ban lasts ${formatSeatBanDurationLabel(selectedMs)}. They will see a live countdown and auto-unban when it ends.`
            : 'Enter a valid custom duration (max 30 days).'}
        </p>

        <button
          type="button"
          disabled={!selectedMs}
          onClick={() => {
            if (!selectedMs) return;
            onConfirm(selectedMs);
          }}
          className="mt-4 w-full rounded-full bg-gradient-to-r from-orange-600 to-amber-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition enabled:hover:opacity-95 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm Ban
        </button>
      </div>
    </div>
  );
}
