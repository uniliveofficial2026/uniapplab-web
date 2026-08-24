import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Check,
  Droplet,
  Eye,
  ImagePlus,
  RotateCcw,
  ScanFace,
  Smile,
  Sparkles,
  User,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  BEAUTY_OFF_PARAMS,
  getTencentBeautifyParams,
  LIVE_BEAUTY_PRESETS,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import { EMPTY_BODY_SHAPE, type BodyShapeParams } from '../../lib/ar/bodyShape';
import { getBeautyEngineAdapter } from '../../lib/ar/beautyEngineAdapter';
import type { TencentBeautifyParams, TencentEffectItem, TencentEffectSelection } from '../../lib/webar/webarTypes';
import { EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';
import {
  BACKGROUND_UPLOAD_ACCEPT,
  inferTencentBackgroundType,
  prepareTencentWebARBackgroundMedia,
  type TencentBackgroundMedia,
} from '../../lib/webar/webarBackgroundImage';
import { isTencentWebARLicenseUnavailable } from '../../lib/webar/webarConfig';
import { safeAvatarUrl } from '../../lib/safe';
import { V14_BEAUTY, V14_BEAUTY_PRESET_IDS } from './liveToolsV14Artwork';
import { UniLivesStickerThumbnail } from '../../components/stickers/brand';
import {
  getDailyPopularBeautyPicks,
  recordBeautyHostPick,
  type BeautyHostPick,
  type BeautyHostPickKind,
} from '../../lib/ar/beautyDailyHostPicks';
import './live-tools-approved-v15.css';

type LiveBeautySheetProps = {
  isOpen: boolean;
  onClose: () => void;
  activeBeautyId: BeautyPresetId;
  onSelectBeauty: (beautyId: BeautyPresetId) => void;
  effects?: TencentEffectSelection;
  onEffectsChange?: (effects: TencentEffectSelection) => void;
  bodyShape?: BodyShapeParams;
  onBodyShapeChange?: (shape: BodyShapeParams) => void;
  catalogs?: {
    makeups: TencentEffectItem[];
    stickers: TencentEffectItem[];
    filters: TencentEffectItem[];
    backgrounds: string[];
    beautyCovers?: Record<string, string>;
    shapeCovers?: Record<string, string>;
    shapeEffectByPreset?: Record<string, string>;
  };
  readyEffectIds?: string[];
  anchorBottom?: number;
  anchorMode?: 'fixed' | 'container';
  webarConfigured?: boolean;
  webarLoading?: boolean;
  webarError?: string | null;
  variant?: 'bottom' | 'inline' | 'call';
  onBeautifyParamsChange?: (params: TencentBeautifyParams) => void;
  beautifyOverride?: TencentBeautifyParams | null;
  selfName?: string;
  selfAvatarUrl?: string;
};

type NumericBeautifyKey = Exclude<keyof TencentBeautifyParams, 'distortCenter1' | 'distortCenter2'>;

const SLIDERS: Array<{
  name: string;
  icon: typeof Eye;
  key: NumericBeautifyKey;
  signed?: boolean;
}> = [
  { name: 'Skin Smooth', icon: Droplet, key: 'dermabrasion' },
  { name: 'Whiten', icon: ScanFace, key: 'whiten' },
  { name: 'Sharpen', icon: Eye, key: 'usm' },
  { name: 'Slim Face', icon: ScanFace, key: 'lift' },
  { name: 'V-Face', icon: ScanFace, key: 'shave' },
  { name: 'Big Eyes', icon: Eye, key: 'eye' },
  { name: 'Bright Eyes', icon: Sparkles, key: 'eyeBrightness' },
  { name: 'Nose', icon: ScanFace, key: 'nose', signed: true },
  { name: 'Lips', icon: Smile, key: 'lip', signed: true },
  { name: 'Chin', icon: ScanFace, key: 'chin' },
  { name: 'Cheekbone', icon: ScanFace, key: 'cheekbone' },
  { name: 'Forehead', icon: ScanFace, key: 'forehead' },
];

const APPROVED_SLIDER_NAMES = new Set([
  'Skin Smooth',
  'Whiten',
  'Sharpen',
  'Slim Face',
  'Big Eyes',
  'Nose',
  'Lips',
  'Chin',
]);

/** Cold-start fallback when no host picks have been recorded yet today. */
const POPULAR_FALLBACK_LABELS = ['Natural', 'Cute', 'Korean'] as const;

const TABS = ['All', 'Popular', 'Beautify', 'Makeup', 'Stickers', 'Face', 'Filters', 'BG'] as const;
type BeautyTab = (typeof TABS)[number];
type CatalogKind = Extract<BeautyHostPickKind, 'makeup' | 'sticker' | 'filter'>;
type CatalogEntry = TencentEffectItem & { kind: CatalogKind };

const INITIAL_LEVELS: number[] = SLIDERS.map((slider) =>
  slider.signed
    ? 50
    : slider.key === 'dermabrasion'
      ? 80
      : slider.key === 'whiten' || slider.key === 'eye'
        ? 70
        : slider.key === 'usm'
          ? 60
          : 50,
);

function levelsToParams(levels: number[]): TencentBeautifyParams {
  const params: TencentBeautifyParams = { ...BEAUTY_OFF_PARAMS };
  SLIDERS.forEach((slider, index) => {
    const raw = levels[index] ?? (slider.signed ? 50 : 0);
    params[slider.key] = slider.signed ? (raw - 50) / 50 : raw / 100;
  });
  return params;
}

function paramsToLevels(params: TencentBeautifyParams): number[] {
  return SLIDERS.map((slider) => {
    const value = params[slider.key];
    if (typeof value !== 'number') return slider.signed ? 50 : 0;
    if (slider.signed) return Math.round(Math.max(0, Math.min(100, value * 50 + 50)));
    return Math.round(Math.max(0, Math.min(100, value * 100)));
  });
}

function presetLabelFromId(id: BeautyPresetId): string {
  if (id === 'none') return 'None';
  return Object.entries(V14_BEAUTY_PRESET_IDS).find(([, value]) => value === id)?.[0] ?? 'None';
}

export function LiveBeautySheet({
  isOpen,
  onClose,
  activeBeautyId,
  onSelectBeauty,
  effects = EMPTY_TENCENT_EFFECT_SELECTION,
  onEffectsChange,
  onBodyShapeChange,
  catalogs,
  webarConfigured = false,
  webarLoading = false,
  webarError = null,
  variant = 'bottom',
  onBeautifyParamsChange,
  beautifyOverride = null,
  selfName = 'You',
  selfAvatarUrl,
}: LiveBeautySheetProps) {
  const [tab, setTab] = useState<BeautyTab>('All');
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [selectedLabel, setSelectedLabel] = useState(() => presetLabelFromId(activeBeautyId));
  const [applying, setApplying] = useState(false);
  const [uploadedBackgrounds, setUploadedBackgrounds] = useState<TencentBackgroundMedia[]>([]);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [popularPicks, setPopularPicks] = useState<BeautyHostPick[]>(() => getDailyPopularBeautyPicks(12));
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const uploadedBackgroundsRef = useRef<TencentBackgroundMedia[]>([]);
  const openedRef = useRef(false);
  const selfAvatar = safeAvatarUrl(selfAvatarUrl || '');
  uploadedBackgroundsRef.current = uploadedBackgrounds;

  const licenseUnavailable = !webarConfigured || isTencentWebARLicenseUnavailable(webarError);
  const engineNote = licenseUnavailable
    ? 'GPU beauty is warming up — presets and sliders still apply to your live camera.'
    : webarError && !isTencentWebARLicenseUnavailable(webarError)
      ? webarError
      : null;

  useEffect(() => {
    if (isOpen) setSelectedLabel(presetLabelFromId(activeBeautyId));
  }, [isOpen, activeBeautyId]);

  useEffect(() => {
    if (!isOpen) return;
    setPopularPicks(getDailyPopularBeautyPicks(12));
  }, [isOpen, tab]);

  const refreshPopularPicks = () => {
    setPopularPicks(getDailyPopularBeautyPicks(12));
  };

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    setLevels(paramsToLevels(beautifyOverride ?? getTencentBeautifyParams(activeBeautyId)));
  }, [isOpen, activeBeautyId, beautifyOverride]);

  useEffect(() => {
    if (webarError) console.warn('[Tencent WebAR]', webarError);
  }, [webarError]);

  useEffect(
    () => () => {
      uploadedBackgroundsRef.current.forEach((item) => {
        if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
      });
    },
    [],
  );

  const applyParams = (nextLevels: number[]) => {
    const params = levelsToParams(nextLevels);
    onBeautifyParamsChange?.(params);
    getBeautyEngineAdapter().updateParameters(params as Record<string, number>);
  };

  const setLevel = (index: number, value: number) => {
    setLevels((previous) => {
      const next = previous.map((item, itemIndex) => (itemIndex === index ? value : item));
      applyParams(next);
      return next;
    });
  };

  const applyPreset = (label: string) => {
    setSelectedLabel(label);
    const id = V14_BEAUTY_PRESET_IDS[label] ?? 'none';
    onSelectBeauty(id);
    void getBeautyEngineAdapter().applyPreset(id);
    const next = paramsToLevels(getTencentBeautifyParams(id));
    setLevels(next);
    applyParams(next);
    if (label !== 'None' && id !== 'none') {
      const cover = catalogs?.beautyCovers?.[id] || V14_BEAUTY.find(([name]) => name === label)?.[1];
      recordBeautyHostPick({ kind: 'preset', id, label, cover });
      refreshPopularPicks();
    }
  };

  const applyBackground = (url: string | null, type: TencentEffectSelection['backgroundType'] = null) => {
    onEffectsChange?.({
      ...effects,
      backgroundUrl: url,
      backgroundType: url ? type ?? inferTencentBackgroundType(url) : null,
    });
  };

  const handleBackgroundUpload = async (file: File | undefined) => {
    if (!file) return;
    setBgUploadError(null);
    setBgUploading(true);
    try {
      const media = await prepareTencentWebARBackgroundMedia(file);
      setUploadedBackgrounds((previous) => [media, ...previous]);
      applyBackground(media.url, media.type);
    } catch (error) {
      setBgUploadError(error instanceof Error ? error.message : 'Could not upload that background.');
    } finally {
      setBgUploading(false);
      if (bgUploadRef.current) bgUploadRef.current.value = '';
    }
  };

  const reset = () => {
    const off = paramsToLevels(BEAUTY_OFF_PARAMS);
    setLevels(off);
    setSelectedLabel('None');
    onSelectBeauty('none');
    onBodyShapeChange?.(EMPTY_BODY_SHAPE);
    onEffectsChange?.({ ...EMPTY_TENCENT_EFFECT_SELECTION });
    applyParams(off);
    void getBeautyEngineAdapter().applyPreset('none');
  };

  const commitBeauty = () => {
    if (applying) return;
    const id = V14_BEAUTY_PRESET_IDS[selectedLabel] ?? 'none';
    const params = levelsToParams(levels);
    setApplying(true);
    onSelectBeauty(id);
    onBeautifyParamsChange?.(params);
    const engine = getBeautyEngineAdapter();
    try {
      void Promise.resolve(engine.applyPreset(id))
        .then(() => engine.updateParameters(params as Record<string, number>))
        .catch((error) => {
          console.warn('[Beauty Apply]', error);
          window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Beauty effect could not be applied.' }));
        })
        .finally(() => {
          setApplying(false);
          onClose();
        });
    } catch (error) {
      console.warn('[Beauty Apply]', error);
      setApplying(false);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Beauty effect could not be applied.' }));
    }
  };

  const makeupCatalog = useMemo<TencentEffectItem[]>(() => {
    const sdk = catalogs?.makeups ?? [];
    if (sdk.length) return sdk;
    return V14_BEAUTY.map(([name, cover]) => ({
      id: `makeup:${V14_BEAUTY_PRESET_IDS[name] ?? name}`,
      name,
      cover,
    }));
  }, [catalogs?.makeups]);

  const filterCatalog = useMemo<TencentEffectItem[]>(() => {
    const sdk = catalogs?.filters ?? [];
    if (sdk.length) return sdk;
    return LIVE_BEAUTY_PRESETS.filter((row) => row.id !== 'none').map((row) => ({
      id: `filter:${row.id}`,
      name: row.label,
      cover: catalogs?.beautyCovers?.[row.id] || '',
    }));
  }, [catalogs?.beautyCovers, catalogs?.filters]);

  const stickerCatalog = useMemo<TencentEffectItem[]>(() => {
    return (catalogs?.stickers ?? []).slice(0, 48);
  }, [catalogs?.stickers]);

  const allEffectCatalog = useMemo<CatalogEntry[]>(() => {
    return [
      ...makeupCatalog.map((item) => ({ ...item, kind: 'makeup' as const })),
      ...stickerCatalog.map((item) => ({ ...item, kind: 'sticker' as const })),
      ...filterCatalog.map((item) => ({ ...item, kind: 'filter' as const })),
    ];
  }, [filterCatalog, makeupCatalog, stickerCatalog]);

  const popularEntries = useMemo(() => {
    if (popularPicks.length) return popularPicks;
    return POPULAR_FALLBACK_LABELS.map((label) => {
      const id = V14_BEAUTY_PRESET_IDS[label] ?? label;
      const artwork = V14_BEAUTY.find(([name]) => name === label)?.[1];
      return {
        kind: 'preset' as const,
        id,
        label,
        cover: catalogs?.beautyCovers?.[id] || artwork,
        count: 0,
      };
    });
  }, [catalogs?.beautyCovers, popularPicks]);

  if (!isOpen) return null;

  // Tab content:
  // All = every look + beauty sliders + makeup/stickers/filters
  // Popular = today's most host-picked effects
  // Beautify = looks + skin/beauty sliders
  // Face = face reshape sliders only
  const showPresets = tab === 'All' || tab === 'Beautify';
  const showSliders = tab === 'All' || tab === 'Beautify' || tab === 'Face';
  const showAllCatalog = tab === 'All';
  const showPopular = tab === 'Popular';
  const showBeautify = showPresets || showSliders || showPopular;
  const overlay = variant !== 'inline';
  const visibleSliders = tab === 'Face'
    ? SLIDERS.map((slider, index) => ({ slider, index }))
    : SLIDERS.map((slider, index) => ({ slider, index })).filter(({ slider }) => APPROVED_SLIDER_NAMES.has(slider.name));

  const applyCatalogEffect = (item: TencentEffectItem, kind: CatalogKind) => {
    if (kind === 'makeup') {
      onEffectsChange?.({ ...effects, makeupId: item.id, makeupIntensity: 0.8 });
      const preset = V14_BEAUTY_PRESET_IDS[item.name];
      if (preset) applyPreset(item.name);
      else {
        recordBeautyHostPick({ kind: 'makeup', id: item.id, label: item.name || item.label || item.id, cover: item.cover });
        refreshPopularPicks();
      }
      return;
    }
    if (kind === 'sticker') {
      onEffectsChange?.({ ...effects, stickerId: item.id });
      recordBeautyHostPick({ kind: 'sticker', id: item.id, label: item.name || item.label || item.id, cover: item.cover });
      refreshPopularPicks();
      return;
    }
    onEffectsChange?.({ ...effects, filterId: item.id });
    const presetId = item.id.startsWith('filter:') ? item.id.slice('filter:'.length) : item.id;
    if (presetId.startsWith('beauty-')) {
      onSelectBeauty(presetId as BeautyPresetId);
      void getBeautyEngineAdapter().applyPreset(presetId);
    }
    recordBeautyHostPick({ kind: 'filter', id: item.id, label: item.name || item.label || item.id, cover: item.cover });
    refreshPopularPicks();
  };

  const selectCatalogItem = (item: TencentEffectItem) => {
    if (tab === 'Makeup') applyCatalogEffect(item, 'makeup');
    if (tab === 'Stickers') applyCatalogEffect(item, 'sticker');
    if (tab === 'Filters') applyCatalogEffect(item, 'filter');
  };

  const applyPopularPick = (pick: BeautyHostPick) => {
    if (pick.kind === 'preset') {
      applyPreset(pick.label);
      return;
    }
    applyCatalogEffect(
      { id: pick.id, name: pick.label, cover: pick.cover || '' },
      pick.kind,
    );
  };

  const isPopularSelected = (pick: BeautyHostPick) => {
    if (pick.kind === 'preset') return selectedLabel === pick.label;
    if (pick.kind === 'makeup') return effects.makeupId === pick.id;
    if (pick.kind === 'sticker') return effects.stickerId === pick.id;
    return effects.filterId === pick.id;
  };

  const selectedCatalogId =
    tab === 'Makeup'
      ? effects.makeupId
      : tab === 'Stickers'
        ? effects.stickerId
        : tab === 'Filters'
          ? effects.filterId
          : null;
  const unselectedNaturalArtwork = V14_BEAUTY.find(([label]) => label === 'Clear')?.[1] ?? V14_BEAUTY[0][1];

  const clearCatalogSelection = () => {
    if (tab === 'Makeup') onEffectsChange?.({ ...effects, makeupId: null, makeupIntensity: null });
    if (tab === 'Stickers') onEffectsChange?.({ ...effects, stickerId: null });
    if (tab === 'Filters') onEffectsChange?.({ ...effects, filterId: null });
  };

  const renderCatalogGrid = (
    items: Array<TencentEffectItem & { kind?: CatalogKind }>,
    emptyLabel: string,
    options?: { stickers?: boolean; onPick?: (item: TencentEffectItem & { kind?: CatalogKind }) => void },
  ) => (
    <div className="lt15-catalog-grid">
      <button
        type="button"
        className={`lt15-catalog-tile ${!selectedCatalogId && !options?.onPick ? 'is-selected' : ''}`}
        onClick={clearCatalogSelection}
      >
        <span className="lt15-catalog-cover lt15-beauty-none"><Ban size={24} /></span>
        <span>None</span>
      </button>
      {items.map((item) => {
        const selected = options?.onPick
          ? false
          : selectedCatalogId === item.id;
        return (
          <button
            type="button"
            className={`lt15-catalog-tile ${selected ? 'is-selected' : ''}`}
            key={`${item.kind || tab}:${item.id}`}
            onClick={() => {
              if (options?.onPick) options.onPick(item);
              else selectCatalogItem(item);
            }}
          >
            {item.cover ? (
              <img className="lt15-catalog-cover" src={item.cover} alt="" />
            ) : options?.stickers || item.kind === 'sticker' ? (
              <span className="lt15-catalog-cover lt15-beauty-sticker-thumb">
                <UniLivesStickerThumbnail
                  businessStickerId={item.id}
                  remoteIconOverride={item.cover || null}
                  imgClassName="lt15-catalog-cover-img"
                  alt=""
                />
              </span>
            ) : (
              <span className="lt15-catalog-cover lt15-beauty-none">{(item.name || item.label || item.id).slice(0, 1)}</span>
            )}
            <span>{item.name || item.label || item.id}</span>
          </button>
        );
      })}
      {items.length === 0 ? <div className="lt15-catalog-empty">{emptyLabel}</div> : null}
    </div>
  );

  const sheet = (
    <section className="lt15-sheet lt15-beauty" data-ui-id="live.beauty.v14.exact" role="dialog" aria-modal={overlay} aria-label="Beauty Effects">
      <div className="lt15-handle" />
      <div className="lt15-head">
        <div>
          <div className="lt15-title">Beauty Effects ✨</div>
          <div className="lt15-sub">Enhance your beauty and shine on live!</div>
        </div>
        <div className="lt15-head-actions">
          <button className="lt15-soft-btn" type="button" onClick={reset}>
            <RotateCcw size={14} /> Reset
          </button>
          <button className="lt15-icon-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
      </div>
      <div className="lt15-tabs">
        {TABS.map((label) => (
          <button key={label} type="button" className={`lt15-tab ${tab === label ? 'is-active' : ''}`} onClick={() => setTab(label)}>
            {label}
          </button>
        ))}
      </div>
      <div className="lt15-beauty-body">
        {engineNote ? <div className="lt15-beauty-note">{engineNote}</div> : null}
        {webarLoading ? <div className="lt15-beauty-note">Loading beauty engine…</div> : null}
        {showBeautify ? (
          <>
            {showPopular ? (
              <>
                <div className="lt15-beauty-note">
                  {popularPicks.length
                    ? 'Most host picks today'
                    : 'Top host picks today — rankings fill as hosts apply looks'}
                </div>
                <div className="lt15-catalog-grid">
                  {popularEntries.map((pick) => (
                    <button
                      type="button"
                      key={`${pick.kind}:${pick.id}`}
                      className={`lt15-catalog-tile ${isPopularSelected(pick) ? 'is-selected' : ''}`}
                      onClick={() => applyPopularPick(pick)}
                    >
                      {pick.cover ? (
                        <img className="lt15-catalog-cover" src={pick.cover} alt="" />
                      ) : pick.kind === 'sticker' ? (
                        <span className="lt15-catalog-cover lt15-beauty-sticker-thumb">
                          <UniLivesStickerThumbnail
                            businessStickerId={pick.id}
                            imgClassName="lt15-catalog-cover-img"
                            alt=""
                          />
                        </span>
                      ) : (
                        <span className="lt15-catalog-cover lt15-beauty-none">{pick.label.slice(0, 1)}</span>
                      )}
                      <span>{pick.label}</span>
                      {pick.count > 0 ? <b className="lt15-popular-count">{pick.count}</b> : null}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {showPresets ? (
              <div className="lt15-beauty-presets">
                <button type="button" className={`lt15-beauty-preset ${selectedLabel === 'None' ? 'selected' : ''}`} onClick={() => applyPreset('None')}>
                  <div className="lt15-beauty-none" aria-hidden="true"><Ban size={28} /></div>
                  <span>None</span>
                  {selectedLabel === 'None' ? <Check className="lt15-selection-check" size={14} aria-hidden /> : null}
                </button>
                {V14_BEAUTY.map(([label, artwork]) => {
                  const selected = selectedLabel === label;
                  const configuredArtwork = catalogs?.beautyCovers?.[V14_BEAUTY_PRESET_IDS[label]];
                  const visibleArtwork = configuredArtwork || (label === 'Natural' && !selected ? unselectedNaturalArtwork : artwork);
                  return (
                    <button type="button" key={label} className={`lt15-beauty-preset ${selected ? 'selected' : ''}`} onClick={() => applyPreset(label)}>
                      <img src={visibleArtwork} alt={label} />
                      <span>{label}</span>
                      {selected ? <Check className="lt15-selection-check" size={14} aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {showSliders ? (
              <div className={`lt15-sliders ${tab === 'Face' ? 'is-face' : ''}`}>
                {visibleSliders.map(({ slider, index }) => {
                  const SliderIcon = slider.icon;
                  return (
                    <label className="lt15-slider" key={slider.name}>
                      <span className="lt15-slider-head">
                        <span><SliderIcon size={15} aria-hidden /> {slider.name}</span>
                        <span className="lt15-slider-val">{levels[index]}</span>
                      </span>
                      <input type="range" min="0" max="100" value={levels[index] ?? 0} aria-label={slider.name} onChange={(event) => setLevel(index, Number(event.target.value))} />
                    </label>
                  );
                })}
              </div>
            ) : null}
            {showAllCatalog ? (
              <>
                <div className="lt15-beauty-note">Makeup, stickers & filters</div>
                <div className="lt15-catalog-grid">
                  {allEffectCatalog.map((item) => {
                    const selected =
                      (item.kind === 'makeup' && effects.makeupId === item.id)
                      || (item.kind === 'sticker' && effects.stickerId === item.id)
                      || (item.kind === 'filter' && effects.filterId === item.id);
                    return (
                      <button
                        type="button"
                        className={`lt15-catalog-tile ${selected ? 'is-selected' : ''}`}
                        key={`all:${item.kind}:${item.id}`}
                        onClick={() => applyCatalogEffect(item, item.kind)}
                      >
                        {item.cover ? (
                          <img className="lt15-catalog-cover" src={item.cover} alt="" />
                        ) : item.kind === 'sticker' ? (
                          <span className="lt15-catalog-cover lt15-beauty-sticker-thumb">
                            <UniLivesStickerThumbnail
                              businessStickerId={item.id}
                              imgClassName="lt15-catalog-cover-img"
                              alt=""
                            />
                          </span>
                        ) : (
                          <span className="lt15-catalog-cover lt15-beauty-none">{(item.name || item.label || item.id).slice(0, 1)}</span>
                        )}
                        <span>{item.name || item.label || item.id}</span>
                      </button>
                    );
                  })}
                  {!allEffectCatalog.length ? (
                    <div className="lt15-catalog-empty">Effect catalogs appear after the beauty engine starts.</div>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        ) : tab === 'BG' ? (
          <div className="lt15-catalog-grid">
            <input ref={bgUploadRef} type="file" accept={BACKGROUND_UPLOAD_ACCEPT} hidden onChange={(event) => void handleBackgroundUpload(event.target.files?.[0])} />
            <button type="button" className="lt15-catalog-tile lt15-bg-upload" disabled={bgUploading} onClick={() => bgUploadRef.current?.click()}>
              <span className="lt15-catalog-cover lt15-beauty-none"><ImagePlus size={22} aria-hidden /></span>
              <span>{bgUploading ? 'Uploading…' : 'Upload'}</span>
            </button>
            <button type="button" className={`lt15-catalog-tile ${!effects.backgroundUrl ? 'is-selected' : ''}`} onClick={() => applyBackground(null)}>
              <span className="lt15-catalog-cover lt15-beauty-none"><Ban size={24} /></span>
              <span>None</span>
            </button>
            {uploadedBackgrounds.map((item) => (
              <button type="button" className={`lt15-catalog-tile ${effects.backgroundUrl === item.url ? 'is-selected' : ''}`} key={item.url} onClick={() => applyBackground(item.url, item.type)}>
                {item.type === 'video' ? <span className="lt15-catalog-cover lt15-beauty-none">▶</span> : <img className="lt15-catalog-cover" src={item.url} alt="" />}
                <span>Mine</span>
              </button>
            ))}
            {(catalogs?.backgrounds ?? []).map((url, index) => (
              <button type="button" className={`lt15-catalog-tile ${effects.backgroundUrl === url ? 'is-selected' : ''}`} key={url} onClick={() => applyBackground(url, inferTencentBackgroundType(url))}>
                <img className="lt15-catalog-cover" src={url} alt="" />
                <span>BG {index + 1}</span>
              </button>
            ))}
            {bgUploadError ? <div className="lt15-catalog-empty">{bgUploadError}</div> : null}
          </div>
        ) : tab === 'Stickers' ? (
          renderCatalogGrid(stickerCatalog, 'No stickers loaded yet. They appear after the beauty engine starts.', { stickers: true })
        ) : (
          renderCatalogGrid(
            tab === 'Makeup' ? makeupCatalog : filterCatalog,
            tab === 'Makeup' ? 'No makeup looks loaded.' : 'No filters loaded.',
          )
        )}
      </div>
      <div className="lt15-footer lt15-beauty-footer">
        <div className="lt15-recipient">
          <div className="lt15-recipient-avatar">
            {selfAvatar ? <img src={selfAvatar} alt="" /> : <User size={20} aria-hidden />}
          </div>
          <div><small>Send to</small><b>{selfName}</b></div>
          <span>›</span>
        </div>
        <button className="lt15-primary" type="button" onClick={commitBeauty} disabled={applying} aria-busy={applying}>
          <WandSparkles className={applying ? 'lt15-apply-icon is-applying' : 'lt15-apply-icon'} size={19} aria-hidden />
          {applying ? 'Applying…' : 'Apply Effect'}
        </button>
      </div>
    </section>
  );

  if (!overlay) return <div className="lt15-inline-host">{sheet}</div>;

  return (
    <div className="lt15-overlay lt15-overlay--beauty">
      <button className="lt15-scrim" onClick={onClose} aria-label="Close beauty" type="button" />
      {sheet}
    </div>
  );
}
