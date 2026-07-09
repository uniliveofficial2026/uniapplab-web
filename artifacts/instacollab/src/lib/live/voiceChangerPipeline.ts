import type { VoiceChangerEffectId } from '../../smule-rooms/utils/voiceEffects';

export type VoiceEffectGraph = {
  input: AudioNode;
  output: AudioNode;
  dispose?: () => void;
};

export function buildVoiceEffectNodes(
  context: AudioContext,
  effect: VoiceChangerEffectId,
): VoiceEffectGraph {
  const input = context.createGain();
  const output = context.createGain();
  input.gain.value = 1;
  output.gain.value = 1;

  if (effect === 'studio') {
    input.connect(output);
    return { input, output };
  }

  if (effect === 'hall') {
    const delay = context.createDelay(1.2);
    delay.delayTime.value = 0.28;
    const feedback = context.createGain();
    feedback.gain.value = 0.35;
    const wet = context.createGain();
    wet.gain.value = 0.45;
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    input.connect(output);
    wet.connect(output);
    return { input, output };
  }

  if (effect === 'warm') {
    const shelf = context.createBiquadFilter();
    shelf.type = 'lowshelf';
    shelf.frequency.value = 320;
    shelf.gain.value = 8;
    input.connect(shelf);
    shelf.connect(output);
    return { input, output };
  }

  if (effect === 'robot') {
    const ring = context.createOscillator();
    ring.frequency.value = 48;
    const ringGain = context.createGain();
    ringGain.gain.value = 0.22;
    const amp = context.createGain();
    ring.connect(ringGain);
    ringGain.connect(amp.gain);
    ring.start();
    input.connect(amp);
    amp.connect(output);
    return {
      input,
      output,
      dispose: () => {
        try {
          ring.stop();
        } catch {
          /* ignore */
        }
      },
    };
  }

  if (effect === 'chipmunk') {
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const treble = context.createBiquadFilter();
    treble.type = 'peaking';
    treble.frequency.value = 2800;
    treble.gain.value = 6;
    input.connect(filter);
    filter.connect(treble);
    treble.connect(output);
    return { input, output };
  }

  if (effect === 'deep') {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const shelf = context.createBiquadFilter();
    shelf.type = 'lowshelf';
    shelf.frequency.value = 180;
    shelf.gain.value = 10;
    input.connect(filter);
    filter.connect(shelf);
    shelf.connect(output);
    return { input, output };
  }

  input.connect(output);
  return { input, output };
}

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

export type VoiceChangerLevelSample = {
  audioLevel: number;
  isVoiceActive: boolean;
};

/**
 * Web Audio voice changer that outputs a processed MediaStreamTrack for LiveKit publish.
 * TRTC/LiveKit have no built-in voice FX — effects run locally then publish the processed track.
 */
export class VoiceChangerEngine {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private effectNodes: VoiceEffectGraph | null = null;
  private analyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private rawStream: MediaStream | null = null;
  private effectId: VoiceChangerEffectId = 'studio';
  private levelBuffer: Uint8Array | null = null;
  private lastVoiceAt = 0;
  private rafId: number | null = null;
  private onLevel: ((sample: VoiceChangerLevelSample) => void) | null = null;
  private monitorGain: GainNode | null = null;
  private monitorEnabled = false;
  private static readonly MONITOR_GAIN = 0.12;

  get processedTrack(): MediaStreamTrack | null {
    return this.destination?.stream.getAudioTracks()[0] ?? null;
  }

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  setLevelListener(listener: ((sample: VoiceChangerLevelSample) => void) | null) {
    this.onLevel = listener;
  }

  setMonitorEnabled(enabled: boolean) {
    if (this.monitorEnabled === enabled) return;
    this.monitorEnabled = enabled;
    void this.context?.resume();
    this.syncMonitorTap();
  }

  private syncMonitorTap() {
    if (!this.context || !this.effectNodes) return;

    if (!this.monitorEnabled) {
      if (this.monitorGain) {
        try {
          this.effectNodes.output.disconnect(this.monitorGain);
          this.monitorGain.disconnect();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (!this.monitorGain) {
      this.monitorGain = this.context.createGain();
      this.monitorGain.gain.value = VoiceChangerEngine.MONITOR_GAIN;
    }

    try {
      this.effectNodes.output.connect(this.monitorGain);
      this.monitorGain.connect(this.context.destination);
    } catch {
      /* already connected */
    }
  }

  private wireEffectOutput() {
    if (!this.effectNodes || !this.analyser || !this.destination) return;
    const { output } = this.effectNodes;
    output.connect(this.analyser);
    output.connect(this.destination);
    this.syncMonitorTap();
  }

  async start(effectId: VoiceChangerEffectId = 'studio'): Promise<MediaStreamTrack> {
    await this.stop();
    this.effectId = effectId;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.rawStream = stream;

    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext unavailable');
    }

    const context = new AudioContextClass({ latencyHint: 'interactive' });
    this.context = context;
    if (context.state === 'suspended') {
      await context.resume();
    }

    const source = context.createMediaStreamSource(stream);
    this.source = source;

    const effectNodes = buildVoiceEffectNodes(context, effectId);
    this.effectNodes = effectNodes;

    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;
    this.analyser = analyser;
    this.levelBuffer = new Uint8Array(analyser.frequencyBinCount);

    const destination = context.createMediaStreamDestination();
    this.destination = destination;

    source.connect(effectNodes.input);
    this.wireEffectOutput();

    const tick = () => {
      if (!this.analyser || !this.levelBuffer || !this.onLevel) return;
      const { rms, level } = computeRmsLevel(this.analyser, this.levelBuffer);
      const now = Date.now();
      let isVoiceActive = false;
      if (rms >= SPEAKING_RMS_THRESHOLD) {
        this.lastVoiceAt = now;
        isVoiceActive = true;
      } else if (now - this.lastVoiceAt > SILENCE_HOLD_MS) {
        isVoiceActive = false;
      }
      this.onLevel({ audioLevel: level, isVoiceActive });
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);

    const track = destination.stream.getAudioTracks()[0];
    if (!track) {
      throw new Error('Voice changer produced no audio track');
    }
    return track;
  }

  setEffect(effectId: VoiceChangerEffectId) {
    if (!this.context || !this.source || effectId === this.effectId) return;
    this.effectId = effectId;

    try {
      this.source.disconnect();
      this.effectNodes?.dispose?.();
      this.effectNodes?.output.disconnect();

      const effectNodes = buildVoiceEffectNodes(this.context, effectId);
      this.effectNodes = effectNodes;
      this.source.connect(effectNodes.input);
      this.wireEffectOutput();
    } catch {
      /* graph rebuild is best-effort */
    }
  }

  async stop(): Promise<void> {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.source?.disconnect();
    this.source = null;
    this.effectNodes?.dispose?.();
    this.effectNodes = null;
    this.analyser = null;
    this.levelBuffer = null;
    this.destination = null;
    if (this.monitorGain) {
      try {
        this.monitorGain.disconnect();
      } catch {
        /* ignore */
      }
      this.monitorGain = null;
    }
    this.rawStream?.getTracks().forEach((track) => track.stop());
    this.rawStream = null;
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }
    this.lastVoiceAt = 0;
  }
}
