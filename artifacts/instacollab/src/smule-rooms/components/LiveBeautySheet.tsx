import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Loader2, ScanFace, Upload } from 'lucide-react';
import { AppCameraButton } from '../../components/camera/AppCameraButton';
import { cameraCaptureToFile } from '../../lib/camera/cameraCaptureAdapters';
import { CameraBeautyBottomShell } from '../../components/camera/CameraBeautyBottomShell';
import { BeautyPresetThumb } from '../../components/camera/BeautyTrayThumbs';
import { BodyShapeTray } from '../../components/camera/BodyShapeTray';
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
import { EMPTY_BODY_SHAPE, BODY_SHAPE_COMING_SOON, isBodyShapeActive, resolveBodyShapePresetId, type BodyShapeParams } from '../../lib/ar/bodyShape';
import type { TencentEffectItem, TencentEffectSelection } from '../../lib/webar/webarTypes';
import { EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';
import {
  BACKGROUND_UPLOAD_ACCEPT,
  inferTencentBackgroundType,
  prepareTencentWebARBackgroundMedia,
} from '../../lib/webar/webarBackgroundImage';

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
    beautyCovers?: Record<string, string>;
    shapeCovers?: Record<string, string>;
    shapeEffectByPreset?: Record<string, string>;
  };
  /** Effect asset IDs preloaded and ready to apply without lag. */
  readyEffectIds?: string[];
  /** Pixels from bottom edge (footer / transport clearance). */
  anchorBottom?: number;
  anchorMode?: 'fixed' | 'container';
  webarConfigured?: boolean;
  webarLoading?: boolean;
  webarError?: string | null;
  /** Inline embed for settings panels — no fixed bottom shell. */
  variant?: 'bottom' | 'inline' | 'call';
};

const TABS: Array<{ id: BeautyTab; label: string }> = [
  { id: 'beauty', label: 'Beauty' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'sticker', label: 'Sticker' },
  { id: 'filter', label: 'Filter' },
  { id: 'background', label: 'Background' },
  { id: 'shape', label: 'Shape' },
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
  readyEffectIds = [],
  anchorBottom = 0,
  anchorMode = 'fixed',
  webarConfigured = false,
  webarLoading = false,
  webarError = null,
  variant = 'bottom',
}: LiveBeautySheetProps) {
  const [tab, setTab] = useState<BeautyTab>('beauty');
  const customBgInputRef = useRef<HTMLInputElement>(null);
  const [uploadedBackgroundUrl, setUploadedBackgroundUrl] = useState<string | null>(null);
  const [uploadedBackgroundLabel, setUploadedBackgroundLabel] = useState('My BG');
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const readySet = useRef(new Set(readyEffectIds));

  useEffect(() => {
    readySet.current = new Set(readyEffectIds);
  }, [readyEffectIds]);

  useEffect(() => {
    return () => {
      if (uploadedBackgroundUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedBackgroundUrl);
      }
    };
  }, [uploadedBackgroundUrl]);

  const patchEffects = (patch: Partial<TencentEffectSelection>) => {
    onEffectsChange?.({ ...effects, ...patch });
  };

  const shapeEffectByPreset = catalogs?.shapeEffectByPreset ?? {};

  const handleBodyShapeChange = useCallback(
    (shape: BodyShapeParams) => {
      if (BODY_SHAPE_COMING_SOON) return;
      onBodyShapeChange?.(shape);
      if (!onEffectsChange) return;
      if (!isBodyShapeActive(shape)) {
        onEffectsChange({ ...effects, shapeEffectId: null });
        return;
      }
      const presetId = resolveBodyShapePresetId(shape);
      const effectId =
        presetId && presetId !== 'shape-natural' && shapeEffectByPreset[presetId]
          ? shapeEffectByPreset[presetId]
          : null;
      onEffectsChange({ ...effects, shapeEffectId: effectId });
    },
    [effects, onBodyShapeChange, onEffectsChange, shapeEffectByPreset],
  );

  const handleCustomBackgroundUpload = useCallback(
    async (file: File) => {
      setUploadingBackground(true);
      try {
        const media = await prepareTencentWebARBackgroundMedia(file);
        const baseName = file.name.replace(/\.[^.]+$/, '').trim();

        setUploadedBackgroundUrl((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return media.url;
        });
        setUploadedBackgroundLabel(baseName || 'My BG');
        onEffectsChange?.({
          ...effects,
          backgroundUrl: media.url,
          backgroundType: media.type,
        });
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: `${baseName || 'Background'} applied`,
          }),
        );
      } catch (err) {
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: err instanceof Error ? err.message : 'Could not load background',
          }),
        );
      } finally {
        setUploadingBackground(false);
      }
    },
    [effects, onEffectsChange],
  );

  const isEffectReady = (id: string | null) => !id || readySet.current.has(id);

  const body = (
    <>
      {!webarConfigured ? (
        <p className="mb-2 px-0.5 text-[10px] font-bold text-amber-200 drop-shadow">
          Add <code className="font-mono">VITE_TENCENT_WEBAR_*</code> for full TRTC beauty. CSS fallback active.
        </p>
      ) : null}
      {webarConfigured && webarLoading ? (
        <p className="mb-2 px-0.5 text-[10px] font-bold text-cyan-200 drop-shadow">
          Loading TRTC beauty…
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
              {entry.id === 'shape' && BODY_SHAPE_COMING_SOON ? (
                <span className="ml-1 rounded bg-amber-500/25 px-1 py-0.5 text-[8px] font-black text-amber-100">
                  Soon
                </span>
              ) : null}
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
                className={`${EFFECT_TRAY_BTN} ${
                  selected ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
                }`}
              >
                <span
                  className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border ${
                    selected ? 'border-rose-200/70' : 'border-white/15'
                  }`}
                >
                  <BeautyPresetThumb
                    presetId={preset.id}
                    swatch={preset.swatch}
                    label={preset.label}
                  />
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
          onBodyShapeChange={handleBodyShapeChange}
          shapeCovers={catalogs?.shapeCovers}
          shapeEffectByPreset={shapeEffectByPreset}
          onShapeEffectChange={(id) => patchEffects({ shapeEffectId: id })}
          accent="rose"
          bare={variant === 'call'}
        />
      ) : null}

      {tab === 'makeup' ? (
        <EffectGrid
          noneLabel="No Makeup"
          selectedId={effects.makeupId}
          items={catalogs?.makeups ?? []}
          onSelect={(id) => patchEffects({ makeupId: id })}
          emptyHint={
            webarLoading
              ? 'Loading makeup presets…'
              : 'Makeup presets load when TRTC WebAR is ready.'
          }
          isReady={(id) => variant === 'call' || isEffectReady(id)}
        />
      ) : null}

      {tab === 'sticker' ? (
        <EffectGrid
          noneLabel="No Sticker"
          selectedId={effects.stickerId}
          items={catalogs?.stickers ?? []}
          onSelect={(id) => patchEffects({ stickerId: id })}
          emptyHint={
            webarLoading
              ? 'Loading stickers…'
              : 'Stickers load when TRTC WebAR is ready.'
          }
          isReady={(id) => variant === 'call' || isEffectReady(id)}
        />
      ) : null}

      {tab === 'filter' ? (
        <EffectGrid
          noneLabel="No Filter"
          selectedId={effects.filterId}
          items={catalogs?.filters ?? []}
          onSelect={(id) => patchEffects({ filterId: id })}
          emptyHint={
            webarLoading
              ? 'Loading filters…'
              : 'Filters load when TRTC WebAR is ready.'
          }
          isReady={() => true}
        />
      ) : null}

      {tab === 'background' ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x pb-0.5">
          <input
            ref={customBgInputRef}
            type="file"
            accept={BACKGROUND_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCustomBackgroundUpload(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => patchEffects({ backgroundUrl: null, backgroundType: null })}
            className={`${EFFECT_TRAY_BTN} ${
              !effects.backgroundUrl ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-[10px] font-black">
              Off
            </span>
            <span className="text-[10px] font-black uppercase">None</span>
          </button>
          {(catalogs?.backgrounds ?? []).map((url, index) => {
            const selected = effects.backgroundUrl === url;
            const isVideo = inferTencentBackgroundType(url) === 'video';
            const label = isVideo ? `VID ${index + 1}` : `BG ${index + 1}`;
            return (
              <button
                key={url}
                type="button"
                onClick={() =>
                  patchEffects({
                    backgroundUrl: url,
                    backgroundType: inferTencentBackgroundType(url),
                  })
                }
                className={`${EFFECT_TRAY_BTN} ${
                  selected ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
                }`}
              >
                <BackgroundPresetThumb url={url} selected={selected} />
                <span className="text-[10px] font-black uppercase">{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={uploadingBackground}
            onClick={() => {
              if (uploadedBackgroundUrl) {
                patchEffects({
                  backgroundUrl: uploadedBackgroundUrl,
                  backgroundType: inferTencentBackgroundType(uploadedBackgroundUrl),
                });
              } else {
                customBgInputRef.current?.click();
              }
            }}
            onDoubleClick={() => customBgInputRef.current?.click()}
            className={`relative ${EFFECT_TRAY_BTN} ${
              uploadedBackgroundUrl && effects.backgroundUrl === uploadedBackgroundUrl
                ? EFFECT_TRAY_BTN_ACTIVE
                : EFFECT_TRAY_BTN_IDLE
            }`}
          >
            {uploadingBackground ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70">
                <Loader2 className="h-4 w-4 animate-spin text-white/80" aria-hidden />
              </span>
            ) : uploadedBackgroundUrl ? (
              <BackgroundPresetThumb url={uploadedBackgroundUrl} selected={effects.backgroundUrl === uploadedBackgroundUrl} />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70">
                <Upload className="h-4 w-4 text-white/80" aria-hidden />
              </span>
            )}
            <span className="max-w-[4.5rem] truncate text-[10px] font-black uppercase">
              {uploadingBackground ? 'Loading…' : uploadedBackgroundUrl ? uploadedBackgroundLabel : 'Upload'}
            </span>
            {uploadedBackgroundUrl && !uploadingBackground ? (
              <span
                role="button"
                tabIndex={0}
                title="Replace file"
                onClick={(e) => {
                  e.stopPropagation();
                  customBgInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    customBgInputRef.current?.click();
                  }
                }}
                className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <Upload className="h-3 w-3" aria-hidden />
              </span>
            ) : null}
          </button>
          <AppCameraButton
            title="Live background"
            onCaptured={(payload) => {
              void (async () => {
                try {
                  const file = await cameraCaptureToFile(payload);
                  await handleCustomBackgroundUpload(file);
                } catch {
                  window.dispatchEvent(
                    new CustomEvent('app-toast', {
                      detail: 'Could not add camera background',
                    }),
                  );
                }
              })();
            }}
            disabled={uploadingBackground}
            className={`relative ${EFFECT_TRAY_BTN} ${EFFECT_TRAY_BTN_IDLE}`}
            iconClassName="h-4 w-4 text-white/80"
            label="Camera"
          />
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
      anchorMode={anchorMode}
      loading={webarLoading}
      loadingLabel="Loading Beauty…"
    >
      {body}
    </CameraBeautyBottomShell>
  );
}

/** Tray thumb — only the selected video animates; idle slots stay static to avoid GPU freeze. */
function BackgroundPresetThumb({ url, selected }: { url: string; selected: boolean }) {
  const isVideo = inferTencentBackgroundType(url) === 'video';

  if (!isVideo) {
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 rounded-full object-cover border border-white/15"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    );
  }

  if (selected) {
    return (
      <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/70">
        <video
          src={url}
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-indigo-900/80 to-violet-900/60">
      <Film className="h-4 w-4 text-white/85" aria-hidden />
    </span>
  );
}

function EffectGrid({
  noneLabel,
  selectedId,
  items,
  onSelect,
  emptyHint,
  isReady,
}: {
  noneLabel: string;
  selectedId: string | null;
  items: TencentEffectItem[];
  onSelect: (id: string | null) => void;
  emptyHint: string;
  isReady: (id: string | null) => boolean;
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
          const ready = isReady(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!ready}
              onClick={() => onSelect(item.id)}
              className={`${EFFECT_TRAY_BTN} ${
                selected ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
              } ${!ready ? 'opacity-60' : ''}`}
            >
              <span className="relative flex h-10 w-10 items-center justify-center">
                {item.cover ? (
                  <img
                    src={item.cover}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover border border-white/15"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-[10px] font-black">
                    {item.name.slice(0, 1)}
                  </span>
                )}
                {!ready ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
                    <Loader2 className="h-4 w-4 animate-spin text-white/90" aria-hidden />
                  </span>
                ) : null}
              </span>
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
