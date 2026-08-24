import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceChangerEngine, type VoiceBackgroundSoundId } from '../../lib/live/voiceChangerPipeline';
import type { VoiceChangerEffectId } from '../utils/voiceEffects';
import { resolveDisplayVoiceStatus } from '../utils/singingVoiceStatus';
import type { SingingVoiceStatus } from './useSingingSession';

type UseRoomVoiceChangerOptions = {
  enabled: boolean;
  effectId: VoiceChangerEffectId;
  /** Play processed voice to local speakers (optional sidetone). */
  monitorEnabled?: boolean;
  /** 0–100 effect wet strength before LiveKit publish. */
  effectStrength?: number;
  backgroundSound?: VoiceBackgroundSoundId;
};

export function useRoomVoiceChanger({
  enabled,
  effectId,
  monitorEnabled = false,
  effectStrength = 70,
  backgroundSound = null,
}: UseRoomVoiceChangerOptions) {
  const engineRef = useRef<VoiceChangerEngine | null>(null);
  const monitorEnabledRef = useRef(monitorEnabled);
  monitorEnabledRef.current = monitorEnabled;
  const effectStrengthRef = useRef(effectStrength);
  effectStrengthRef.current = effectStrength;
  const backgroundSoundRef = useRef(backgroundSound);
  backgroundSoundRef.current = backgroundSound;
  const effectIdRef = useRef(effectId);
  effectIdRef.current = effectId;
  const [processedTrack, setProcessedTrack] = useState<MediaStreamTrack | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const stopEngine = useCallback(async () => {
    const engine = engineRef.current;
    engineRef.current = null;
    if (engine) {
      engine.setLevelListener(null);
      await engine.stop();
    }
    setProcessedTrack(null);
    setAudioLevel(0);
    setIsVoiceActive(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      void stopEngine();
      return undefined;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return undefined;
    }

    let cancelled = false;
    const engine = new VoiceChangerEngine();
    engineRef.current = engine;

    engine.setLevelListener((sample) => {
      if (!cancelled) {
        setAudioLevel(sample.audioLevel);
        setIsVoiceActive(sample.isVoiceActive);
      }
    });

    void engine.start(effectIdRef.current).then((track) => {
      if (cancelled) {
        void engine.stop();
        return;
      }
      engine.setMonitorEnabled(monitorEnabledRef.current);
      engine.setEffectStrength(effectStrengthRef.current);
      engine.setBackgroundSound(backgroundSoundRef.current);
      setProcessedTrack(engine.getOutputTrack());
    }).catch(() => {
      if (!cancelled) {
        setProcessedTrack(null);
        setAudioLevel(0);
        setIsVoiceActive(false);
      }
    });

    return () => {
      cancelled = true;
      engine.setLevelListener(null);
      void engine.stop();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      setProcessedTrack(null);
      setAudioLevel(0);
      setIsVoiceActive(false);
    };
  }, [enabled, stopEngine]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setEffect(effectId);
    setProcessedTrack(engine.getOutputTrack());
  }, [effectId, enabled]);

  useEffect(() => {
    engineRef.current?.setMonitorEnabled(monitorEnabled);
  }, [enabled, monitorEnabled]);

  useEffect(() => {
    engineRef.current?.setEffectStrength(effectStrength);
  }, [enabled, effectStrength]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setBackgroundSound(backgroundSound);
    setProcessedTrack(engine.getOutputTrack());
  }, [enabled, backgroundSound]);

  const voiceStatus: SingingVoiceStatus = resolveDisplayVoiceStatus(
    enabled,
    audioLevel,
    isVoiceActive,
  );

  return {
    processedTrack,
    audioLevel,
    isVoiceActive,
    voiceStatus,
  };
}
