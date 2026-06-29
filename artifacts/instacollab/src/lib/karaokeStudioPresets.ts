import { pitchDeltaLane } from './karaokePitchDetection';

export type VoicePresetName =
  | 'Studio'
  | 'KTV'
  | 'Pop'
  | 'R&B'
  | 'Concert'
  | 'Phonograph'
  | 'Auto-Tune'
  | 'Monster';

export type VoicePresetDefinition = {
  filter: string;
  reverb: number;
  noise: number;
  presence: number;
  autoTune: number;
  pitchShift?: number;
};

export const VOICE_PRESET_DEFINITIONS: Record<VoicePresetName, VoicePresetDefinition> = {
  Studio: { filter: 'Studio Room', reverb: 30, noise: 50, presence: 62, autoTune: 45 },
  KTV: { filter: 'Concert Echo', reverb: 55, noise: 45, presence: 55, autoTune: 35 },
  Pop: { filter: 'Perfect Dry', reverb: 18, noise: 55, presence: 78, autoTune: 50 },
  'R&B': { filter: 'Chamber Reverb', reverb: 62, noise: 48, presence: 58, autoTune: 40 },
  Concert: { filter: 'Large Cathedral', reverb: 78, noise: 40, presence: 65, autoTune: 30 },
  Phonograph: { filter: 'Phonograph 1920', reverb: 22, noise: 35, presence: 42, autoTune: 25 },
  'Auto-Tune': { filter: 'Perfect Dry', reverb: 15, noise: 65, presence: 70, autoTune: 95 },
  Monster: { filter: 'Studio Room', reverb: 35, noise: 50, presence: 38, autoTune: 20, pitchShift: -6 },
};

export const VIDEO_BEAUTY_FILTERS: Record<string, string> = {
  None: 'none',
  Smooth: 'blur(0.35px) contrast(1.04) brightness(1.08) saturate(1.05)',
  Vintage: 'sepia(0.4) contrast(1.12) brightness(0.95)',
  Anime: 'saturate(1.45) contrast(1.15) brightness(1.06)',
  Cyberpunk: 'hue-rotate(18deg) saturate(1.6) contrast(1.2) brightness(1.05)',
  'B&W': 'grayscale(1) contrast(1.1)',
};

export const VIDEO_BACKGROUNDS: Record<string, string> = {
  'Concert Stage': 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=7680&auto=format&fit=crop&q=92',
  'Neon City': 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=7680&auto=format&fit=crop&q=92',
  'Recording Studio': 'https://images.unsplash.com/photo-1598488035139-bdbb2231bb04?w=7680&auto=format&fit=crop&q=92',
  Galaxy: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=7680&auto=format&fit=crop&q=92',
  'Sunset Beach': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=7680&auto=format&fit=crop&q=92',
};

/** Lighter URL for sidebar picker thumbnails (full-res URLs stay on the main stage). */
export function backgroundPickerThumbUrl(fullUrl: string): string {
  if (!fullUrl || fullUrl.startsWith('blob:') || fullUrl.startsWith('data:')) return fullUrl;
  try {
    const u = new URL(fullUrl);
    u.searchParams.set('w', '512');
    u.searchParams.set('q', '80');
    return u.toString();
  } catch {
    return fullUrl;
  }
}

/** Sentinel key for a user-uploaded image background (URL stored separately). */
export const CUSTOM_VIDEO_BACKGROUND = 'Custom Upload';

export type AiVocalMetrics = {
  pitchAccuracy: number;
  rhythmTiming: number;
  voiceClarity: number;
};

export type AiSuggestion = {
  icon: string;
  title: string;
  text: string;
};

export function computeLiveVocalMetrics(
  micPitch: number,
  micVolume: number,
  playbackSec: number,
  isPlaying: boolean,
  isTrackLocked: boolean,
  noiseReduction: number,
  activeSpike: { pitch: number; start: number; end: number } | null | undefined,
): AiVocalMetrics {
  if (!isPlaying) {
    return { pitchAccuracy: 0, rhythmTiming: 0, voiceClarity: 0 };
  }

  let pitchAccuracy = 0;
  if (micVolume > 8 && activeSpike) {
    const delta = pitchDeltaLane(micPitch, activeSpike.pitch);
    pitchAccuracy = Math.round(Math.max(0, Math.min(100, 100 - delta * 2.8)));
    if (isTrackLocked) pitchAccuracy = Math.min(100, pitchAccuracy + 8);
  } else if (micVolume > 8) {
    pitchAccuracy = 55;
  }

  let rhythmTiming = 0;
  if (activeSpike && micVolume > 6) {
    const span = Math.max(0.05, activeSpike.end - activeSpike.start);
    const elapsed = playbackSec - activeSpike.start;
    const center = span * 0.35;
    const drift = Math.abs(elapsed - center) / span;
    rhythmTiming = Math.round(Math.max(0, Math.min(100, 100 - drift * 120)));
    if (isTrackLocked) rhythmTiming = Math.min(100, rhythmTiming + 6);
  } else if (isPlaying) {
    rhythmTiming = 62;
  }

  const sweetSpot = micVolume >= 18 && micVolume <= 72;
  const volumeScore = sweetSpot
    ? 88
    : Math.max(30, 100 - Math.abs(micVolume - 45) * 1.4);
  const voiceClarity = Math.round(
    Math.max(0, Math.min(100, volumeScore * 0.55 + noiseReduction * 0.45)),
  );

  return { pitchAccuracy, rhythmTiming, voiceClarity };
}

export function buildAiSuggestions(metrics: AiVocalMetrics, autoTuneStrength: number): AiSuggestion[] {
  const suggestions: AiSuggestion[] = [];

  if (metrics.pitchAccuracy < 78) {
    suggestions.push({
      icon: '🎵',
      title: 'Pitch',
      text:
        autoTuneStrength < 60
          ? 'Try raising Pitch Correction or pick the Auto-Tune preset for tighter note tracking.'
          : 'Focus on landing each word spike — sing slightly ahead of the beat as it approaches the playhead.',
    });
  }

  if (metrics.rhythmTiming < 80) {
    suggestions.push({
      icon: '⏱️',
      title: 'Timing',
      text: 'Use Vocal Timing Sync in Mix if vocals feel late, and watch the word bars as they reach the left playhead.',
    });
  }

  if (metrics.voiceClarity < 72) {
    suggestions.push({
      icon: '🎤',
      title: 'Clarity',
      text: 'Move closer to the mic, reduce room noise, or increase Noise Reduction (AI) in Effects.',
    });
  }

  if (metrics.pitchAccuracy >= 85 && metrics.rhythmTiming >= 85) {
    suggestions.push({
      icon: '✨',
      title: 'Tone',
      text: 'Great pitch and timing — experiment with Concert or R&B presets to shape your vocal character.',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      icon: '🎤',
      title: 'Breathing',
      text: 'Take deeper breaths before long phrases so you can sustain notes through the chorus.',
    });
  }

  return suggestions.slice(0, 3);
}

export function applyStudioFilterToEq(
  eq: BiquadFilterNode,
  feedback: GainNode | null,
  filterName: string,
  vocalPresence: number,
  reverbValue: number,
  isMonster: boolean,
  ctx: AudioContext,
) {
  const t = ctx.currentTime;
  if (isMonster) {
    eq.type = 'lowshelf';
    eq.frequency.setValueAtTime(220, t);
    eq.gain.setValueAtTime(10, t);
    if (feedback) feedback.gain.setValueAtTime(reverbValue / 220, t);
    return;
  }

  if (filterName === 'Phonograph 1920') {
    eq.type = 'bandpass';
    eq.frequency.setValueAtTime(1000, t);
    eq.gain.setValueAtTime(0, t);
    if (feedback) feedback.gain.setValueAtTime(reverbValue / 260, t);
  } else if (filterName === 'Large Cathedral') {
    eq.type = 'highshelf';
    eq.frequency.setValueAtTime(1500, t);
    eq.gain.setValueAtTime(12, t);
    if (feedback) feedback.gain.setValueAtTime(0.65, t);
  } else if (filterName === 'Concert Echo') {
    eq.type = 'highshelf';
    eq.frequency.setValueAtTime(2500, t);
    eq.gain.setValueAtTime(5, t);
    if (feedback) feedback.gain.setValueAtTime(0.55, t);
  } else {
    eq.type = 'highshelf';
    eq.frequency.setValueAtTime(3500, t);
    eq.gain.setValueAtTime((vocalPresence - 50) / 4, t);
    if (feedback) feedback.gain.setValueAtTime(reverbValue / 220, t);
  }
}
