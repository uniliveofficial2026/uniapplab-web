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
};

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

/** Apply saved volume/mute to a YouTube iframe player instance. */
export function applyYoutubePlayerVolume(player: YoutubeIframePlayer): void {
  const prefs = readYoutubePlayerVolume();
  try {
    if (prefs.muted) {
      player.mute?.();
      return;
    }
    player.unMute?.();
    player.setVolume?.(prefs.volume);
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
  } catch {
    /* ignore read errors */
  }

  applyYoutubePlayerVolume(player);
}

export const YOUTUBE_PLAYER_VARS = {
  autoplay: 1,
  modestbranding: 1,
  rel: 0,
  playsinline: 1,
  enablejsapi: 1,
} as const;
