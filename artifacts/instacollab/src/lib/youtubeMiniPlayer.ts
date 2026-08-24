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

const DEFAULT_SIZE = { width: 380, height: 300 };

export function getYoutubeMiniPlayerDefaultSize(): { width: number; height: number } {
  return { ...DEFAULT_SIZE };
}

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
    playlistId:
      options?.queue && options.queue.length > 1
        ? null
        : options?.playlistId ?? null,
    queue,
    queueIndex,
    title: current.title || 'YouTube',
    channelTitle: current.channelTitle || '',
    width: DEFAULT_SIZE.width,
    height: DEFAULT_SIZE.height,
    x: pos.x,
    y: pos.y,
  });
  if (!current.title || current.title === 'YouTube' || current.title === 'YouTube video') {
    void import('../services/youtube').then(({ fetchYoutubeVideoDetails }) =>
      fetchYoutubeVideoDetails(current.videoId)
        .then((details) => {
          if (getYoutubeMiniPlayerState().videoId !== details.videoId) return;
          patchYoutubeMiniPlayerState({
            title: details.title || current.title,
            channelTitle: details.channelTitle || current.channelTitle || '',
          });
        })
        .catch(() => undefined),
    );
  }
}

/** Advance to the next queued video (loops the playlist/feed). Returns false only when empty. */
export function playYoutubeMiniNext(): boolean {
  const { queue, queueIndex } = memoryState;
  if (queue.length === 0) return false;
  // Prefer app queue over native playlist — keeps title/chrome in sync and works for search feeds.
  const nextIndex = queue.length === 1 ? 0 : (queueIndex + 1) % queue.length;
  const next = queue[nextIndex];
  if (!next) return false;
  // Same video (single-item loop) — force a remount so autoplay restarts.
  if (next.videoId === memoryState.videoId && queue.length === 1) {
    patchYoutubeMiniPlayerState({
      open: true,
      videoId: null,
      queueIndex: 0,
    });
    // Microtask so react-youtube unmounts before we set the same id again.
    queueMicrotask(() => {
      patchYoutubeMiniPlayerState({
        open: true,
        videoId: next.videoId,
        queueIndex: 0,
        title: next.title || 'YouTube',
        channelTitle: next.channelTitle || '',
        playlistId: null,
      });
    });
    return true;
  }
  patchYoutubeMiniPlayerState({
    open: true,
    videoId: next.videoId,
    queueIndex: nextIndex,
    title: next.title || 'YouTube',
    channelTitle: next.channelTitle || '',
    // App-managed queue owns advancement — drop native list so ENDED doesn't double-skip.
    playlistId: queue.length > 1 ? null : memoryState.playlistId,
  });
  return true;
}

/** Go to the previous queued video (wraps within the playlist/feed). */
export function playYoutubeMiniPrev(): boolean {
  const { queue, queueIndex } = memoryState;
  if (queue.length === 0) return false;
  const prevIndex = queue.length === 1 ? 0 : (queueIndex - 1 + queue.length) % queue.length;
  const prev = queue[prevIndex];
  if (!prev) return false;
  patchYoutubeMiniPlayerState({
    open: true,
    videoId: prev.videoId,
    queueIndex: prevIndex,
    title: prev.title || 'YouTube',
    channelTitle: prev.channelTitle || '',
    playlistId: queue.length > 1 ? null : memoryState.playlistId,
  });
  return true;
}

export function toggleYoutubeMiniPlayerMinimized(): void {
  if (!memoryState.open || !memoryState.videoId) {
    openYoutubeMiniPlayerPicker();
    return;
  }
  const nextMinimized = !memoryState.minimized;
  patchYoutubeMiniPlayerState({
    minimized: nextMinimized,
    open: true,
    ...(nextMinimized
      ? {}
      : { width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height }),
  });
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
