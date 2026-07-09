import React from 'react';
import { X } from 'lucide-react';
import {
  VOICE_CHANGER_EFFECTS,
  getVoiceChangerEffect,
  type VoiceChangerEffectId,
} from '../utils/voiceEffects';

type VoiceChangerSheetProps = {
  open: boolean;
  effectId: VoiceChangerEffectId;
  onEffectChange: (effectId: VoiceChangerEffectId) => void;
  onClose: () => void;
  monitorEnabled?: boolean;
  onMonitorEnabledChange?: (enabled: boolean) => void;
};

/**
 * Live room voice changer — effects are applied via Web Audio before LiveKit publish.
 */
export function VoiceChangerSheet({
  open,
  effectId,
  onEffectChange,
  onClose,
  monitorEnabled = false,
  onMonitorEnabledChange,
}: VoiceChangerSheetProps) {
  if (!open) return null;

  const active = getVoiceChangerEffect(effectId);

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close voice changer"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gray-950/95 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-white">Voice changer</p>
            <p className="text-[11px] text-white/50">Remote listeners hear {active.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {onMonitorEnabledChange ? (
          <div className="border-t border-white/10 px-4 py-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="min-w-0 text-left">
                <p className="text-xs font-bold text-white">Hear yourself</p>
                <p className="text-[10px] text-white/45">Optional sidetone with your voice effect</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={monitorEnabled}
                onClick={() => onMonitorEnabledChange(!monitorEnabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
                  monitorEnabled
                    ? 'border-purple-400/60 bg-purple-500/35'
                    : 'border-white/15 bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    monitorEnabled ? 'left-[1.35rem]' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
            {monitorEnabled ? (
              <p className="mt-2 text-[10px] text-amber-200/75">Headphones recommended to reduce echo.</p>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2 p-4">
          {VOICE_CHANGER_EFFECTS.map((effect) => {
            const selected = effect.id === effectId;
            return (
              <button
                key={effect.id}
                type="button"
                onClick={() => onEffectChange(effect.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition active:scale-95 ${
                  selected
                    ? 'border-purple-400/60 bg-purple-500/20 text-purple-100'
                    : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {effect.emoji}
                </span>
                <span className="text-[10px] font-semibold leading-tight">{effect.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
