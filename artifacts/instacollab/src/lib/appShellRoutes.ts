import type { SearchTab } from '../components/search/SearchScreen';
import type { Tab } from '../types';

const SEARCH_TABS = new Set<SearchTab>(['top', 'accounts', 'audio', 'tags', 'places']);

export type AppShellState = {
  currentTab: Tab;
  profileUserId: string | null;
  initialChatId: string | null;
  initialSearchContext: { query?: string; tab?: SearchTab } | null;
  roomsInitialPath: string;
};

const KARAOKE_URL_KEYS = ['tab', 'profileTab', 'user', 'track', 'recording'] as const;
const LEGACY_QUERY_KEYS = [
  'appTab',
  'profileUserId',
  'chatId',
  'searchQuery',
  'searchTab',
  'roomsPath',
] as const;

export { KARAOKE_URL_KEYS };

/** Default pathname for each main tab (rooms uses `roomsInitialPath`). */
export const TAB_PATH: Record<Tab, string> = {
  home: '/home',
  search: '/explore',
  reels: '/reels',
  messages: '/messages',
  notifications: '/notifications',
  workspace: '/workspace',
  dating: '/dating',
  profile: '/profile',
  live: '/live',
  karaoke: '/karaoke',
  rooms: '/party',
  'local-games': '/games',
  'third-party-games': '/games/web',
  wallet: '/wallet',
};

const STATIC_PATH_TAB: Record<string, Tab> = {
  '/': 'home',
  '/home': 'home',
  '/explore': 'search',
  '/search': 'search',
  '/discover': 'search',
  '/reels': 'reels',
  '/messages': 'messages',
  '/notifications': 'notifications',
  '/workspace': 'workspace',
  '/dating': 'dating',
  '/profile': 'profile',
  '/live': 'live',
  '/karaoke': 'karaoke',
  '/party': 'rooms',
  '/games': 'local-games',
  '/games/web': 'third-party-games',
  '/wallet': 'wallet',
};

export function appBasePath(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function stripAppBasePath(pathname: string): string {
  const base = appBasePath();
  if (base && pathname.startsWith(base)) {
    const rest = pathname.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname;
}

function normalizePath(pathname: string): string {
  const stripped = stripAppBasePath(pathname);
  const trimmed = stripped.replace(/\/+$/, '');
  if (!trimmed || trimmed === '/index.html') return '/';
  return trimmed;
}

function emptyShellDefaults(): Omit<AppShellState, 'currentTab'> {
  return {
    profileUserId: null,
    initialChatId: null,
    initialSearchContext: null,
    roomsInitialPath: '/party',
  };
}

function parseSearchContext(params: URLSearchParams): AppShellState['initialSearchContext'] {
  const query = params.get('q') ?? params.get('searchQuery') ?? undefined;
  const rawTab = params.get('tab') ?? params.get('searchTab');
  const tab =
    rawTab && SEARCH_TABS.has(rawTab as SearchTab) ? (rawTab as SearchTab) : undefined;
  if (!query && !tab) return null;
  return { query, tab };
}

function isRoomShellPath(path: string): boolean {
  return path === '/party' || path.startsWith('/room');
}

/** Parse the browser location into shell state (path-first). */
export function parseAppShellLocation(
  pathname: string,
  search = '',
): AppShellState | null {
  const path = normalizePath(pathname);
  const params = new URLSearchParams(search);
  const defaults = emptyShellDefaults();

  if (isRoomShellPath(path)) {
    return {
      currentTab: 'rooms',
      ...defaults,
      roomsInitialPath: path,
    };
  }

  const profileMatch = path.match(/^\/profile\/([^/]+)$/);
  if (profileMatch) {
    return {
      currentTab: 'profile',
      ...defaults,
      profileUserId: decodeURIComponent(profileMatch[1]),
    };
  }

  const messagesMatch = path.match(/^\/messages\/([^/]+)$/);
  if (messagesMatch) {
    return {
      currentTab: 'messages',
      ...defaults,
      initialChatId: decodeURIComponent(messagesMatch[1]),
    };
  }

  const tab = STATIC_PATH_TAB[path];
  if (!tab) return null;

  return {
    currentTab: tab,
    ...defaults,
    initialSearchContext: tab === 'search' ? parseSearchContext(params) : null,
    roomsInitialPath: tab === 'rooms' ? path : '/party',
  };
}

/** Build a clean pathname + search string for the current shell state. */
export function buildAppShellLocation(state: AppShellState): {
  pathname: string;
  search: string;
} {
  let pathname: string;

  switch (state.currentTab) {
    case 'profile':
      pathname = state.profileUserId
        ? `/profile/${encodeURIComponent(state.profileUserId)}`
        : '/profile';
      break;
    case 'messages':
      pathname = state.initialChatId
        ? `/messages/${encodeURIComponent(state.initialChatId)}`
        : '/messages';
      break;
    case 'rooms':
      pathname = state.roomsInitialPath || '/party';
      break;
    default:
      pathname = TAB_PATH[state.currentTab];
  }

  const params = new URLSearchParams();
  if (state.currentTab === 'search' && state.initialSearchContext) {
    if (state.initialSearchContext.query) {
      params.set('q', state.initialSearchContext.query);
    }
    if (state.initialSearchContext.tab) {
      params.set('tab', state.initialSearchContext.tab);
    }
  }

  const search = params.toString();
  return { pathname, search: search ? `?${search}` : '' };
}

export function buildAppShellHref(state: AppShellState, origin?: string): string {
  const { pathname, search } = buildAppShellLocation(state);
  const base = appBasePath();
  const path = `${base}${pathname}${search}`;
  if (origin) return `${origin.replace(/\/$/, '')}${path}`;
  return path;
}

/** Strip legacy + cross-tab query noise when syncing the address bar. */
export function pruneAppShellSearchParams(
  params: URLSearchParams,
  state: AppShellState,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const key of LEGACY_QUERY_KEYS) {
    next.delete(key);
  }
  if (state.currentTab !== 'karaoke') {
    for (const key of KARAOKE_URL_KEYS) {
      next.delete(key);
    }
  }
  if (state.currentTab !== 'search') {
    next.delete('q');
    // `tab` is explore sub-tab only; karaoke also uses `tab` — handled above.
    if (state.currentTab !== 'karaoke') {
      next.delete('tab');
    }
  } else {
    // Explore uses `q` + `tab`; drop legacy names.
    next.delete('searchQuery');
    next.delete('searchTab');
    const q = state.initialSearchContext?.query;
    const tab = state.initialSearchContext?.tab;
    if (q) next.set('q', q);
    else next.delete('q');
    if (tab) next.set('tab', tab);
    else next.delete('tab');
  }
  return next;
}
