export type VoiceChangerCategory =
  | 'all'
  | 'popular'
  | 'character'
  | 'funny'
  | 'robot'
  | 'fantasy'
  | 'special';

export type VoiceChangerEffectId =
  | 'original'
  | 'studio'
  | 'hall'
  | 'warm'
  | 'radio'
  | 'robot'
  | 'chipmunk'
  | 'deep'
  | 'sweet-girl'
  | 'baby'
  | 'lolita'
  | 'young-boy'
  | 'elder'
  | 'helium'
  | 'monster'
  | 'alien'
  | 'devil'
  | 'ghost'
  | 'cave'
  | 'telephone'
  | 'megaphone';

export type VoiceChangerCatalogEntry = {
  id: VoiceChangerEffectId;
  label: string;
  category: Exclude<VoiceChangerCategory, 'all'>;
  /** When false, shown disabled — no DSP wired. */
  supported: boolean;
  artwork: string;
  emoji?: string;
};

const E = (entry: VoiceChangerCatalogEntry & { emoji?: string }): VoiceChangerCatalogEntry => ({
  emoji: '🎤',
  ...entry,
});

/** Approved V14 voice grid — every visible preset has a real DSP graph (Original = bypass). */
export const VOICE_CHANGER_CATALOG: VoiceChangerCatalogEntry[] = [
  E({ id: 'original', label: 'Original', category: 'popular', supported: true, artwork: '/live-tools-v14/voices/voice-01.png', emoji: '🎙️' }),
  E({ id: 'sweet-girl', label: 'Sweet Girl', category: 'character', supported: true, artwork: '/live-tools-v14/voices/voice-02.png', emoji: '👧' }),
  E({ id: 'deep', label: 'Deep Male', category: 'character', supported: true, artwork: '/live-tools-v14/voices/voice-03.png', emoji: '🎸' }),
  E({ id: 'baby', label: 'Baby', category: 'funny', supported: true, artwork: '/live-tools-v14/voices/voice-04.png', emoji: '👶' }),
  E({ id: 'lolita', label: 'Lolita', category: 'character', supported: true, artwork: '/live-tools-v14/voices/voice-05.png', emoji: '🎀' }),
  E({ id: 'young-boy', label: 'Young Boy', category: 'character', supported: true, artwork: '/live-tools-v14/voices/voice-06.png', emoji: '👦' }),
  E({ id: 'elder', label: 'Elder', category: 'character', supported: true, artwork: '/live-tools-v14/voices/voice-07.png', emoji: '👴' }),
  E({ id: 'helium', label: 'Helium', category: 'funny', supported: true, artwork: '/live-tools-v14/voices/voice-08.png', emoji: '🎈' }),
  E({ id: 'chipmunk', label: 'Chipmunk', category: 'funny', supported: true, artwork: '/live-tools-v14/voices/voice-09.png', emoji: '🐿️' }),
  E({ id: 'monster', label: 'Monster', category: 'fantasy', supported: true, artwork: '/live-tools-v14/voices/voice-10.png', emoji: '👾' }),
  E({ id: 'robot', label: 'Robot', category: 'robot', supported: true, artwork: '/live-tools-v14/voices/voice-11.png', emoji: '🤖' }),
  E({ id: 'alien', label: 'Alien', category: 'fantasy', supported: true, artwork: '/live-tools-v14/voices/voice-12.png', emoji: '👽' }),
  E({ id: 'devil', label: 'Devil', category: 'fantasy', supported: true, artwork: '/live-tools-v14/voices/voice-13.png', emoji: '😈' }),
  E({ id: 'ghost', label: 'Ghost', category: 'fantasy', supported: true, artwork: '/live-tools-v14/voices/voice-14.png', emoji: '👻' }),
  E({ id: 'cave', label: 'Cave', category: 'special', supported: true, artwork: '/live-tools-v14/voices/voice-15.png', emoji: '🕳️' }),
  E({ id: 'radio', label: 'Radio', category: 'special', supported: true, artwork: '/live-tools-v14/voices/voice-16.png', emoji: '📻' }),
  E({ id: 'telephone', label: 'Telephone', category: 'special', supported: true, artwork: '/live-tools-v14/voices/voice-17.png', emoji: '☎️' }),
  E({ id: 'megaphone', label: 'Megaphone', category: 'special', supported: true, artwork: '/live-tools-v14/voices/voice-18.png', emoji: '📣' }),
  E({ id: 'studio', label: 'Original', category: 'popular', supported: true, artwork: '/live-tools-v14/voices/voice-01.png', emoji: '🎙️' }),
  E({ id: 'hall', label: 'Cave', category: 'special', supported: true, artwork: '/live-tools-v14/voices/voice-15.png', emoji: '👻' }),
  E({ id: 'warm', label: 'Radio', category: 'special', supported: true, artwork: '/live-tools-v14/voices/voice-16.png', emoji: '📻' }),
];

/** Legacy export — real DSP effects only. */
export const VOICE_CHANGER_EFFECTS = VOICE_CHANGER_CATALOG.filter((e) => e.supported).map((e) => ({
  id: e.id,
  label: e.label,
  emoji: '',
  category: e.category,
}));

export type VoiceChangerEffectIdLegacy = VoiceChangerEffectId;

export const VOICE_CHANGER_CATEGORIES: Array<{ id: VoiceChangerCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'popular', label: 'Popular' },
  { id: 'character', label: 'Character' },
  { id: 'funny', label: 'Funny' },
  { id: 'robot', label: 'Robot' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'special', label: 'Special' },
];

export function isOriginalVoiceEffect(id: VoiceChangerEffectId | string | null | undefined): boolean {
  return id === 'original' || id === 'studio';
}

export function getVoiceChangerEffect(id: VoiceChangerEffectId) {
  return VOICE_CHANGER_CATALOG.find((effect) => effect.id === id) ?? VOICE_CHANGER_CATALOG[0];
}

export function filterVoiceEffectsByCategory(category: VoiceChangerCategory) {
  const visible = VOICE_CHANGER_CATALOG.filter((e) => e.id !== 'studio' && e.id !== 'hall' && e.id !== 'warm');
  if (category === 'all') return visible;
  return visible.filter((e) => e.category === category || (category === 'popular' && isOriginalVoiceEffect(e.id)));
}

export function isVoiceEffectSupported(id: VoiceChangerEffectId): boolean {
  return getVoiceChangerEffect(id).supported;
}

/** Map UI / legacy ids onto the DSP graph id. Original/studio is true bypass. */
export function resolveVoiceDspEffectId(id: VoiceChangerEffectId): VoiceChangerEffectId {
  if (id === 'studio') return 'original';
  if (id === 'hall') return 'cave';
  if (id === 'warm') return 'radio';
  return id;
}
