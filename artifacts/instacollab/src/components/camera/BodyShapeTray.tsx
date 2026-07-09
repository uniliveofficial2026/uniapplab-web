import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BODY_SHAPE_PRESETS,
  BODY_SHAPE_SLIDER_GROUPS,
  BODY_SHAPE_COMING_SOON,
  EMPTY_BODY_SHAPE,
  type BodyShapeParams,
} from '../../lib/ar/bodyShape';
import { ShapePresetThumb } from './BeautyTrayThumbs';
import {
  EFFECT_TRAY_BTN,
  EFFECT_TRAY_BTN_ACTIVE,
  EFFECT_TRAY_BTN_IDLE,
} from '../../lib/camera/cameraBeautyLabels';

const SHAPE_PANEL_MAX_HEIGHT = '30dvh';
const SLIDER_COMMIT_MS = 120;

type BodyShapeTrayProps = {
  bodyShape: BodyShapeParams;
  onBodyShapeChange: (shape: BodyShapeParams) => void;
  shapeCovers?: Record<string, string>;
  shapeEffectByPreset?: Record<string, string>;
  onShapeEffectChange?: (effectId: string | null) => void;
  accent?: 'rose' | 'fuchsia';
  /** No outer glass panel — embed in call/capture chrome. */
  bare?: boolean;
  /** Show controls but block interaction (coming soon). */
  comingSoon?: boolean;
};

export function BodyShapeTray({
  bodyShape,
  onBodyShapeChange,
  shapeCovers = {},
  shapeEffectByPreset = {},
  onShapeEffectChange,
  accent = 'rose',
  bare = false,
  comingSoon = BODY_SHAPE_COMING_SOON,
}: BodyShapeTrayProps) {
  const disabled = comingSoon;
  const activeBorder =
    accent === 'fuchsia' ? 'border-fuchsia-200/70' : 'border-rose-200/70';
  const accentClass = accent === 'fuchsia' ? 'accent-fuchsia-400' : 'accent-rose-400';

  const [localShape, setLocalShape] = useState(bodyShape);
  const localShapeRef = useRef(localShape);
  const commitTimerRef = useRef(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    localShapeRef.current = localShape;
  }, [localShape]);

  useEffect(() => {
    if (!draggingRef.current) {
      setLocalShape(bodyShape);
      localShapeRef.current = bodyShape;
    }
  }, [bodyShape]);

  const syncShapeEffect = useCallback(
    (shape: BodyShapeParams, presetId?: string) => {
      if (!onShapeEffectChange) return;
      if (presetId === 'shape-natural') {
        onShapeEffectChange(null);
        return;
      }
      if (presetId && shapeEffectByPreset[presetId]) {
        onShapeEffectChange(shapeEffectByPreset[presetId]);
        return;
      }
      onShapeEffectChange(null);
    },
    [onShapeEffectChange, shapeEffectByPreset],
  );

  const commitShape = useCallback(
    (next: BodyShapeParams, immediate = false, presetId?: string) => {
      if (disabled) return;
      setLocalShape(next);
      localShapeRef.current = next;
      window.clearTimeout(commitTimerRef.current);
      if (immediate) {
        onBodyShapeChange(next);
        syncShapeEffect(next, presetId);
        return;
      }
      commitTimerRef.current = window.setTimeout(() => {
        onBodyShapeChange(localShapeRef.current);
        syncShapeEffect(localShapeRef.current, presetId);
      }, SLIDER_COMMIT_MS);
    },
    [disabled, onBodyShapeChange, syncShapeEffect],
  );

  useEffect(() => {
    return () => window.clearTimeout(commitTimerRef.current);
  }, []);

  const isPresetActive = (preset: (typeof BODY_SHAPE_PRESETS)[number]) =>
    BODY_SHAPE_SLIDER_GROUPS.every((group) =>
      group.sliders.every(
        (slider) =>
          Math.abs((localShape[slider.key] ?? 50) - (preset.values[slider.key] ?? 50)) < 4,
      ),
    );

  const handleSliderChange = (key: keyof BodyShapeParams, value: number) => {
    if (disabled) return;
    draggingRef.current = true;
    commitShape({ ...localShape, [key]: value });
  };

  const handleSliderRelease = () => {
    if (disabled) return;
    draggingRef.current = false;
    window.clearTimeout(commitTimerRef.current);
    onBodyShapeChange(localShapeRef.current);
    syncShapeEffect(localShapeRef.current);
  };

  return (
    <div
      className={
        bare
          ? 'flex max-h-[30dvh] flex-col overflow-hidden'
          : 'flex max-h-[30dvh] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/80 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl'
      }
      style={{ maxHeight: SHAPE_PANEL_MAX_HEIGHT }}
    >
      {disabled ? (
        <div className={`shrink-0 ${bare ? 'pb-2' : 'border-b border-white/10 px-3 pb-2 pt-2'}`}>
          <p className="rounded-full border border-amber-200/35 bg-amber-500/15 px-3 py-1.5 text-center text-[10px] font-black uppercase tracking-wide text-amber-100">
            Body shape — coming soon
          </p>
        </div>
      ) : null}
      <div className={`shrink-0 ${bare ? 'pb-2' : 'border-b border-white/10 px-2 pb-2 pt-2'}`}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x">
          {BODY_SHAPE_PRESETS.map((preset) => {
            const selected = isPresetActive(preset);
            const cover = shapeCovers[preset.id];
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => commitShape({ ...preset.values }, true, preset.id)}
                className={`${EFFECT_TRAY_BTN} ${
                  selected ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span
                  className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border ${
                    selected ? activeBorder : 'border-white/15'
                  }`}
                  style={{ background: preset.swatch }}
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ) : (
                    <ShapePresetThumb
                      presetId={preset.id}
                      swatch={preset.swatch}
                      label={preset.label}
                    />
                  )}
                </span>
                <span className="max-w-[4.5rem] truncate text-[10px] font-black uppercase tracking-wide">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y scrollbar-hide ${bare ? 'px-0 py-1' : 'px-3 py-2'} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="flex flex-col gap-3 pb-1">
          {BODY_SHAPE_SLIDER_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="sticky top-0 z-[1] bg-black/80 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/55 backdrop-blur-sm">
                {group.title}
              </p>
              {group.sliders.map((slider) => (
                <label key={slider.key} className="flex flex-col gap-1">
                  <span className="flex items-center justify-between text-[10px] font-bold text-white/85">
                    {slider.label}
                    <span className="tabular-nums text-white/55">{localShape[slider.key]}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    disabled={disabled}
                    value={localShape[slider.key]}
                    onChange={(event) =>
                      handleSliderChange(slider.key, Number(event.target.value))
                    }
                    onPointerUp={handleSliderRelease}
                    onPointerCancel={handleSliderRelease}
                    onTouchEnd={handleSliderRelease}
                    className={`h-1.5 w-full touch-none ${accentClass}`}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={`shrink-0 ${bare ? 'pt-2' : 'border-t border-white/10 px-3 py-2'}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            commitShape({ ...EMPTY_BODY_SHAPE }, true, 'shape-natural');
          }}
          className={`rounded-full border border-white/25 bg-black/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/85 hover:bg-black ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          Reset shape
        </button>
      </div>
    </div>
  );
}
