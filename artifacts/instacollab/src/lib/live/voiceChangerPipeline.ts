import {
  isOriginalVoiceEffect,
  resolveVoiceDspEffectId,
  type VoiceChangerEffectId,
  type VoiceChangerEffectIdLegacy,
} from '../../smule-rooms/utils/voiceEffects';

export type VoiceEffectGraph = {
  input: AudioNode;
  output: AudioNode;
  dispose?: () => void;
};

export type VoiceBackgroundSoundId = 'magic-forest' | null;

function eq(
  context: AudioContext,
  type: BiquadFilterType,
  frequency: number,
  gain = 0,
  Q = 1,
): BiquadFilterNode {
  const node = context.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.gain.value = gain;
  node.Q.value = Q;
  return node;
}

function waveshaper(context: AudioContext, amount: number): WaveShaperNode {
  const node = context.createWaveShaper();
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = Math.max(0, amount);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  node.curve = curve;
  node.oversample = '2x';
  return node;
}

function connectChain(nodes: AudioNode[]): void {
  for (let i = 0; i < nodes.length - 1; i += 1) {
    nodes[i]!.connect(nodes[i + 1]!);
  }
}

function withDelay(
  context: AudioContext,
  input: AudioNode,
  output: AudioNode,
  delayTime: number,
  feedbackAmt: number,
  wetAmt: number,
): void {
  const delay = context.createDelay(2);
  delay.delayTime.value = delayTime;
  const feedback = context.createGain();
  feedback.gain.value = feedbackAmt;
  const wet = context.createGain();
  wet.gain.value = wetAmt;
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(output);
}

function withRing(
  context: AudioContext,
  through: GainNode,
  hz: number,
  depth: number,
): OscillatorNode {
  const osc = context.createOscillator();
  const ringGain = context.createGain();
  osc.frequency.value = hz;
  ringGain.gain.value = depth;
  osc.connect(ringGain);
  ringGain.connect(through.gain);
  through.gain.value = 1 - depth * 0.35;
  osc.start();
  return osc;
}

/**
 * Delay-modulated pitch shifter. Distinct from EQ-only filters so helium/baby/chipmunk
 * are audible even without an AudioWorklet pitch library.
 */
function pitchShift(
  context: AudioContext,
  input: GainNode,
  output: GainNode,
  semitones: number,
): OscillatorNode[] {
  const ratio = Math.pow(2, semitones / 12);
  const windowSec = 0.055;
  const makeTap = (phase: number) => {
    const delay = context.createDelay(0.2);
    delay.delayTime.value = windowSec;
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = 'sawtooth';
    lfo.frequency.value = Math.abs(ratio - 1) * 12 + 0.8;
    lfoGain.gain.value = windowSec * 0.42 * Math.sign(ratio - 1 || 1);
    const wet = context.createGain();
    wet.gain.value = 0.55;
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    input.connect(delay);
    delay.connect(wet);
    wet.connect(output);
    lfo.start(context.currentTime + phase);
    return lfo;
  };
  return [makeTap(0), makeTap(0.5 / Math.max(0.2, Math.abs(ratio - 1) * 12 + 0.8))];
}

export function buildVoiceEffectNodes(
  context: AudioContext,
  effect: VoiceChangerEffectId | VoiceChangerEffectIdLegacy,
): VoiceEffectGraph {
  const resolved = resolveVoiceDspEffectId(effect as VoiceChangerEffectId);
  const input = context.createGain();
  const output = context.createGain();
  input.gain.value = 1;
  output.gain.value = 1;
  const oscillators: OscillatorNode[] = [];
  const dispose = () => {
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        /* ignore */
      }
    }
  };

  const finish = (wired = true): VoiceEffectGraph => {
    if (!wired) input.connect(output);
    return { input, output, dispose };
  };

  if (resolved === 'original') {
    input.connect(output);
    return finish(true);
  }

  if (resolved === 'sweet-girl') {
    oscillators.push(...pitchShift(context, input, output, 3.5));
    const high = eq(context, 'highshelf', 2400, 5);
    const air = eq(context, 'peaking', 4200, 4, 1.1);
    input.connect(high);
    high.connect(air);
    air.connect(output);
    return finish();
  }

  if (resolved === 'deep') {
    oscillators.push(...pitchShift(context, input, output, -4.5));
    const low = eq(context, 'lowshelf', 180, 9);
    const cut = eq(context, 'lowpass', 900, 0, 0.7);
    input.connect(low);
    low.connect(cut);
    cut.connect(output);
    return finish();
  }

  if (resolved === 'baby') {
    oscillators.push(...pitchShift(context, input, output, 7));
    const hp = eq(context, 'highpass', 280);
    const peak = eq(context, 'peaking', 3200, 7, 1.4);
    input.connect(hp);
    hp.connect(peak);
    peak.connect(output);
    return finish();
  }

  if (resolved === 'lolita') {
    oscillators.push(...pitchShift(context, input, output, 4.2));
    const peak = eq(context, 'peaking', 2600, 6, 1.2);
    const air = eq(context, 'highshelf', 5000, 3);
    input.connect(peak);
    peak.connect(air);
    air.connect(output);
    return finish();
  }

  if (resolved === 'young-boy') {
    oscillators.push(...pitchShift(context, input, output, 2.4));
    const peak = eq(context, 'peaking', 1800, 4, 1);
    input.connect(peak);
    peak.connect(output);
    return finish();
  }

  if (resolved === 'elder') {
    oscillators.push(...pitchShift(context, input, output, -2.8));
    const low = eq(context, 'lowshelf', 220, 5);
    const gravel = waveshaper(context, 6);
    const lp = eq(context, 'lowpass', 2400);
    input.connect(low);
    low.connect(gravel);
    gravel.connect(lp);
    lp.connect(output);
    return finish();
  }

  if (resolved === 'helium') {
    oscillators.push(...pitchShift(context, input, output, 8.5));
    const hp = eq(context, 'highpass', 650);
    input.connect(hp);
    hp.connect(output);
    return finish();
  }

  if (resolved === 'chipmunk') {
    oscillators.push(...pitchShift(context, input, output, 10));
    const hp = eq(context, 'highpass', 900);
    const treble = eq(context, 'peaking', 2800, 6, 1.2);
    input.connect(hp);
    hp.connect(treble);
    treble.connect(output);
    return finish();
  }

  if (resolved === 'monster') {
    oscillators.push(...pitchShift(context, input, output, -7));
    const dist = waveshaper(context, 18);
    const lp = eq(context, 'lowpass', 700);
    const amp = context.createGain();
    oscillators.push(withRing(context, amp, 32, 0.28));
    input.connect(dist);
    dist.connect(lp);
    lp.connect(amp);
    amp.connect(output);
    return finish();
  }

  if (resolved === 'robot') {
    const amp = context.createGain();
    oscillators.push(withRing(context, amp, 48, 0.32));
    const bp = eq(context, 'bandpass', 1200, 0, 2.4);
    input.connect(bp);
    bp.connect(amp);
    amp.connect(output);
    return finish();
  }

  if (resolved === 'alien') {
    oscillators.push(...pitchShift(context, input, output, 5.5));
    const amp = context.createGain();
    oscillators.push(withRing(context, amp, 90, 0.4));
    const bp = eq(context, 'bandpass', 1800, 0, 3);
    input.connect(bp);
    bp.connect(amp);
    amp.connect(output);
    return finish();
  }

  if (resolved === 'devil') {
    oscillators.push(...pitchShift(context, input, output, -6));
    const dist = waveshaper(context, 22);
    withDelay(context, input, output, 0.09, 0.25, 0.35);
    input.connect(dist);
    dist.connect(output);
    return finish();
  }

  if (resolved === 'ghost') {
    const hp = eq(context, 'highpass', 400);
    const air = eq(context, 'highshelf', 3500, 4);
    withDelay(context, input, output, 0.22, 0.42, 0.55);
    input.connect(hp);
    hp.connect(air);
    air.connect(output);
    return finish();
  }

  if (resolved === 'cave') {
    const lp = eq(context, 'lowpass', 1400);
    withDelay(context, input, output, 0.34, 0.48, 0.6);
    input.connect(lp);
    lp.connect(output);
    return finish();
  }

  if (resolved === 'radio') {
    const bp = eq(context, 'bandpass', 1800, 0, 0.85);
    const dist = waveshaper(context, 4);
    connectChain([input, bp, dist, output]);
    return finish();
  }

  if (resolved === 'telephone') {
    const hp = eq(context, 'highpass', 400);
    const lp = eq(context, 'lowpass', 3200);
    const dist = waveshaper(context, 8);
    connectChain([input, hp, lp, dist, output]);
    return finish();
  }

  if (resolved === 'megaphone') {
    const bp = eq(context, 'bandpass', 1400, 0, 1.6);
    const dist = waveshaper(context, 14);
    const peak = eq(context, 'peaking', 900, 8, 1.1);
    connectChain([input, bp, dist, peak, output]);
    return finish();
  }

  input.connect(output);
  return finish(true);
}

function createMagicForestBed(context: AudioContext): { node: AudioNode; dispose: () => void } {
  const duration = 2;
  const frames = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 720;
  filter.Q.value = 0.7;
  const wind = context.createOscillator();
  const windGain = context.createGain();
  wind.frequency.value = 0.18;
  windGain.gain.value = 80;
  wind.connect(windGain);
  windGain.connect(filter.frequency);
  const gain = context.createGain();
  gain.gain.value = 0.14;
  source.connect(filter);
  filter.connect(gain);
  source.start();
  wind.start();
  return {
    node: gain,
    dispose: () => {
      try {
        source.stop();
        wind.stop();
      } catch {
        /* ignore */
      }
    },
  };
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
 * Original is a true bypass (raw microphone track) unless Magic Forest is mixed in.
 */
export class VoiceChangerEngine {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private effectNodes: VoiceEffectGraph | null = null;
  private analyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private rawStream: MediaStream | null = null;
  private effectId: VoiceChangerEffectId = 'original';
  private backgroundSound: VoiceBackgroundSoundId = null;
  private backgroundGain: GainNode | null = null;
  private backgroundDispose: (() => void) | null = null;
  private levelBuffer: Uint8Array | null = null;
  private lastVoiceAt = 0;
  private rafId: number | null = null;
  private onLevel: ((sample: VoiceChangerLevelSample) => void) | null = null;
  private monitorGain: GainNode | null = null;
  private monitorEnabled = false;
  private outputGain: GainNode | null = null;
  private effectStrength = 1;
  private static readonly MONITOR_GAIN = 0.12;

  get processedTrack(): MediaStreamTrack | null {
    return this.getOutputTrack();
  }

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  getOutputTrack(): MediaStreamTrack | null {
    if (this.isTrueBypass()) {
      return this.rawStream?.getAudioTracks()[0] ?? null;
    }
    return this.destination?.stream.getAudioTracks()[0] ?? null;
  }

  private isTrueBypass(): boolean {
    return isOriginalVoiceEffect(this.effectId) && !this.backgroundSound;
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

  setBackgroundSound(id: VoiceBackgroundSoundId, gain = 0.14) {
    this.backgroundSound = id;
    if (this.backgroundGain) {
      this.backgroundGain.gain.value = id ? gain : 0;
    }
    if (this.context && this.destination) {
      this.syncBackgroundBed();
    }
  }

  /** 0–100 UI strength mapped to wet/output gain before LiveKit publish. */
  setEffectStrength(percent: number) {
    const normalized = Math.max(0, Math.min(100, percent)) / 100;
    this.effectStrength = isOriginalVoiceEffect(this.effectId)
      ? 1
      : normalized <= 0
        ? 0
        : 0.35 + normalized * 0.65;
    if (this.outputGain) {
      this.outputGain.gain.value = this.effectStrength;
    }
  }

  private syncMonitorTap() {
    if (!this.context) return;
    const tap = this.outputGain ?? this.effectNodes?.output;
    if (!tap) return;

    if (!this.monitorEnabled) {
      if (this.monitorGain) {
        try {
          tap.disconnect(this.monitorGain);
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
      tap.connect(this.monitorGain);
      this.monitorGain.connect(this.context.destination);
    } catch {
      /* already connected */
    }
  }

  private syncBackgroundBed() {
    if (!this.context || !this.destination) return;
    this.backgroundDispose?.();
    this.backgroundDispose = null;
    this.backgroundGain = null;
    if (!this.backgroundSound) return;
    const bed = createMagicForestBed(this.context);
    const gain = this.context.createGain();
    gain.gain.value = 0.14;
    bed.node.connect(gain);
    gain.connect(this.destination);
    this.backgroundGain = gain;
    this.backgroundDispose = bed.dispose;
  }

  private wireEffectOutput() {
    if (!this.context || !this.effectNodes || !this.analyser || !this.destination) return;
    const { output } = this.effectNodes;
    if (!this.outputGain) {
      this.outputGain = this.context.createGain();
      this.outputGain.gain.value = this.effectStrength;
    }
    output.connect(this.outputGain);
    this.outputGain.connect(this.analyser);
    this.outputGain.connect(this.destination);
    this.syncMonitorTap();
    this.syncBackgroundBed();
  }

  async start(effectId: VoiceChangerEffectId = 'original'): Promise<MediaStreamTrack> {
    await this.stop();
    this.effectId = resolveVoiceDspEffectId(effectId);

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

    const effectNodes = buildVoiceEffectNodes(context, this.effectId);
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

    const track = this.getOutputTrack();
    if (!track) {
      throw new Error('Voice changer produced no audio track');
    }
    return track;
  }

  setEffect(effectId: VoiceChangerEffectId) {
    if (!this.context || !this.source) return;
    const next = resolveVoiceDspEffectId(effectId);
    if (next === this.effectId) return;
    this.effectId = next;
    this.setEffectStrength(isOriginalVoiceEffect(next) ? 100 : this.effectStrength * 100);

    try {
      this.source.disconnect();
      this.effectNodes?.dispose?.();
      this.effectNodes?.output.disconnect();

      const effectNodes = buildVoiceEffectNodes(this.context, next);
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
    this.backgroundDispose?.();
    this.backgroundDispose = null;
    this.backgroundGain = null;
    if (this.monitorGain) {
      try {
        this.monitorGain.disconnect();
      } catch {
        /* ignore */
      }
      this.monitorGain = null;
    }
    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch {
        /* ignore */
      }
      this.outputGain = null;
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
