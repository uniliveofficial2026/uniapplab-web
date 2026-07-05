import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  AR_EFFECT_CATEGORIES,
  getAREffectPreviewUrl,
  getEffectCategoryId,
  getEffectPresetsForCategory,
  searchEffectPresets,
  type AREffectCategoryId,
  type AREffectPreset,
} from '../../lib/ar/arConfig';

const CATEGORY_TABS = AR_EFFECT_CATEGORIES.filter(
  (category) => category.id === 'clear' || getEffectPresetsForCategory(category.id).length > 0,
);

function EffectDemoThumb({ effectId, label }: { effectId: string; label: string }) {
  return (
    <img
      src={getAREffectPreviewUrl(effectId)}
      alt={label}
      className="absolute inset-0 h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

function EffectButton({
  preset,
  isSelected,
  disabled,
  onSelect,
  itemRef,
}: {
  preset: AREffectPreset;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (effectId: string) => void;
  itemRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={itemRef}
      type="button"
      disabled={disabled}
      onClick={() => onSelect(preset.id)}
      aria-pressed={isSelected}
      aria-label={preset.label}
      className="group shrink-0 snap-center flex flex-col items-center gap-1.5 disabled:opacity-50"
    >
      <span
        className={`relative block h-[4.25rem] w-[4.25rem] overflow-hidden rounded-full border-[3px] shadow-lg transition-transform duration-200 ${
          isSelected
            ? 'border-white scale-110 shadow-white/20'
            : 'border-white/35 group-hover:border-white/60 group-hover:scale-105'
        }`}
      >
        <EffectDemoThumb effectId={preset.id} label={preset.label} />
      </span>
      <span
        className={`max-w-[4.5rem] truncate text-center text-[9px] font-bold uppercase tracking-wide ${
          isSelected ? 'text-white' : 'text-white/70'
        }`}
      >
        {preset.label}
      </span>
    </button>
  );
}

function CategoryTabs({
  activeCategoryId,
  disabled,
  onSelect,
}: {
  activeCategoryId: AREffectCategoryId;
  disabled: boolean;
  onSelect: (categoryId: AREffectCategoryId) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide snap-x snap-mandatory touch-pan-x"
      role="tablist"
      aria-label="Effect categories"
    >
      {CATEGORY_TABS.map((category) => {
        const isActive = activeCategoryId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onSelect(category.id)}
            className={`shrink-0 snap-start rounded-full border px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide transition disabled:opacity-50 ${
              isActive
                ? 'border-white bg-white text-black shadow-lg'
                : 'border-white/25 bg-black/40 text-white/80 backdrop-blur-md hover:border-white/50 hover:bg-black/55'
            }`}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}

export type ARFilterCarouselProps = {
  activeEffectId: string;
  onSelect: (effectId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function ARFilterCarousel({
  activeEffectId,
  onSelect,
  disabled = false,
  className = '',
}: ARFilterCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<AREffectCategoryId>(() =>
    getEffectCategoryId(activeEffectId),
  );

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  const visiblePresets = useMemo(() => {
    if (isSearching) return searchEffectPresets(searchQuery);
    return getEffectPresetsForCategory(activeCategoryId);
  }, [activeCategoryId, isSearching, searchQuery]);

  useEffect(() => {
    setActiveCategoryId(getEffectCategoryId(activeEffectId));
  }, [activeEffectId]);

  useEffect(() => {
    const el = itemRefs.current[activeEffectId];
    if (!el || isSearching) return;
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeEffectId, activeCategoryId, isSearching, visiblePresets]);

  const handleCategorySelect = (categoryId: AREffectCategoryId) => {
    setActiveCategoryId(categoryId);
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="relative px-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45"
          aria-hidden
        />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          disabled={disabled}
          placeholder="Search effects…"
          aria-label="Search AR effects"
          className="h-9 w-full rounded-full border border-white/20 bg-black/45 pl-9 pr-9 text-xs text-white placeholder:text-white/40 backdrop-blur-md outline-none transition focus:border-white/45 disabled:opacity-50"
        />
        {trimmedQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
            }}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {!isSearching ? (
        <CategoryTabs
          activeCategoryId={activeCategoryId}
          disabled={disabled}
          onSelect={handleCategorySelect}
        />
      ) : (
        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Search results
        </p>
      )}

      {visiblePresets.length > 0 ? (
        <div
          ref={scrollRef}
          role="tabpanel"
          className="flex items-end gap-3 overflow-x-auto py-1 px-2 scrollbar-hide snap-x snap-mandatory touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        >
          {visiblePresets.map((preset) => (
            <EffectButton
              key={preset.id}
              preset={preset}
              isSelected={activeEffectId === preset.id}
              disabled={disabled}
              onSelect={onSelect}
              itemRef={(el) => {
                itemRefs.current[preset.id] = el;
              }}
            />
          ))}
        </div>
      ) : (
        <p className="px-2 py-3 text-center text-[11px] text-white/55">
          No effects match &ldquo;{trimmedQuery}&rdquo;
        </p>
      )}
    </div>
  );
}
