import React, { useState } from 'react';
import { ScanFace } from 'lucide-react';
import { CameraBeautyBottomShell } from '../../components/camera/CameraBeautyBottomShell';
import {
  CAMERA_BEAUTY_PANEL_TITLE,
  EFFECT_TRAY_BTN,
  EFFECT_TRAY_BTN_ACTIVE,
  EFFECT_TRAY_BTN_IDLE,
} from '../../lib/camera/cameraBeautyLabels';
import {
  LIVE_BEAUTY_PRESETS,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import { BodyShapeTray } from '../../components/camera/BodyShapeTray';
import { EMPTY_BODY_SHAPE, type BodyShapeParams } from '../../lib/ar/bodyShape';
import { getDeepAREffectPreviewCandidates } from '../../lib/deepar/deeparConfig';
import type { TencentEffectItem, TencentEffectSelection } from '../../lib/webar/webarTypes';
import { EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';

/** Local pre-look thumbs for TRTC beauty presets (shared with DeepAR preview pack). */
const TRTC_BEAUTY_PREVIEW_IDS: Record<string, string> = {
  none: 'none',
  'beauty-smooth': 'beauty-smooth',
  'beauty-soft': 'beauty-soft',
  'beauty-glow': 'beauty-glow',
  'beauty-natural': 'beauty-natural',
  'beauty-clear': 'beauty-clear',
};

type BeautyTab = 'beauty' | 'shape' | 'makeup' | 'sticker' | 'filter' | 'background';

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
  };
  /** Pixels from viewport bottom (footer / transport clearance). */
  anchorBottom?: number;
  webarConfigured?: boolean;
  webarLoading?: boolean;
  webarError?: string | null;
  /** Inline embed for settings panels — no fixed bottom shell. */
  variant?: 'bottom' | 'inline';
};

const TABS: Array<{ id: BeautyTab; label: string }> = [
  { id: 'beauty', label: 'Beauty' },
  { id: 'shape', label: 'Shape' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'sticker', label: 'Sticker' },
  { id: 'filter', label: 'Filter' },
  { id: 'background', label: 'Background' },
];

export function LiveBeautySheet({
  isOpen,
  onClose,
  activeBeautyId,
  onSelectBeauty,
  effects = EMPTY_TENCENT_EFFECT_SELECTION,
  onEffectsChange,
  bodyShape = EMPTY_BODY_SHAPE,
  onBodyShapeChange,
  catalogs,
  anchorBottom = 0,
  webarConfigured = false,
  webarLoading = false,
  webarError = null,
  variant = 'bottom',
}: LiveBeautySheetProps) {
  const [tab, setTab] = useState<BeautyTab>('beauty');

  const patchEffects = (patch: Partial<TencentEffectSelection>) => {
    onEffectsChange?.({ ...effects, ...patch });
  };

  const body = (
    <>
      {!webarConfigured ? (
        <p className="mb-2 px-0.5 text-[10px] font-bold text-amber-200 drop-shadow">
          Add <code className="font-mono">VITE_TENCENT_WEBAR_*</code> for full TRTC beauty. CSS fallback active.
        </p>
      ) : null}
      {webarError ? (
        <p className="mb-2 px-0.5 text-[10px] font-bold text-red-300 drop-shadow" role="alert">
          {webarError}
        </p>
      ) : null}

      <div className="mb-2 flex gap-1 overflow-x-auto scrollbar-hide touch-pan-x">
        {TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition touch-manipulation ${
                active
                  ? 'bg-rose-600/40 text-rose-50 border border-rose-200/60'
                  : 'bg-black/75 text-white/80 border border-white/20 hover:bg-black/85 hover:text-white'
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === 'beauty' ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x pb-0.5">
          {LIVE_BEAUTY_PRESETS.map((preset) => {
            const selected = activeBeautyId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectBeauty(preset.id)}
                aria-pressed={selected}
                className={`flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-2 transition touch-manipulation ${
                  selected
                    ? 'border-rose-200/70 bg-black/75 text-rose-50'
                    : 'border-white/20 bg-black/70 text-white/90 hover:border-white/30 hover:bg-black/80'
                }`}
              >
                <span
                  className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border text-[11px] font-black ${
                    selected ? 'border-rose-200/70' : 'border-white/15'
                  }`}
                  style={{ background: preset.swatch }}
                >
                  {preset.id === 'none' ? (
                    'Off'
                  ) : (
                    <BeautyPrelookThumb
                      effectId={TRTC_BEAUTY_PREVIEW_IDS[preset.id] ?? 'beauty-soft'}
                      label={preset.label}
                    />
                  )}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wide">{preset.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === 'shape' ? (
        <BodyShapeTray
          bodyShape={bodyShape}
          onBodyShapeChange={onBodyShapeChange ?? (() => undefined)}
          accent="rose"
        />
      ) : null}

      {tab === 'makeup' ? (
        <EffectGrid
          noneLabel="No Makeup"
          selectedId={effects.makeupId}
          items={catalogs?.makeups ?? []}
          onSelect={(id) => patchEffects({ makeupId: id })}
          emptyHint="Makeup presets load when TRTC WebAR is ready."
        />
      ) : null}

      {tab === 'sticker' ? (
        <EffectGrid
          noneLabel="No Sticker"
          selectedId={effects.stickerId}
          items={catalogs?.stickers ?? []}
          onSelect={(id) => patchEffects({ stickerId: id })}
          emptyHint="Stickers load when TRTC WebAR is ready."
        />
      ) : null}

      {tab === 'filter' ? (
        <EffectGrid
          noneLabel="No Filter"
          selectedId={effects.filterId}
          items={catalogs?.filters ?? []}
          onSelect={(id) => patchEffects({ filterId: id })}
          emptyHint="Filters load when TRTC WebAR is ready."
        />
      ) : null}

      {tab === 'background' ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x pb-0.5">
          <button
            type="button"
            onClick={() => patchEffects({ backgroundUrl: null })}
            className={`flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-2 touch-manipulation ${
              !effects.backgroundUrl
                ? 'border-rose-200/70 bg-black/75 text-rose-50'
                : 'border-white/20 bg-black/70 text-white/90'
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-[10px] font-black">
              Off
            </span>
            <span className="text-[10px] font-black uppercase">None</span>
          </button>
          {(catalogs?.backgrounds ?? []).map((url, index) => {
            const selected = effects.backgroundUrl === url;
            return (
              <button
                key={url}
                type="button"
                onClick={() => patchEffects({ backgroundUrl: url })}
                className={`flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-2 touch-manipulation ${
                  selected
                    ? 'border-rose-200/70 bg-black/75 text-rose-50'
                    : 'border-white/20 bg-black/70 text-white/90 hover:border-white/30 hover:bg-black/80'
                }`}
              >
                <img
                  src={url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover border border-white/15"
                />
                <span className="text-[10px] font-black uppercase">BG {index + 1}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );

  if (!isOpen) return null;

  if (variant === 'inline') {
    return <div className="bg-transparent p-0">{body}</div>;
  }

  return (
    <CameraBeautyBottomShell
      isOpen
      onClose={onClose}
      title={CAMERA_BEAUTY_PANEL_TITLE}
      titleIcon={<ScanFace size={12} aria-hidden />}
      accent="rose"
      anchorBottom={anchorBottom}
      loading={webarLoading}
      loadingLabel="Loading Beauty…"
    >
      {body}
    </CameraBeautyBottomShell>
  );
}

function BeautyPrelookThumb({ effectId, label }: { effectId: string; label: string }) {
  const candidates = getDeepAREffectPreviewCandidates(effectId);
  const [index, setIndex] = useState(0);
  const src = candidates[Math.min(index, candidates.length - 1)] ?? candidates[0];
  return (
    <img
      key={src}
      src={src}
      alt={label}
      className="absolute inset-0 h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev))}
    />
  );
}

function EffectGrid({
  noneLabel,
  selectedId,
  items,
  onSelect,
  emptyHint,
}: {
  noneLabel: string;
  selectedId: string | null;
  items: TencentEffectItem[];
  onSelect: (id: string | null) => void;
  emptyHint: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x pb-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`${EFFECT_TRAY_BTN} ${
          !selectedId ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-[10px] font-black">
          Off
        </span>
        <span className="text-[10px] font-black uppercase tracking-wide">{noneLabel}</span>
      </button>
      {items.length === 0 ? (
        <p className="self-center px-2 text-[10px] font-bold text-white/60 drop-shadow">{emptyHint}</p>
      ) : (
        items.map((item) => {
          const selected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`${EFFECT_TRAY_BTN} ${
                selected ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
              }`}
            >
              {item.cover ? (
                <img
                  src={item.cover}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover border border-white/15"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-[10px] font-black">
                  {item.name.slice(0, 1)}
                </span>
              )}
              <span className="max-w-[4.5rem] truncate text-[10px] font-black uppercase tracking-wide">
                {item.name}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
