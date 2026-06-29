export const VOICE_CHANGER_EFFECTS = [
  { id: 'studio', label: 'Studio', emoji: '🎙️' },
  { id: 'hall', label: 'Concert Hall', emoji: '🏛️' },
  { id: 'warm', label: 'Warm', emoji: '🔥' },
  { id: 'robot', label: 'Robot', emoji: '🤖' },
  { id: 'chipmunk', label: 'Chipmunk', emoji: '🐿️' },
  { id: 'deep', label: 'Deep Voice', emoji: '🎸' },
] as const;

export type VoiceChangerEffectId = (typeof VOICE_CHANGER_EFFECTS)[number]['id'];

export function getVoiceChangerEffect(id: VoiceChangerEffectId) {
  return VOICE_CHANGER_EFFECTS.find((effect) => effect.id === id) ?? VOICE_CHANGER_EFFECTS[0];
}
