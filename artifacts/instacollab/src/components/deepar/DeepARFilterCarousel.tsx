import React, { memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  DEEPAR_EFFECT_CATEGORIES,
  getDeepAREffectPreviewCandidates,
  getEffectCategoryId,
  getEffectPresetsForCategory,
  searchEffectPresets,
  type DeepAREffectCategoryId,
  type DeepAREffectPreset,
} from '../../lib/deepar/deeparConfig';
import {
  EMPTY_DEEPAR_EFFECT_SELECTION,
  patchDeepARSelection,
  selectedIdForCategory,
  type DeepAREffectSelection,
} from '../../lib/deepar/deeparEffectSelection';

const CATEGORY_TABS = DEEPAR_EFFECT_CATEGORIES.filter((category) =>
  category.id === 'clear' || getEffectPresetsForCategory(category.id).length > 0,
);

/** Live AR carousel: free-pack effects + Beauty plugin makeup / body-shaping looks. */
const DEEPAR_ONLY_CATEGORY_IDS = new Set<DeepAREffectCategoryId>([
  'clear',
  'makeup',
  'beauty',
  'mask',
  'glasses',
  'background',
  'animation',
]);

function isDeepAROnlyPreset(preset: DeepAREffectPreset): boolean {
  return DEEPAR_ONLY_CATEGORY_IDS.has(preset.category);
}

const EffectDemoThumb = memo(function EffectDemoThumb({
  effectId,
  label,
}: {
  effectId: string;
  label: string;
}) {
  const candidates = useMemo(
    () => getDeepAREffectPreviewCandidates(effectId),
    [effectId],
  );
  const [index, setIndex] = useState(0);
  const src = candidates[Math.min(index, candidates.length - 1)] ?? candidates[0];

  return (
    <img
      key={src}
      src={src}
      alt={label}
      className="absolute inset-0 h-full w-full object-cover bg-gradient-to-br from-fuchsia-500/40 to-purple-900/60"
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
      }}
    />
  );
});

const EffectButton = memo(function EffectButton({
  preset,
  isSelected,
  disabled,
  onSelect,
  itemRef,
}: {
  preset: DeepAREffectPreset;
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
      onClick={() => {
        // Keep the live camera UI responsive while the effect loads.
        startTransition(() => onSelect(preset.id));
      }}
      aria-pressed={isSelected}
      aria-label={preset.label}
      className="group shrink-0 snap-center flex flex-col items-center gap-1.5 disabled:opacity-50"
    >
      <span
        className={`relative block h-[4.25rem] w-[4.25rem] overflow-hidden rounded-full border-[3px] shadow-lg transition-transform duration-200 ${
          isSelected
            ? 'border-white scale-110 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_14px_rgba(255,255,255,0.28)]'
            : 'border-white/55 bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] group-hover:border-white/75 group-hover:bg-white/30 group-hover:scale-105'
        } backdrop-blur-md`}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/45 via-white/15 to-white/5"
          aria-hidden
        />
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
});

function CategoryTabs({
  activeCategoryId,
  disabled,
  onSelect,
  categories,
}: {
  activeCategoryId: DeepAREffectCategoryId;
  disabled: boolean;
  onSelect: (categoryId: DeepAREffectCategoryId) => void;
  categories: typeof CATEGORY_TABS;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide snap-x snap-mandatory touch-pan-x"
      role="tablist"
      aria-label="Effect categories"
    >
      {categories.map((category) => {
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

export type DeepARFilterCarouselProps = {
  activeEffectId?: string;
  onSelect?: (effectId: string) => void;
  activeSelection?: DeepAREffectSelection;
  onSelectionChange?: (selection: DeepAREffectSelection) => void;
  multiSelect?: boolean;
  disabled?: boolean;
  className?: string;
  /** Hide CSS-only beauty presets (multi-guest live AR button). */
  deepAROnly?: boolean;
};

export function DeepARFilterCarousel({
  activeEffectId = 'none',
  onSelect = () => undefined,
  activeSelection = EMPTY_DEEPAR_EFFECT_SELECTION,
  onSelectionChange,
  multiSelect = false,
  disabled = false,
  className = '',
  deepAROnly = false,
}: DeepARFilterCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<DeepAREffectCategoryId>(() =>
    getEffectCategoryId(activeEffectId),
  );

  const categoryTabs = useMemo(
    () =>
      deepAROnly
        ? CATEGORY_TABS.filter((category) => DEEPAR_ONLY_CATEGORY_IDS.has(category.id))
        : CATEGORY_TABS,
    [deepAROnly],
  );

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  const visiblePresets = useMemo(() => {
    const presets = isSearching
      ? searchEffectPresets(searchQuery)
      : getEffectPresetsForCategory(activeCategoryId);
    return deepAROnly ? presets.filter(isDeepAROnlyPreset) : presets;
  }, [activeCategoryId, deepAROnly, isSearching, searchQuery]);

  useEffect(() => {
    setActiveCategoryId(getEffectCategoryId(activeEffectId));
  }, [activeEffectId]);

  useEffect(() => {
    const el = itemRefs.current[activeEffectId];
    if (!el || isSearching) return;
    // Instant scroll — smooth scroll janks the live camera thread.
    el.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }, [activeEffectId, activeCategoryId, isSearching]);

  const handleCategorySelect = (categoryId: DeepAREffectCategoryId) => {
    setActiveCategoryId(categoryId);
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const handlePresetSelect = (effectId: string) => {
    if (multiSelect && onSelectionChange) {
      const categoryId = getEffectCategoryId(effectId);
      const current = selectedIdForCategory(activeSelection, categoryId);
      const nextId = current === effectId || effectId === 'none' ? null : effectId;
      onSelectionChange(patchDeepARSelection(activeSelection, categoryId, nextId));
      return;
    }
    onSelect(effectId);
  };

  const isPresetSelected = (preset: DeepAREffectPreset) => {
    if (multiSelect) {
      if (preset.id === 'none') {
        return !selectedIdForCategory(activeSelection, activeCategoryId);
      }
      return selectedIdForCategory(activeSelection, preset.category) === preset.id;
    }
    return activeEffectId === preset.id;
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
          categories={categoryTabs}
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
              isSelected={isPresetSelected(preset)}
              disabled={disabled}
              onSelect={handlePresetSelect}
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
