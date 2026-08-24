import type { SingingVoiceStatus } from '../hooks/useSingingSession';
import { getVoiceChangerEffect, type VoiceChangerEffectId } from './voiceEffects';

export function voiceStatusLabel(status: SingingVoiceStatus): string {
  if (status === 'strong') return 'Power vocals';
  if (status === 'good') return 'On pitch';
  if (status === 'warming') return 'Warming up';
  return 'Waiting for mic…';
}

export function resolveDisplayVoiceStatus(
  enabled: boolean,
  micLevel: number,
  isVoiceActive: boolean,
): SingingVoiceStatus {
  if (!enabled) return 'silent';
  if (!isVoiceActive && micLevel <= 12) return 'silent';
  if (micLevel <= 5) return 'silent';
  if (micLevel <= 25) return 'warming';
  if (micLevel <= 70) return 'good';
  return 'strong';
}

export function formatSingingStatusLine(
  voiceEffect: VoiceChangerEffectId,
  voiceStatus: SingingVoiceStatus,
): string {
  const effect = getVoiceChangerEffect(voiceEffect);
  const icon = effect.emoji ?? '🎙️';
  if (voiceStatus === 'silent') {
    return `${icon} ${effect.label}`;
  }
  return `${icon} ${effect.label} · ${voiceStatusLabel(voiceStatus)}`;
}
