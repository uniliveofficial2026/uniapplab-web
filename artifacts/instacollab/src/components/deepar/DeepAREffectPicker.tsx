import React from 'react';
import { DEEPAR_EFFECT_PRESETS } from '../../lib/deepar/deeparConfig';

export type DeepAREffectPickerProps = {
  activeEffectId: string;
  onSelect: (effectId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function DeepAREffectPicker({
  activeEffectId,
  onSelect,
  disabled = false,
  className = '',
}: DeepAREffectPickerProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${className}`}>
      {DEEPAR_EFFECT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(preset.id)}
          className={`shrink-0 px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wide transition border ${
            activeEffectId === preset.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary/50 text-foreground border-border hover:border-primary/40'
          } disabled:opacity-50`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
