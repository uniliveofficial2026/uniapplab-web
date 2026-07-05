import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BODY_SHAPE_PRESETS,
  BODY_SHAPE_SLIDER_GROUPS,
  EMPTY_BODY_SHAPE,
  getBodyShapePreviewCandidates,
  type BodyShapeParams,
} from '../../lib/ar/bodyShape';
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
  accent?: 'rose' | 'fuchsia';
};

function ShapePrelookThumb({ previewId, label }: { previewId: string; label: string }) {
  const candidates = getBodyShapePreviewCandidates(previewId);
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

export function BodyShapeTray({
  bodyShape,
  onBodyShapeChange,
  accent = 'rose',
}: BodyShapeTrayProps) {
  const activeBorder =
    accent === 'fuchsia' ? 'border-fuchsia-200/70' : 'border-rose-200/70';
  const accentClass = accent === 'fuchsia' ? 'accent-fuchsia-400' : 'accent-rose-400';

  const [localShape, setLocalShape] = useState(bodyShape);
  const commitTimerRef = useRef(0);
  const draggingRef = useRef(false);
  const localShapeRef = useRef(bodyShape);

  useEffect(() => {
    localShapeRef.current = localShape;
  }, [localShape]);

  useEffect(() => {
    if (!draggingRef.current) {
      setLocalShape(bodyShape);
      localShapeRef.current = bodyShape;
    }
  }, [bodyShape]);

  const commitShape = useCallback(
    (next: BodyShapeParams, immediate = false) => {
      setLocalShape(next);
      localShapeRef.current = next;
      window.clearTimeout(commitTimerRef.current);
      if (immediate) {
        onBodyShapeChange(next);
        return;
      }
      commitTimerRef.current = window.setTimeout(() => {
        onBodyShapeChange(next);
      }, SLIDER_COMMIT_MS);
    },
    [onBodyShapeChange],
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
    draggingRef.current = true;
    const next = { ...localShapeRef.current, [key]: value };
    commitShape(next);
  };

  const handleSliderRelease = () => {
    draggingRef.current = false;
    window.clearTimeout(commitTimerRef.current);
    onBodyShapeChange(localShapeRef.current);
  };

  return (
    <div
      className="flex max-h-[30dvh] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/80 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      style={{ maxHeight: SHAPE_PANEL_MAX_HEIGHT }}
    >
      <div className="shrink-0 border-b border-white/10 px-2 pb-2 pt-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x">
          {BODY_SHAPE_PRESETS.map((preset) => {
            const selected = isPresetActive(preset);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => commitShape({ ...preset.values }, true)}
                className={`${EFFECT_TRAY_BTN} ${
                  selected ? EFFECT_TRAY_BTN_ACTIVE : EFFECT_TRAY_BTN_IDLE
                }`}
              >
                <span
                  className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border ${
                    selected ? activeBorder : 'border-white/15'
                  }`}
                  style={{ background: preset.swatch }}
                >
                  <ShapePrelookThumb previewId={preset.previewId} label={preset.label} />
                </span>
                <span className="max-w-[4.5rem] truncate text-[10px] font-black uppercase tracking-wide">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y scrollbar-hide px-3 py-2">
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

      <div className="shrink-0 border-t border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={() => commitShape({ ...EMPTY_BODY_SHAPE }, true)}
          className="rounded-full border border-white/25 bg-black/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/85 hover:bg-black"
        >
          Reset shape
        </button>
      </div>
    </div>
  );
}
