import type { SearchTab } from '../components/search/SearchScreen';
import type { RoomFlowEntry } from '../smule-rooms/context/RoomFlowContext';
import type { Tab } from '../types';
import {
  appBasePath,
  buildAppShellLocation,
  KARAOKE_URL_KEYS,
  parseAppShellLocation,
  pruneAppShellSearchParams,
  type AppShellState,
} from './appShellRoutes';

const SHELL_KEY = 'instacollab_shell_v1';
const KARAOKE_ROOM_KEY = 'instacollab_karaoke_room_v1';
export const NAV_PERSIST_EVENT = 'app-persist-navigation';

export type PersistedShellState = AppShellState;

export type PersistedKaraokeRoomFlow = {
  showSmuleRoomFlow: boolean;
  smuleRoomInitialPath: string;
  smuleRoomFlowEntry: RoomFlowEntry;
};

const MAIN_TABS = new Set<Tab>([
  'home',
  'search',
  'reels',
  'messages',
  'notifications',
  'workspace',
  'dating',
  'profile',
  'live',
  'karaoke',
  'rooms',
  'local-games',
  'third-party-games',
  'wallet',
]);

const SEARCH_TABS = new Set<SearchTab>(['top', 'accounts', 'audio', 'tags', 'places']);

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function readShellStateFromUrl(): PersistedShellState | null {
  if (typeof window === 'undefined') return null;

  const fromPath = parseAppShellLocation(window.location.pathname, window.location.search);
  if (fromPath) return fromPath;

  /** Legacy `?appTab=home` links (pre path-based routing). */
  const params = new URLSearchParams(window.location.search);
  const appTab = params.get('appTab');
  if (!appTab || !MAIN_TABS.has(appTab as Tab)) return null;

  const searchTab = params.get('searchTab');
  const searchQuery = params.get('searchQuery') ?? undefined;

  return {
    currentTab: appTab as Tab,
    profileUserId: params.get('profileUserId') || null,
    initialChatId: params.get('chatId') || null,
    initialSearchContext:
      searchQuery || (searchTab && SEARCH_TABS.has(searchTab as SearchTab))
        ? {
            query: searchQuery,
            tab: searchTab && SEARCH_TABS.has(searchTab as SearchTab) ? (searchTab as SearchTab) : undefined,
          }
        : null,
    roomsInitialPath: params.get('roomsPath') || '/party',
  };
}

export function syncAppShellUrl(state: PersistedShellState, mode: 'replace' | 'push' = 'replace'): void {
  if (typeof window === 'undefined') return;

  const existingParams = new URLSearchParams(window.location.search);
  const { pathname, search } = buildAppShellLocation(state);
  const base = appBasePath();
  const url = new URL(window.location.href);
  url.pathname = `${base}${pathname}`;
  url.search = search;

  if (state.currentTab === 'karaoke') {
    for (const key of KARAOKE_URL_KEYS) {
      const value = existingParams.get(key);
      if (value) url.searchParams.set(key, value);
    }
  }

  const merged = pruneAppShellSearchParams(url.searchParams, state);
  url.search = merged.toString() ? `?${merged.toString()}` : '';

  const next = url.toString();
  if (mode === 'push') {
    window.history.pushState({ appShell: true }, '', next);
  } else {
    window.history.replaceState(window.history.state, '', next);
  }
}

export function readPersistedShellState(): PersistedShellState | null {
  const parsed = readJson<PersistedShellState>(SHELL_KEY);
  if (!parsed || !MAIN_TABS.has(parsed.currentTab)) return null;
  return {
    currentTab: parsed.currentTab,
    profileUserId: parsed.profileUserId ?? null,
    initialChatId: parsed.initialChatId ?? null,
    initialSearchContext: parsed.initialSearchContext ?? null,
    roomsInitialPath: parsed.roomsInitialPath || '/party',
  };
}

export function writePersistedShellState(state: PersistedShellState): void {
  writeJson(SHELL_KEY, state);
  syncAppShellUrl(state);
}

export function readInitialShellState(): PersistedShellState {
  return (
    readShellStateFromUrl() ??
    readPersistedShellState() ?? {
      currentTab: 'home',
      profileUserId: null,
      initialChatId: null,
      initialSearchContext: null,
      roomsInitialPath: '/party',
    }
  );
}

export function readPersistedKaraokeRoomFlow(): PersistedKaraokeRoomFlow | null {
  const parsed = readJson<PersistedKaraokeRoomFlow>(KARAOKE_ROOM_KEY);
  if (!parsed) return null;
  return {
    showSmuleRoomFlow: Boolean(parsed.showSmuleRoomFlow),
    smuleRoomInitialPath: parsed.smuleRoomInitialPath || '/room/create',
    smuleRoomFlowEntry: parsed.smuleRoomFlowEntry || 'default',
  };
}

export function writePersistedKaraokeRoomFlow(state: PersistedKaraokeRoomFlow): void {
  writeJson(KARAOKE_ROOM_KEY, state);
}

export function clearPersistedKaraokeRoomFlow(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KARAOKE_ROOM_KEY);
  } catch {
    // ignore
  }
}

/** Flush navigation snapshot before a production soft-reload. */
export function requestNavigationPersist(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NAV_PERSIST_EVENT));
}
