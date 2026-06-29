import { useCallback, useEffect, useRef, useState } from 'react';

const SPEAKING_RMS_THRESHOLD = 0.018;
const SILENCE_HOLD_MS = 200;

function computeRmsLevel(analyser: AnalyserNode, buffer: Uint8Array): { rms: number; level: number } {
  analyser.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = (buffer[i]! - 128) / 128;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / buffer.length);
  const level = Math.min(100, Math.round(rms * 420));
  return { rms, level };
}

export function useMicVoiceActivity(enabled: boolean) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef(0);
  const bufferRef = useRef<Uint8Array | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    analyserRef.current = null;
    bufferRef.current = null;
    lastVoiceAtRef.current = 0;
    setIsVoiceActive(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
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
        if (!AudioContextClass) return;

        const context = new AudioContextClass();
        contextRef.current = context;
        if (context.state === 'suspended') {
          await context.resume();
        }

        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.55;
        source.connect(analyser);
        analyserRef.current = analyser;
        bufferRef.current = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled || !analyserRef.current || !bufferRef.current) return;

          const { rms, level } = computeRmsLevel(analyserRef.current, bufferRef.current);
          setAudioLevel(level);

          const now = Date.now();
          if (rms >= SPEAKING_RMS_THRESHOLD) {
            lastVoiceAtRef.current = now;
            setIsVoiceActive(true);
          } else if (now - lastVoiceAtRef.current > SILENCE_HOLD_MS) {
            setIsVoiceActive(false);
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setIsVoiceActive(false);
          setAudioLevel(0);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, cleanup]);

  return { isVoiceActive, audioLevel };
}
