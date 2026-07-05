import React from 'react';
import { handleAvatarError } from '../../lib/utils';
import {
  AVATAR_QUICK_PRESET_SEEDS,
  avatarPresetUrl,
} from '../../lib/avatarPresets';

type AvatarQuickPresetsProps = {
  selectedUrl?: string | null;
  onSelect: (url: string) => void;
  className?: string;
};

/** Horizontal avatar preset chips — shared by main profile settings and karaoke edit profile. */
export function AvatarQuickPresets({
  selectedUrl,
  onSelect,
  className = '',
}: AvatarQuickPresetsProps) {
  return (
    <div className={className || 'mt-3'}>
      <span className="text-[10px] uppercase font-bold text-muted-foreground/70 block mb-1.5">
        Quick Presets
      </span>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {AVATAR_QUICK_PRESET_SEEDS.map((seed) => {
          const url = avatarPresetUrl(seed);
          const isSelected = selectedUrl === url;
          return (
            <button
              key={seed}
              type="button"
              onClick={() => onSelect(url)}
              className={`w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 bg-secondary hover:scale-105 transition-transform ${
                isSelected
                  ? 'border-primary shadow-md shadow-primary/25'
                  : 'border-transparent'
              }`}
              aria-label={`Use ${seed} avatar preset`}
              aria-pressed={isSelected}
              title={seed}
            >
              <img
                src={url}
                className="w-full h-full object-cover"
                alt=""
                onError={handleAvatarError}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
