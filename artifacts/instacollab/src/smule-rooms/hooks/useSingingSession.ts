import { useCallback, useEffect, useRef, useState } from 'react';
import { buildVoiceEffectNodes } from '../../lib/live/voiceChangerPipeline';
import type { VoiceChangerEffectId } from '../utils/voiceEffects';
import { resolveDisplayVoiceStatus } from '../utils/singingVoiceStatus';

export type SingingVoiceStatus = 'silent' | 'warming' | 'good' | 'strong';

/**
 * Local singing mic monitor (lyrics UI). LiveKit publish uses useRoomVoiceChanger instead.
 */
export function useSingingSession(enabled: boolean, voiceEffect: VoiceChangerEffectId) {
  const [micLevel, setMicLevel] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const effectNodesRef = useRef<ReturnType<typeof buildVoiceEffectNodes> | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef(0);
  const bufferRef = useRef<Uint8Array | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (fallbackIntervalRef.current !== null) {
      window.clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    effectNodesRef.current?.dispose?.();
    effectNodesRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    analyserRef.current = null;
    bufferRef.current = null;
    lastVoiceAtRef.current = 0;
    setMicLevel(0);
    setIsVoiceActive(false);
  }, []);

  const startFallbackLevels = useCallback(() => {
    fallbackIntervalRef.current = window.setInterval(() => {
      const t = Date.now() / 150;
      const base = 10 + Math.max(0, Math.sin(t) * 55 + Math.cos(t * 1.7) * 20);
      const noise = Math.random() * 15 - 7.5;
      const level = Math.max(0, Math.min(100, Math.floor(base + noise)));
      if (Math.sin(t * 0.5) < -0.85) {
        setMicLevel(0);
        setIsVoiceActive(false);
      } else {
        setMicLevel(level);
        setIsVoiceActive(level > 12);
      }
    }, 80);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      startFallbackLevels();
      return () => cleanup();
    }

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          startFallbackLevels();
          return;
        }

        const context = new AudioContextClass({ latencyHint: 'interactive' });
        contextRef.current = context;
        if (context.state === 'suspended') {
          await context.resume();
        }

        const source = context.createMediaStreamSource(stream);
        sourceRef.current = source;

        const effectNodes = buildVoiceEffectNodes(context, voiceEffect);
        effectNodesRef.current = effectNodes;

        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.45;
        analyserRef.current = analyser;
        bufferRef.current = new Uint8Array(analyser.frequencyBinCount);

        source.connect(effectNodes.input);
        effectNodes.output.connect(analyser);

        const monitor = context.createGain();
        monitor.gain.value = 0.12;
        effectNodes.output.connect(monitor);
        monitor.connect(context.destination);

        const tick = () => {
          if (cancelled || !analyserRef.current || !bufferRef.current) return;

          analyserRef.current.getByteFrequencyData(bufferRef.current as Uint8Array<ArrayBuffer>);
          let sum = 0;
          for (let i = 0; i < bufferRef.current.length; i += 1) {
            sum += bufferRef.current[i]!;
          }
          const average = sum / bufferRef.current.length;
          const level = Math.min(100, Math.floor((average / 100) * 100));
          setMicLevel(level);

          const now = Date.now();
          if (level > 12) {
            lastVoiceAtRef.current = now;
            setIsVoiceActive(true);
          } else if (now - lastVoiceAtRef.current > 220) {
            setIsVoiceActive(false);
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          startFallbackLevels();
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, cleanup, startFallbackLevels]);

  useEffect(() => {
    if (!enabled || !contextRef.current || !sourceRef.current) return;

    try {
      sourceRef.current.disconnect();
      effectNodesRef.current?.dispose?.();
      effectNodesRef.current?.output.disconnect();

      const effectNodes = buildVoiceEffectNodes(contextRef.current, voiceEffect);
      effectNodesRef.current = effectNodes;
      sourceRef.current.connect(effectNodes.input);

      const analyser = analyserRef.current;
      if (analyser) {
        effectNodes.output.connect(analyser);
      }
    } catch {
      // Graph rebuild is best-effort when switching effects mid-performance.
    }
  }, [enabled, voiceEffect]);

  const voiceStatus = resolveDisplayVoiceStatus(enabled, micLevel, isVoiceActive);

  return {
    micLevel,
    isVoiceActive,
    voiceStatus,
  };
}
