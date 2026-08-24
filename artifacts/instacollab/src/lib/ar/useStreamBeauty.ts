/**
 * Apply full TRTC / Tencent WebAR beauty to an existing camera MediaStream.
 * Used by chat video calls, karaoke studio, and any other camera surface.
 *
 * CRITICAL: WebAR gets a cloned video track so the raw preview <video> never
 * goes blank when the SDK consumes the camera for GPU processing.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  isTencentBeautifyActive,
  resolveTencentBeautifyParams,
  type BeautyPresetId,
} from './beautyFilters';
import type { TencentBeautifyParams } from '../webar/webarTypes';
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
  beautifyOverride?: TencentBeautifyParams | null;
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

/** Instant CSS tray labels for karaoke while WebAR catches up. */
export function beautyIdToKaraokeFilterName(beautyId: BeautyPresetId): string {
  switch (beautyId) {
    case 'beauty-smooth':
      return 'Smooth';
    case 'beauty-soft':
      return 'Soft';
    case 'beauty-glow':
      return 'Glow';
    case 'beauty-natural':
      return 'Natural';
    case 'beauty-clear':
      return 'Clear';
    default:
      return 'None';
  }
}

function cloneVideoOnlyStream(source: MediaStream): MediaStream | null {
  const tracks = source.getVideoTracks();
  if (tracks.length === 0) return null;
  try {
    return new MediaStream(tracks.map((t) => t.clone()));
  } catch {
    return null;
  }
}

function stopStreamTracks(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

export function useStreamBeauty({
  enabled,
  inputStream,
  beautyId = 'none',
  effects = EMPTY_TENCENT_EFFECT_SELECTION,
  bodyShape,
  mirror = false,
  keepWarm,
  loadCatalogs: loadCatalogsOption,
  persistent,
  beautyPanelOpen = false,
  beautifyOverride = null,
}: UseStreamBeautyOptions) {
  const configured = isTencentWebARConfigured();
  const activeId = beautyId === 'none' ? 'none' : beautyId;
  const bodyShapeKey = bodyShape ? JSON.stringify(bodyShape) : '';
  const overrideKey = beautifyOverride ? JSON.stringify(beautifyOverride) : '';
  const beautify = useMemo(
    () => (beautifyOverride ? beautifyOverride : resolveTencentBeautifyParams(activeId, bodyShape)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys capture content
    [activeId, bodyShapeKey, overrideKey],
  );
  const effectsActive = Boolean(
    effects.makeupId ||
      effects.stickerId ||
      effects.filterId ||
      effects.backgroundUrl ||
      effects.shapeEffectId,
  );
  const shapeActive = !BODY_SHAPE_COMING_SOON && bodyShape ? isBodyShapeActive(bodyShape) : false;
  const beautySelected =
    activeId !== 'none' ||
    effectsActive ||
    shapeActive ||
    Boolean(beautifyOverride && isTencentBeautifyActive(beautifyOverride));
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

  // Isolated video track for WebAR — never hand the preview stream to the SDK.
  // Defer stopping clones so React Strict Mode remounts / WebAR cancel can finish
  // before tracks flip to ended (that used to poison shared init forever).
  const [webarInputStream, setWebarInputStream] = useState<MediaStream | null>(null);
  const inputVideoTrackId = inputStream?.getVideoTracks()[0]?.id ?? '';

  useEffect(() => {
    if (!inputStream || !trtcEngine) {
      setWebarInputStream((prev) => {
        if (prev) window.setTimeout(() => stopStreamTracks(prev), 50);
        return null;
      });
      return undefined;
    }

    const cloned = cloneVideoOnlyStream(inputStream);
    if (!cloned) {
      setWebarInputStream(null);
      return undefined;
    }

    setWebarInputStream((prev) => {
      if (prev && prev !== cloned) {
        window.setTimeout(() => stopStreamTracks(prev), 50);
      }
      return cloned;
    });

    return () => {
      // Delay past Strict Mode cleanup→setup and WebAR effect cancel.
      window.setTimeout(() => stopStreamTracks(cloned), 50);
    };
  }, [inputStream, trtcEngine, inputVideoTrackId]);

  const webar = useTencentWebAR({
    enabled: warm && trtcEngine,
    inputStream: webarInputStream,
    mirror,
    beautify,
    effects,
    loadCatalogs: loadCatalogsOption ?? beautyPanelOpen,
    persistent: trtcProcessing,
  });

  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!webar.ready) {
      // Keep last good beauty stream — clearing to null blanks the preview on brief ready dips.
      return undefined;
    }
    const sync = () => {
      const next = webar.outputStreamRef.current;
      if (!next) return;
      setOutputStream((prev) => (prev === next ? prev : next));
    };
    sync();
    const id = window.setTimeout(sync, 250);
    return () => window.clearTimeout(id);
  }, [webar.ready, webar.outputStreamRef, webar.beautyActive]);

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
