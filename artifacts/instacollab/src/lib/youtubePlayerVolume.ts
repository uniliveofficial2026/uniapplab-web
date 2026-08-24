/**
 * Persisted YouTube iframe volume — stable across video changes, remounts, and mini-player queue skips.
 */
const STORAGE_KEY = 'youtube-player-volume-v1';

export type YoutubePlayerVolumePrefs = {
  volume: number;
  muted: boolean;
};

const DEFAULT_PREFS: YoutubePlayerVolumePrefs = { volume: 100, muted: false };

export type YoutubeIframePlayer = {
  setVolume?: (volume: number) => void;
  getVolume?: () => number;
  mute?: () => void;
  unMute?: () => void;
  isMuted?: () => boolean;
  getPlayerState?: () => number;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  getAvailableQualityLevels?: () => string[];
  getPlaybackQuality?: () => string;
  setPlaybackQuality?: (quality: string) => void;
  getPlaylist?: () => string[];
  getPlaylistIndex?: () => number;
  nextVideo?: () => void;
  playVideoAt?: (index: number) => void;
};

export function youtubeIframeOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function youtubeIframePlayerVars(
  overrides: Record<string, string | number | undefined> = {},
): Record<string, string | number | undefined> {
  const origin = youtubeIframeOrigin();
  return {
    ...YOUTUBE_PLAYER_VARS,
    origin: origin || undefined,
    widget_referrer: origin || undefined,
    fs: 1,
    controls: 1,
    iv_load_policy: 3,
    ...overrides,
  };
}

/** After muted autoplay is PLAYING, restore the user's saved mute preference. */
export function resumeYoutubePlaybackAfterAutoplay(player: YoutubeIframePlayer): void {
  const prefs = readYoutubePlayerVolume();
  try {
    player.setVolume?.(prefs.volume);
    if (prefs.muted) player.mute?.();
    else player.unMute?.();
    player.playVideo?.();
  } catch {
    /* autoplay / not ready */
  }
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFS.volume;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function readYoutubePlayerVolume(): YoutubePlayerVolumePrefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<YoutubePlayerVolumePrefs>;
    return {
      volume: clampVolume(Number(parsed.volume)),
      muted: parsed.muted === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writeYoutubePlayerVolume(prefs: YoutubePlayerVolumePrefs): void {
  if (typeof localStorage === 'undefined') return;
  const normalized: YoutubePlayerVolumePrefs = {
    volume: clampVolume(prefs.volume),
    muted: prefs.muted === true,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore quota */
  }
}

/** Apply saved volume. Autoplay starts muted — browsers block unmuted autoplay. */
export function applyYoutubePlayerVolume(player: YoutubeIframePlayer): void {
  const prefs = readYoutubePlayerVolume();
  try {
    player.setVolume?.(prefs.volume);
    player.mute?.();
  } catch {
    /* player not ready */
  }
}

/** Save volume when the user adjusts it inside the YouTube iframe controls. */
export function captureYoutubePlayerVolume(player: YoutubeIframePlayer): void {
  try {
    const volume = player.getVolume?.();
    const muted = player.isMuted?.();
    if (typeof volume !== 'number' || !Number.isFinite(volume)) return;
    writeYoutubePlayerVolume({
      volume: clampVolume(volume),
      muted: muted === true,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Keep playback at the saved level — re-applies after ducking/remount/state changes.
 * Captures in-iframe user adjustments while paused so live ducking is not mistaken for intent.
 */
export function stabilizeYoutubePlayerVolume(player: YoutubeIframePlayer): void {
  try {
    const stored = readYoutubePlayerVolume();
    const liveVolume = player.getVolume?.();
    const liveMuted = player.isMuted?.();
    const playerState = player.getPlayerState?.();

    if (typeof liveMuted === 'boolean' && liveMuted !== stored.muted) {
      captureYoutubePlayerVolume(player);
    } else if (playerState === 2 && typeof liveVolume === 'number' && Number.isFinite(liveVolume)) {
      const volumeDrift = Math.abs(liveVolume - stored.volume);
      if (volumeDrift >= 3) {
        captureYoutubePlayerVolume(player);
      }
    }
    const prefs = readYoutubePlayerVolume();
    player.setVolume?.(prefs.volume);
  } catch {
    /* ignore read errors */
  }
}

export const YOUTUBE_PLAYER_VARS = {
  autoplay: 1,
  mute: 1,
  modestbranding: 1,
  rel: 0,
  playsinline: 1,
  enablejsapi: 1,
} as const;
