import type { YoutubeVideoSummary } from '../services/youtube';

export type YoutubeMiniPlayerState = {
  open: boolean;
  minimized: boolean;
  pickerOpen: boolean;
  videoId: string | null;
  /** Native YouTube playlist id (PL…) — player auto-advances within the list. */
  playlistId: string | null;
  /** App-managed queue for search picks / multi-select. */
  queue: YoutubeVideoSummary[];
  queueIndex: number;
  title: string;
  channelTitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const STORAGE_KEY = 'youtube-mini-player-v1';
const CHANGE_EVENT = 'youtube-mini-player:change';
const OPEN_PICKER_EVENT = 'youtube-mini-player:open-picker';

const DEFAULT_SIZE = { width: 380, height: 232 };

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 16, y: 96 };
  const safeBottom = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--app-safe-bottom') || '0',
  );
  const safeRight = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--app-safe-right') || '0',
  );
  return {
    x: Math.max(12, window.innerWidth - DEFAULT_SIZE.width - 12 - safeRight),
    y: Math.max(72, window.innerHeight - DEFAULT_SIZE.height - 88 - safeBottom),
  };
}

function createDefaultState(): YoutubeMiniPlayerState {
  const pos = defaultPosition();
  return {
    open: false,
    minimized: false,
    pickerOpen: false,
    videoId: null,
    playlistId: null,
    queue: [],
    queueIndex: 0,
    title: '',
    channelTitle: '',
    x: pos.x,
    y: pos.y,
    width: DEFAULT_SIZE.width,
    height: DEFAULT_SIZE.height,
  };
}

let memoryState: YoutubeMiniPlayerState = createDefaultState();

function readStoredState(): YoutubeMiniPlayerState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<YoutubeMiniPlayerState>;
    const base = createDefaultState();
    const queue = Array.isArray(parsed.queue)
      ? parsed.queue.filter(
          (item): item is YoutubeVideoSummary =>
            Boolean(item && typeof item.videoId === 'string' && item.videoId.length === 11),
        )
      : [];
    return {
      ...base,
      ...parsed,
      open: parsed.open === true,
      minimized: parsed.minimized === true,
      pickerOpen: false,
      videoId: typeof parsed.videoId === 'string' ? parsed.videoId : null,
      playlistId: typeof parsed.playlistId === 'string' ? parsed.playlistId : null,
      queue,
      queueIndex: Number.isFinite(parsed.queueIndex)
        ? Math.max(0, Math.min(Number(parsed.queueIndex), Math.max(0, queue.length - 1)))
        : 0,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      channelTitle: typeof parsed.channelTitle === 'string' ? parsed.channelTitle : '',
      width: Number.isFinite(parsed.width)
        ? Math.max(Number(parsed.width), DEFAULT_SIZE.width)
        : base.width,
      height: Number.isFinite(parsed.height)
        ? Math.max(Number(parsed.height), DEFAULT_SIZE.height)
        : base.height,
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : base.x,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : base.y,
    };
  } catch {
    return createDefaultState();
  }
}

function persistState(state: YoutubeMiniPlayerState): void {
  if (typeof window === 'undefined') return;
  try {
    const { pickerOpen: _picker, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}

function emitChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: memoryState }));
}

export function getYoutubeMiniPlayerState(): YoutubeMiniPlayerState {
  return memoryState;
}

export function patchYoutubeMiniPlayerState(
  patch: Partial<YoutubeMiniPlayerState>,
): YoutubeMiniPlayerState {
  memoryState = { ...memoryState, ...patch };
  persistState(memoryState);
  emitChange();
  return memoryState;
}

export function initYoutubeMiniPlayerState(): YoutubeMiniPlayerState {
  memoryState = readStoredState();
  return memoryState;
}

export function openYoutubeMiniPlayerPicker(): void {
  patchYoutubeMiniPlayerState({ pickerOpen: true });
  window.dispatchEvent(new CustomEvent(OPEN_PICKER_EVENT));
}

export function playYoutubeMiniVideo(
  video: YoutubeVideoSummary | { videoId: string; title?: string; channelTitle?: string; thumbnailUrl?: string },
  options?: { playlistId?: string | null; queue?: YoutubeVideoSummary[]; queueIndex?: number },
): void {
  const pos = memoryState.open ? { x: memoryState.x, y: memoryState.y } : defaultPosition();
  const queue =
    options?.queue && options.queue.length > 0
      ? options.queue
      : [
          {
            videoId: video.videoId,
            title: video.title || 'YouTube',
            channelTitle: video.channelTitle || '',
            thumbnailUrl:
              'thumbnailUrl' in video && video.thumbnailUrl
                ? video.thumbnailUrl
                : `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
          },
        ];
  const queueIndex = Math.max(
    0,
    Math.min(options?.queueIndex ?? 0, Math.max(0, queue.length - 1)),
  );
  const current = queue[queueIndex] ?? video;
  patchYoutubeMiniPlayerState({
    open: true,
    minimized: false,
    pickerOpen: false,
    videoId: current.videoId,
    playlistId: options?.playlistId ?? null,
    queue,
    queueIndex,
    title: current.title || 'YouTube',
    channelTitle: current.channelTitle || '',
    x: pos.x,
    y: pos.y,
  });
}

/** Advance to the next queued video. Returns false when nothing left to play. */
export function playYoutubeMiniNext(): boolean {
  const { queue, queueIndex, playlistId } = memoryState;
  // Native playlist auto-advances inside the iframe — don't force a reload.
  if (playlistId) return false;
  const nextIndex = queueIndex + 1;
  if (nextIndex >= queue.length) return false;
  const next = queue[nextIndex];
  if (!next) return false;
  patchYoutubeMiniPlayerState({
    open: true,
    videoId: next.videoId,
    queueIndex: nextIndex,
    title: next.title || 'YouTube',
    channelTitle: next.channelTitle || '',
  });
  return true;
}

export function toggleYoutubeMiniPlayerMinimized(): void {
  if (!memoryState.open || !memoryState.videoId) {
    openYoutubeMiniPlayerPicker();
    return;
  }
  patchYoutubeMiniPlayerState({ minimized: !memoryState.minimized, open: true });
}

export function closeYoutubeMiniPlayer(): void {
  patchYoutubeMiniPlayerState({
    open: false,
    minimized: false,
    pickerOpen: false,
    videoId: null,
    playlistId: null,
    queue: [],
    queueIndex: 0,
    title: '',
    channelTitle: '',
  });
}

export function subscribeYoutubeMiniPlayer(
  listener: (state: YoutubeMiniPlayerState) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<YoutubeMiniPlayerState>).detail ?? memoryState);
  };
  window.addEventListener(CHANGE_EVENT, handler);
  listener(memoryState);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

export function clampYoutubeMiniPlayerPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y };
  const pad = 8;
  const safeTop = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--app-safe-top') || '0',
  );
  const safeBottom = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--app-safe-bottom') || '0',
  );
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad + safeTop, window.innerHeight - height - pad - safeBottom);
  return {
    x: Math.min(maxX, Math.max(pad, x)),
    y: Math.min(maxY, Math.max(pad + safeTop, y)),
  };
}
