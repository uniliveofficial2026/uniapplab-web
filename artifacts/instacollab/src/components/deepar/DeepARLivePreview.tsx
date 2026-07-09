import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CameraDualBeautyButtons } from '../camera/CameraDualBeautyButtons';
import { DEEPAR_DEFAULT_EFFECT_ID, isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { useCameraStream } from '../../lib/deepar/useCameraStream';
import { useDeepAR } from '../../lib/deepar/useDeepAR';
import {
  resolveTencentBeautifyParams,
  type BeautyPresetId,
} from '../../lib/ar/beautyFilters';
import { EMPTY_BODY_SHAPE, isBodyShapeActive, type BodyShapeParams } from '../../lib/ar/bodyShape';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';
import { useTencentWebAR } from '../../lib/webar/useTencentWebAR';
import { DeepARFilterCarousel } from './DeepARFilterCarousel';
import { LiveBeautySheet } from '../../smule-rooms/components/LiveBeautySheet';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  type TencentEffectSelection,
} from '../../lib/webar/webarTypes';

export type DeepARLivePreviewProps = {
  enabled: boolean;
  className?: string;
  onReady?: (getStream: () => Promise<MediaStream | null>) => void;
  onError?: (message: string) => void;
};

/** Live broadcast preview with DeepAR + TRTC beauty — exposes processed stream via onReady. */
export function DeepARLivePreview({
  enabled,
  className = '',
  onReady,
  onError,
}: DeepARLivePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [deeparEffectId, setDeeparEffectId] = useState(DEEPAR_DEFAULT_EFFECT_ID);
  const [beautyId, setBeautyId] = useState<BeautyPresetId>('none');
  const [beautyEffects, setBeautyEffects] = useState<TencentEffectSelection>(
    EMPTY_TENCENT_EFFECT_SELECTION,
  );
  const [bodyShape, setBodyShape] = useState<BodyShapeParams>(EMPTY_BODY_SHAPE);
  const [deeparPanelOpen, setDeeparPanelOpen] = useState(false);
  const [beautyPanelOpen, setBeautyPanelOpen] = useState(false);
  const configured = isDeepARConfigured();
  const webarConfigured = isTencentWebARConfigured();
  const deeparActive = configured && !webarConfigured && deeparEffectId !== 'none';
  const beautyEffectsActive = Boolean(
    beautyEffects.makeupId ||
      beautyEffects.stickerId ||
      beautyEffects.filterId ||
      beautyEffects.backgroundUrl ||
      beautyEffects.shapeEffectId,
  );
  const shapeActive = isBodyShapeActive(bodyShape);
  const beautyActive = beautyId !== 'none' || beautyEffectsActive || shapeActive;

  const handleSelectDeepAR = useCallback((effectId: string) => {
    setDeeparEffectId(effectId);
    if (effectId !== 'none') {
      setBeautyId('none');
      setBeautyEffects(EMPTY_TENCENT_EFFECT_SELECTION);
    }
  }, []);

  const handleSelectBeauty = useCallback((nextBeautyId: BeautyPresetId) => {
    setBeautyId(nextBeautyId);
    if (nextBeautyId !== 'none') {
      setDeeparEffectId('none');
    }
  }, []);

  const handleBeautyEffectsChange = useCallback((effects: TencentEffectSelection) => {
    setBeautyEffects(effects);
    const active = Boolean(
      effects.makeupId || effects.stickerId || effects.filterId || effects.backgroundUrl,
    );
    if (active) setDeeparEffectId('none');
  }, []);

  const camera = useCameraStream({
    enabled: enabled && (configured || webarConfigured),
    audio: true,
  });

  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    if (!enabled || !camera.ready) {
      setInputStream(null);
      return;
    }
    setInputStream(camera.streamRef.current);
  }, [enabled, camera.ready, camera.streamRef]);

  const webar = useTencentWebAR({
    enabled: enabled && camera.ready && beautyActive && !deeparActive,
    inputStream,
    mirror: true,
    beautify: resolveTencentBeautifyParams(beautyId, bodyShape),
    effects: beautyEffects,
  });

  const deepar = useDeepAR({
    previewRef,
    videoElementRef: camera.videoRef,
    enabled: enabled && configured && camera.ready && deeparActive,
    initialEffectId: deeparEffectId,
  });

  React.useEffect(() => {
    const message = camera.error ?? deepar.error ?? webar.error;
    if (message) onError?.(message);
  }, [camera.error, deepar.error, webar.error, onError]);

  React.useEffect(() => {
    if (deeparActive && deepar.ready) {
      onReady?.(() => deepar.getProcessedStream(30));
      return;
    }
    if (beautyActive && webar.beautyActive && webar.outputStreamRef.current) {
      onReady?.(async () => webar.outputStreamRef.current);
      return;
    }
    if (!deeparActive && !beautyActive && camera.ready) {
      onReady?.(async () => camera.streamRef.current ?? null);
    }
  }, [
    deeparActive,
    deepar.ready,
    beautyActive,
    webar.beautyActive,
    webar.outputStreamRef,
    camera.ready,
    deepar,
    camera.streamRef,
    onReady,
  ]);

  if (!configured && !webarConfigured) {
    return (
      <div className={`rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground ${className}`}>
        Set <code>VITE_DEEPAR_LICENSE_KEY</code> or Tencent WebAR credentials in .env for AR live effects.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-border bg-black ${className}`}>
      <video
        ref={camera.videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover scale-x-[-1] transition-opacity duration-200 ${
          (deeparActive && deepar.ready) || (beautyActive && webar.beautyActive)
            ? 'opacity-0 pointer-events-none'
            : 'opacity-100'
        }`}
      />
      <video
        ref={webar.outputVideoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
          beautyActive && webar.beautyActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <div
        ref={previewRef}
        className={`w-full aspect-video transition-opacity duration-200 ${
          deeparActive && deepar.ready ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {((deeparActive && deepar.loading) || !camera.ready) && !deepar.ready && !camera.error && !deepar.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
          {deeparActive && deepar.loadProgress > 0 && (
            <span className="text-[10px] text-white/70">{deepar.loadProgress}%</span>
          )}
        </div>
      )}
      {(camera.ready || deepar.ready || webar.beautyActive) && (
        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent space-y-2">
          <CameraDualBeautyButtons
            variant="inline"
            deeparPanelOpen={deeparPanelOpen}
            beautyPanelOpen={beautyPanelOpen}
            deeparActive={deeparActive}
            beautyActive={beautyActive}
            onToggleDeepAR={() => {
              setDeeparPanelOpen((open) => {
                const next = !open;
                if (next) setBeautyPanelOpen(false);
                return next;
              });
            }}
            onToggleBeauty={() => {
              setBeautyPanelOpen((open) => {
                const next = !open;
                if (next) setDeeparPanelOpen(false);
                return next;
              });
            }}
            showDeepAR={configured && !webarConfigured}
            showBeauty
            className="justify-center"
          />
          {deeparPanelOpen ? (
            <DeepARFilterCarousel
              activeEffectId={deeparEffectId}
              onSelect={handleSelectDeepAR}
              deepAROnly
              className="max-w-full"
            />
          ) : null}
          {beautyPanelOpen ? (
            <LiveBeautySheet
              isOpen
              onClose={() => setBeautyPanelOpen(false)}
              activeBeautyId={beautyId}
              onSelectBeauty={handleSelectBeauty}
              effects={beautyEffects}
              onEffectsChange={handleBeautyEffectsChange}
              bodyShape={bodyShape}
              onBodyShapeChange={setBodyShape}
              catalogs={webar.catalogs}
              readyEffectIds={webar.readyEffectIds}
              anchorBottom={0}
              webarConfigured={webarConfigured}
              webarLoading={webar.loading}
              webarError={webar.error}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
