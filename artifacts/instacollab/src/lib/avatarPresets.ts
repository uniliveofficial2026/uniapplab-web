/** Shared DiceBear avatar seeds used in app + karaoke profile settings. */
export const AVATAR_QUICK_PRESET_SEEDS = [
  'vocal',
  'melody',
  'rhythm',
  'superstar',
  'diva',
  'artist',
  'legend',
  'wave',
] as const;

export type AvatarQuickPresetSeed = (typeof AVATAR_QUICK_PRESET_SEEDS)[number];

export function avatarPresetUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed.trim())}`;
}

export function avatarPresetSeedFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('dicebear.com')) return null;
    const seed = parsed.searchParams.get('seed');
    return seed?.trim() || null;
  } catch {
    const match = String(url).match(/[?&]seed=([^&]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}
