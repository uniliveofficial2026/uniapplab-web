/**
 * Apply full TRTC / Tencent WebAR beauty to an existing camera MediaStream.
 * Used by chat video calls, karaoke studio, and any other camera surface.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  resolveTencentBeautifyParams,
  type BeautyPresetId,
} from './beautyFilters';
import { isBodyShapeActive, BODY_SHAPE_COMING_SOON } from './bodyShape';
import {
  shouldRunTrtcEngine,
  shouldRunTrtcProcessing,
} from '../camera/cameraPipelinePolicy';
import { isTencentWebARConfigured } from '../webar/webarConfig';
import { useTencentWebAR } from '../webar/useTencentWebAR';
import type { TencentEffectSelection } from '../webar/webarTypes';
import { EMPTY_TENCENT_EFFECT_SELECTION } from '../webar/webarTypes';

export type UseStreamBeautyOptions = {
  enabled: boolean;
  inputStream: MediaStream | null;
  beautyId?: BeautyPresetId;
  effects?: TencentEffectSelection;
  bodyShape?: import('./bodyShape').BodyShapeParams;
  mirror?: boolean;
  keepWarm?: boolean;
  loadCatalogs?: boolean;
  persistent?: boolean;
  beautyPanelOpen?: boolean;
};

/** Map legacy karaoke CSS filter names → TRTC beauty presets. */
export function karaokeFilterToBeautyId(filterName: string): BeautyPresetId {
  switch (filterName) {
    case 'Smooth':
      return 'beauty-smooth';
    case 'Soft':
      return 'beauty-soft';
    case 'Glow':
      return 'beauty-glow';
    case 'Natural':
      return 'beauty-natural';
    case 'Clear':
      return 'beauty-clear';
    default:
      return 'none';
  }
}

export function useStreamBeauty({
  enabled,
  inputStream,
  beautyId = 'none',
  effects = EMPTY_TENCENT_EFFECT_SELECTION,
  bodyShape,
  mirror = true,
  keepWarm,
  loadCatalogs: loadCatalogsOption,
  persistent,
  beautyPanelOpen = false,
}: UseStreamBeautyOptions) {
  const configured = isTencentWebARConfigured();
  const activeId = beautyId === 'none' ? 'none' : beautyId;
  const beautify = useMemo(
    () => resolveTencentBeautifyParams(activeId, bodyShape),
    [activeId, bodyShape, JSON.stringify(bodyShape)],
  );
  const effectsActive = Boolean(
    effects.makeupId ||
      effects.stickerId ||
      effects.filterId ||
      effects.backgroundUrl ||
      effects.shapeEffectId,
  );
  const shapeActive = !BODY_SHAPE_COMING_SOON && bodyShape ? isBodyShapeActive(bodyShape) : false;
  const beautySelected = activeId !== 'none' || effectsActive || shapeActive;
  const warm = keepWarm ?? enabled;
  const trtcEngine = warm
    ? configured && Boolean(inputStream)
    : shouldRunTrtcEngine({
        trtcCapable: configured,
        beautySelected,
        beautyPanelOpen,
      });
  const trtcProcessing =
    persistent ??
    shouldRunTrtcProcessing({
      trtcCapable: configured,
      beautySelected,
    });

  const webar = useTencentWebAR({
    enabled: warm && trtcEngine,
    inputStream,
    mirror,
    beautify,
    effects,
    loadCatalogs: loadCatalogsOption ?? beautyPanelOpen,
    persistent: trtcProcessing,
  });

  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!webar.ready) {
      setOutputStream(null);
      return undefined;
    }
    const next = webar.outputStreamRef.current;
    setOutputStream((prev) => (prev === next ? prev : next));
    return undefined;
  }, [webar.ready, webar.outputStreamRef, webar.beautyActive, beautify, effects]);

  return {
    configured,
    ready: webar.ready,
    loading: webar.loading,
    error: webar.error,
    /** SDK is processing and a beauty preset / TRTC effect / shape is selected. */
    active: webar.ready && beautySelected,
    outputVideoRef: webar.outputVideoRef,
    outputStreamRef: webar.outputStreamRef,
    outputStream,
    catalogs: webar.catalogs,
    readyEffectIds: webar.readyEffectIds,
  };
}
