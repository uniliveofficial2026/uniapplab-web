/**
 * Apply full TRTC / Tencent WebAR beauty to an existing camera MediaStream.
 * Used by chat video calls, karaoke studio, and any other camera surface.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  getTencentBeautifyParams,
  type BeautyPresetId,
} from './beautyFilters';
import { isBodyShapeActive, type BodyShapeParams } from './bodyShape';
import { isTencentWebARConfigured } from '../webar/webarConfig';
import { useTencentWebAR } from '../webar/useTencentWebAR';
import type { TencentEffectSelection } from '../webar/webarTypes';
import { EMPTY_BODY_SHAPE, EMPTY_TENCENT_EFFECT_SELECTION } from '../webar/webarTypes';

export type UseStreamBeautyOptions = {
  enabled: boolean;
  inputStream: MediaStream | null;
  beautyId?: BeautyPresetId;
  effects?: TencentEffectSelection;
  bodyShape?: Partial<BodyShapeParams>;
  mirror?: boolean;
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
  bodyShape = EMPTY_BODY_SHAPE,
  mirror = true,
}: UseStreamBeautyOptions) {
  const configured = isTencentWebARConfigured();
  const activeId = beautyId === 'none' ? 'none' : beautyId;
  const mergedShape = { ...EMPTY_BODY_SHAPE, ...bodyShape };
  const shapeSignature = JSON.stringify(mergedShape);
  const beautify = useMemo(
    () => getTencentBeautifyParams(activeId, mergedShape),
    [activeId, shapeSignature],
  );
  const effectsActive = Boolean(
    effects.makeupId || effects.stickerId || effects.filterId || effects.backgroundUrl,
  );
  const beautyOn =
    activeId !== 'none' || effectsActive || isBodyShapeActive(mergedShape);

  const webar = useTencentWebAR({
    enabled,
    inputStream,
    mirror,
    beautify,
    effects,
  });

  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!webar.ready) {
      setOutputStream(null);
      return;
    }
    setOutputStream(webar.outputStreamRef.current);
  }, [webar.ready, webar.outputStreamRef]);

  return {
    configured,
    ready: webar.ready,
    loading: webar.loading,
    error: webar.error,
    active: webar.ready && beautyOn,
    outputVideoRef: webar.outputVideoRef,
    outputStream,
    catalogs: webar.catalogs,
  };
}
