import React, { useEffect, useMemo, useState } from 'react';
import {
  DEEPAR_EFFECT_CATEGORIES,
  getEffectCategoryId,
  getEffectPresetsForCategory,
  type DeepAREffectCategoryId,
} from '../../lib/deepar/deeparConfig';

export type DeepAREffectPickerProps = {
  activeEffectId: string;
  onSelect: (effectId: string) => void;
  disabled?: boolean;
  className?: string;
  /** Transparent pills for camera overlay UI */
  variant?: 'default' | 'overlay';
};

const CATEGORY_TABS = DEEPAR_EFFECT_CATEGORIES.filter((category) =>
  category.id === 'clear' || getEffectPresetsForCategory(category.id).length > 0,
);

export function DeepAREffectPicker({
  activeEffectId,
  onSelect,
  disabled = false,
  className = '',
  variant = 'default',
}: DeepAREffectPickerProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<DeepAREffectCategoryId>(() =>
    getEffectCategoryId(activeEffectId),
  );

  const presets = useMemo(
    () => getEffectPresetsForCategory(activeCategoryId),
    [activeCategoryId],
  );

  useEffect(() => {
    setActiveCategoryId(getEffectCategoryId(activeEffectId));
  }, [activeEffectId]);

  const tabClass = (isActive: boolean) =>
    variant === 'overlay'
      ? isActive
        ? 'bg-white text-black border-white'
        : 'bg-transparent text-white border-white/40 hover:border-white/70'
      : isActive
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-secondary/50 text-foreground border-border hover:border-primary/40';

  const effectClass = (isActive: boolean) =>
    variant === 'overlay'
      ? isActive
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-transparent text-white border-white/40 hover:border-white/70'
      : isActive
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-secondary/50 text-foreground border-border hover:border-primary/40';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_TABS.map((category) => {
          const isActive = activeCategoryId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              disabled={disabled}
              onClick={() => setActiveCategoryId(category.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition disabled:opacity-50 ${tabClass(isActive)}`}
            >
              {category.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(preset.id)}
            className={`shrink-0 px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wide transition border disabled:opacity-50 ${effectClass(activeEffectId === preset.id)}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
