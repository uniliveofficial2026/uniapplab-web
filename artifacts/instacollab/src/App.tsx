/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { lazyWithRetry as lazy } from './lib/lazyWithRetry';
import { consumePendingAppProfileUserId } from './lib/profileIdentity';
import { appTabBackLabel } from './lib/karaokeReturnContext';
import { Shell } from './components/layout/Shell';
import type { SearchTab } from './components/search/SearchScreen';
import { ScreenGuard } from './components/common/ScreenGuard';
import { KeepAliveTab } from './components/common/KeepAliveTab';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Default home tab — eager so first paint is instant.
import { Feed } from './components/feed/Feed';

const MessagesScreen = lazy(() =>
  import('./components/messages/MessagesScreen').then((m) => ({ default: m.MessagesScreen }))
);
const NotificationsScreen = lazy(() =>
  import('./components/notifications/NotificationsScreen').then((m) => ({
    default: m.NotificationsScreen,
  }))
);
const ReelsScreen = lazy(() =>
  import('./components/reels/ReelsScreen').then((m) => ({ default: m.ReelsScreen }))
);
const SearchScreen = lazy(() =>
  import('./components/search/SearchScreen').then((m) => ({ default: m.SearchScreen }))
);
const ProfileScreen = lazy(() =>
  import('./components/profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);

const WorkspaceGate = lazy(() => import('./components/workspace/WorkspaceGate'));
const DatingScreen = lazy(() =>
  import('./components/dating/DatingScreen').then((m) => ({ default: m.DatingScreen }))
);
const LaunchFlowHost = lazy(() =>
  import('./components/launch/LaunchFlowHost').then((m) => ({ default: m.LaunchFlowHost }))
);
const UserProfilePreview = lazy(() =>
  import('./components/profile/UserProfilePreview').then((m) => ({ default: m.UserProfilePreview }))
);
const StoryRing = lazy(() =>
  import('./components/feed/StoryRing').then((m) => ({ default: m.StoryRing }))
);
const LiveScreen = lazy(() =>
  import('./components/live/LiveScreen').then((m) => ({ default: m.LiveScreen }))
);
const KaraokeScreen = lazy(() =>
  import('./components/karaoke/KaraokeScreen').then((m) => ({ default: m.KaraokeScreen }))
);

function resolveRoomsKaraokePath(roomsPath: string): string {
  if (!roomsPath || roomsPath === '/party') return '/room/create';
  return roomsPath;
}

function openRoomsInKaraoke(roomsPath: string): void {
  openKaraokeRoomFlow({
    path: resolveRoomsKaraokePath(roomsPath),
    entry: 'karaoke-party',
  });
}

const LocalGamesScreen = lazy(() =>
  import('./components/games/LocalGamesScreen').then((m) => ({ default: m.LocalGamesScreen }))
);
const ThirdPartyGamesScreen = lazy(() =>
  import('./components/games/ThirdPartyGamesScreen').then((m) => ({
    default: m.ThirdPartyGamesScreen,
  }))
);
const GameHubScreen = lazy(() =>
  import('./components/games/GameHubScreen').then((m) => ({ default: m.GameHubScreen }))
);
const GreedyTapScreen = lazy(() =>
  import('./components/games/GreedyTapScreen').then((m) => ({ default: m.GreedyTapScreen }))
);
const YouTubePage = lazy(() =>
  import('./pages/YouTube').then((m) => ({ default: m.YouTubePage }))
);
const WalletScreen = lazy(() =>
  import('./components/wallet/WalletScreen').then((m) => ({ default: m.WalletScreen }))
);
const DevLivePanelHost = import.meta.env.DEV
  ? lazy(() =>
      import('./components/dev/DevLivePanel').then((m) => ({ default: m.DevLivePanelHost }))
    )
  : function DevLivePanelHostStub() {
      return null;
    };
import { Tab } from './types';
import { ChatCallProvider } from './contexts/ChatCallContext';
import { registerAppTabGetter } from './lib/karaokeReturnContext';
import { useDB } from './lib/useDB';
import { findUserById } from './lib/safe';
import { useCurrentUser } from './lib/useCurrentUser';
import { useToast } from './lib/ToastContext';
import { AppCameraShell } from './components/camera/AppCameraShell';
import { AnimatePresence } from 'motion/react';
import { applyDocumentTheme } from './lib/theme';
import {
  applyDevSessionOverrideFromUrl,
  shouldApplyDevSessionOverride,
} from './lib/devSessionUser';
import { useLaunchRoute } from './hooks/useLaunchRoute';
import { useIsOnline } from './hooks/useNetworkStatus';
import { LaunchShell } from './components/launch/launchUi';
import { OfflineStatusBanner } from './components/common/OfflineStatusBanner';
import { useSupabaseAuth } from './contexts/SupabaseAuthContext';
import { useAuth } from './lib/AuthContext';
import { isFirebaseConfigured } from './lib/firebase/config';
import { isPrimarySupabaseCloud } from './lib/auth/config';
import { InstantRoomEntryHost } from './components/live/InstantRoomEntryHost';
const SplashScreen = lazy(() =>
  import('./components/auth/SplashScreen').then((m) => ({ default: m.SplashScreen }))
);
const YoutubeMiniPlayerHost = lazy(() =>
  import('./components/youtube/YoutubeMiniPlayerHost').then((m) => ({
    default: m.YoutubeMiniPlayerHost,
  }))
);
const AuthScreen = lazy(() =>
  import('./components/auth/AuthScreen').then((m) => ({ default: m.AuthScreen }))
);
const ProfileSetup = lazy(() =>
  import('./components/auth/ProfileSetup').then((m) => ({ default: m.ProfileSetup }))
);
import {
  isPlaybackCoordinatorApplying,
  pauseAllPlayback,
} from './lib/playbackAudio';
import { pausePeerVideos } from './lib/playbackScope';
import { openShareLink, parseShareLink } from './lib/shareLinks';
import { trackScreen } from './lib/uxTelemetry';
import {
  NAV_PERSIST_EVENT,
  readInitialShellState,
  readShellStateFromUrl,
  writePersistedShellState,
  type PersistedShellState,
} from './lib/navigationRestore';
import {
  clearSessionCache,
  readSessionCache,
  sessionCacheToUser,
  writeSessionCache,
} from './lib/sessionCache';
import { hasInstantSessionCache, instantSuspenseFallback } from './lib/instantCachePolicy';
import { isSilentSyncToast } from './lib/silentRemoteRefresh';
import type { LaunchRoute } from './lib/launchRoute';
import { openKaraokeRoomFlow } from './lib/live/openLiveRoom';
import { stripAppBasePath } from './lib/appShellRoutes';

const AdminEmbedRoomHost = lazy(() =>
  import('./components/admin/AdminEmbedRoomHost').then((m) => ({ default: m.AdminEmbedRoomHost })),
);
const AdminEmbedGiftPreviewHost = lazy(() =>
  import('./components/admin/AdminEmbedGiftPreviewHost').then((m) => ({
    default: m.AdminEmbedGiftPreviewHost,
  })),
);

function parseAdminEmbedRoomId(): string | null {
  if (typeof window === 'undefined') return null;
  const path = stripAppBasePath(window.location.pathname);
  const match = path.match(/^\/admin-embed\/room\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function isAdminGiftPreviewEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  const path = stripAppBasePath(window.location.pathname);
  return path === '/admin-embed/gift-preview' || path === '/admin-embed/gift-preview/';
}

function ToastListener() {
  const { showToast } = useToast();
  
  useEffect(() => {
    const handleAppToast = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (!detail) return;
      if (!isSilentSyncToast(detail)) showToast(detail);
    };
    window.addEventListener('app-toast', handleAppToast);
    return () => window.removeEventListener('app-toast', handleAppToast);
  }, [showToast]);

  return null;
}

export default function App() {
  const adminEmbedRoomId = useMemo(() => parseAdminEmbedRoomId(), []);
  const adminGiftPreview = useMemo(() => isAdminGiftPreviewEmbed(), []);
  return (
    <AppCameraShell>
      <ToastListener />
      {adminGiftPreview ? (
        <Suspense fallback={instantSuspenseFallback()}>
          <AdminEmbedGiftPreviewHost />
        </Suspense>
      ) : adminEmbedRoomId ? (
        <Suspense fallback={instantSuspenseFallback()}>
          <AdminEmbedRoomHost roomId={adminEmbedRoomId} />
        </Suspense>
      ) : (
        <MainApp />
      )}
    </AppCameraShell>
  );
}

function MainApp() {
  const initialShell = readInitialShellState();
  const [currentTab, setCurrentTab] = useState<Tab>(initialShell.currentTab);
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const [initialChatId, setInitialChatId] = useState<string | null>(initialShell.initialChatId);
  const [initialReelId, setInitialReelId] = useState<string | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<{
    query?: string;
    tab?: SearchTab;
  } | null>(initialShell.initialSearchContext);
  const [profileUserId, setProfileUserId] = useState<string | null>(initialShell.profileUserId);
  const [globalPreviewUserId, setGlobalPreviewUserId] = useState<string | null>(null);
  const [globalStoryUserId, setGlobalStoryUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{
    tab: Tab;
    profileUserId: string | null;
    initialChatId: string | null;
    initialSearchContext: { query?: string; tab?: SearchTab } | null;
  }>>([]);
  const [roomsInitialPath, setRoomsInitialPath] = useState(initialShell.roomsInitialPath);
  const [visitedTabs, setVisitedTabs] = useState<Tab[]>(() => [initialShell.currentTab]);
  const [mainShellPinned, setMainShellPinned] = useState(
    () =>
      Boolean(readSessionCache()) ||
      hasInstantSessionCache() ||
      // Local deep link: /greedy-tap must open the game, not the marketing funnel.
      (import.meta.env.DEV && initialShell.currentTab === 'greedy-tap'),
  );
  const deepLinkBootstrappedRef = useRef(false);
  const roomsBootstrappedRef = useRef(false);
  const applyingHistoryRef = useRef(false);
  const shellSnapshotRef = useRef<PersistedShellState>(initialShell);
  shellSnapshotRef.current = {
    currentTab,
    profileUserId,
    initialChatId,
    initialSearchContext,
    roomsInitialPath,
  };
  const db = useDB();
  const dbUser = useCurrentUser();
  const { configured: supabaseAuth, authReady } = useSupabaseAuth();
  const launchRoute = useLaunchRoute();
  const isOnline = useIsOnline();
  const { user: firebaseUser, profile: firebaseProfile, loading: firebaseLoading } = useAuth();

  // Cache-first: localStorage hint is available before IndexedDB hydrates.
  const [sessionHint, setSessionHint] = useState(() => readSessionCache());
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    void db.whenStorageReady().then(() => {
      setStorageReady(true);
      if (db.isLoggedIn && db.currentUser) {
        writeSessionCache(db.currentUser, {
          profileSetupComplete: db.getLaunchProgress().profileSetupComplete,
        });
        setSessionHint(readSessionCache());
        setMainShellPinned(true);
      } else if (!db.isLoggedIn && !hasInstantSessionCache()) {
        clearSessionCache();
        setSessionHint(null);
        setMainShellPinned(false);
      }
    });
  }, [db]);

  useEffect(() => {
    if (hasInstantSessionCache() || sessionHint || db.isLoggedIn) {
      setMainShellPinned(true);
    }
  }, [sessionHint, db.isLoggedIn]);

  // Prefer IDB user; fall back to session cache so Shell never waits on network.
  const currentUser =
    db.isLoggedIn && dbUser.id !== 'unknown'
      ? dbUser
      : sessionHint
        ? sessionCacheToUser(sessionHint)
        : dbUser;

  // Show main app from cache while IDB loads; once pinned, never flash back to launch funnel.
  // DEV /greedy-tap deep link always enters the shell so Greedy Tap can iframe :3000.
  const greedyTapDevDeepLink = import.meta.env.DEV && currentTab === 'greedy-tap';
  const effectiveLaunchRoute: LaunchRoute =
    launchRoute === 'banned'
      ? 'banned'
      : greedyTapDevDeepLink ||
          mainShellPinned ||
          hasInstantSessionCache() ||
          (sessionHint && (!storageReady || db.isLoggedIn))
        ? 'main'
        : launchRoute;

  useEffect(() => {
    if (!greedyTapDevDeepLink) return;
    setMainShellPinned(true);
    try {
      const progress = db.getLaunchProgress();
      if (!progress.hasSeenSplash) db.markSplashSeen();
      if (!progress.hasCompletedOnboarding) db.completeOnboarding();
    } catch {
      /* launch helpers may not be ready on first paint */
    }
  }, [greedyTapDevDeepLink, db]);

  useEffect(() => {
    registerAppTabGetter(() => currentTabRef.current);
    return () => registerAppTabGetter(null);
  }, []);

  useEffect(() => {
    if (roomsBootstrappedRef.current || currentTab !== 'rooms') return;
    roomsBootstrappedRef.current = true;
    openRoomsInKaraoke(roomsInitialPath);
    setCurrentTab('karaoke');
    setVisitedTabs((tabs): Tab[] => {
      const karaokeTab: Tab = 'karaoke';
      const without = tabs.filter((t) => t !== karaokeTab);
      return [...without, karaokeTab].slice(-3);
    });
  }, [currentTab, roomsInitialPath]);

  useEffect(() => {
    trackScreen(currentTab);
  }, [currentTab]);

  useEffect(() => {
    if (applyingHistoryRef.current) return;
    writePersistedShellState({
      currentTab,
      profileUserId,
      initialChatId,
      initialSearchContext,
      roomsInitialPath,
    });
  }, [currentTab, profileUserId, initialChatId, initialSearchContext, roomsInitialPath]);

  const applyShellState = (state: PersistedShellState) => {
    applyingHistoryRef.current = true;
    setCurrentTab(state.currentTab);
    setProfileUserId(state.profileUserId);
    setInitialChatId(state.initialChatId);
    setInitialSearchContext(state.initialSearchContext);
    setRoomsInitialPath(state.roomsInitialPath);
    if (state.currentTab === 'rooms') {
      openRoomsInKaraoke(state.roomsInitialPath);
      setCurrentTab('karaoke');
    }
    applyingHistoryRef.current = false;
  };

  useEffect(() => {
    const onPopState = () => {
      const fromUrl = readShellStateFromUrl();
      if (!fromUrl) return;
      setHistory([]);
      applyShellState(fromUrl);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onPersist = () => {
      writePersistedShellState(shellSnapshotRef.current);
    };
    window.addEventListener(NAV_PERSIST_EVENT, onPersist);
    return () => window.removeEventListener(NAV_PERSIST_EVENT, onPersist);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !shouldApplyDevSessionOverride(window.location.search)) return;
    if (supabaseAuth && !authReady) return;
    void applyDevSessionOverrideFromUrl();
  }, [authReady, supabaseAuth]);

  /** Cold-start: ?tab=profile&profileTab=manage and other share URLs → K-Star / party / track. */
  useEffect(() => {
    if (deepLinkBootstrappedRef.current || effectiveLaunchRoute !== 'main') return;
    const ref = parseShareLink(window.location.href);
    if (!ref) return;
    if (
      ref.kind === 'karaoke-profile' ||
      ref.kind === 'karaoke-track' ||
      ref.kind === 'party'
    ) {
      deepLinkBootstrappedRef.current = true;
      openShareLink(ref, db.users);
    }
  }, [effectiveLaunchRoute, db.users]);

  useEffect(() => {
    setVisitedTabs((prev): Tab[] => {
      // LRU keep-alive: only last 3 tabs stay mounted. Visiting every screen
      // used to leave all of them alive (polls + useDB) and freeze the app.
      const MAX_KEEPALIVE = 3;
      const without = prev.filter((t) => t !== currentTab);
      return [...without, currentTab].slice(-MAX_KEEPALIVE);
    });
  }, [currentTab]);

  useEffect(() => {
    applyDocumentTheme(db.settings.theme === 'dark' ? 'dark' : 'light');
  }, [db.settings.theme]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        pauseAllPlayback();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const handleShowPreview = (e: Event) => {
      const detail = (e as CustomEvent<{ userId?: string; user?: { id?: string } }>).detail;
      const id = detail?.userId ?? detail?.user?.id;
      if (id) setGlobalPreviewUserId(id);
    };
    window.addEventListener('show-profile-preview', handleShowPreview);
    return () => window.removeEventListener('show-profile-preview', handleShowPreview);
  }, []);

  useEffect(() => {
    const handleOpenStory = (e: Event) => {
      const detail = (e as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId) {
        setGlobalPreviewUserId(null);
        setGlobalStoryUserId(detail.userId);
      }
    };
    window.addEventListener('open-story', handleOpenStory);
    return () => window.removeEventListener('open-story', handleOpenStory);
  }, []);

  useEffect(() => {
    const handlePlay = (e: Event) => {
      if (isPlaybackCoordinatorApplying()) return;
      const activeVideo = e.target;
      if (activeVideo instanceof HTMLVideoElement) {
        pausePeerVideos(activeVideo);
      }
    };
    window.addEventListener('play', handlePlay, true);
    return () => window.removeEventListener('play', handlePlay, true);
  }, []);

  const pushState = (
    nextTab: Tab, 
    nextProfileUserId: string | null = null, 
    nextChatId: string | null = null, 
    nextSearchContext: { query?: string; tab?: SearchTab } | null = null
  ) => {
    setGlobalPreviewUserId(null);
    setGlobalStoryUserId(null);
    // Only push to history if the target state is different from the current state
    if (
      currentTab === nextTab && 
      profileUserId === nextProfileUserId && 
      initialChatId === nextChatId && 
      JSON.stringify(initialSearchContext) === JSON.stringify(nextSearchContext)
    ) {
      return;
    }

    setHistory(prev => [
      ...prev,
      {
        tab: currentTab,
        profileUserId,
        initialChatId,
        initialSearchContext,
      }
    ]);

    setCurrentTab(nextTab);
    setProfileUserId(nextProfileUserId);
    setInitialChatId(nextChatId);
    setInitialReelId(null);
    setInitialSearchContext(nextSearchContext);
  };

  const goBack = () => {
    setGlobalPreviewUserId(null);
    setGlobalStoryUserId(null);
    if (history.length === 0) {
      setCurrentTab('home');
      setProfileUserId(null);
      setInitialChatId(null);
      setInitialSearchContext(null);
      return;
    }

    setHistory(prev => {
      const nextHistory = [...prev];
      const previousState = nextHistory.pop();
      if (previousState) {
        setCurrentTab(previousState.tab);
        setProfileUserId(previousState.profileUserId);
        setInitialChatId(previousState.initialChatId);
        setInitialSearchContext(previousState.initialSearchContext);
      }
      return nextHistory;
    });
  };

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{
        tab?: Tab;
        userId?: string;
        chatId?: string;
        reelId?: string;
        searchQuery?: string;
        searchTab?: string;
        roomsPath?: string;
      }>).detail;
      if (detail?.tab) {
        if (detail.tab === 'messages' && currentTab === 'karaoke') {
          window.dispatchEvent(
            new CustomEvent('karaoke-messages-open', {
              detail: { chatId: detail.chatId ?? null },
            }),
          );
          return;
        }
        if (detail.tab === 'notifications' && currentTab === 'karaoke') {
          window.dispatchEvent(new CustomEvent('karaoke-notifications-open'));
          return;
        }
        if (detail.tab === 'rooms') {
          const path = detail.roomsPath || '/party';
          setRoomsInitialPath(path);
          openRoomsInKaraoke(path);
          pushState('karaoke', null, null, null);
          return;
        }
        const nextTab = detail.tab;
        const pendingProfileUserId =
          detail.tab === 'profile' ? consumePendingAppProfileUserId() : null;
        const nextProfileUserId =
          detail.tab === 'profile'
            ? (detail.userId || pendingProfileUserId || null)
            : null;
        const nextChatId = detail.chatId || null;
        const nextReelId = detail.reelId || null;
        let nextSearchContext: { query?: string; tab?: SearchTab } | null = null;
        if (detail.searchQuery || detail.searchTab) {
          const tab =
            detail.searchTab === 'top' ||
            detail.searchTab === 'accounts' ||
            detail.searchTab === 'audio' ||
            detail.searchTab === 'tags' ||
            detail.searchTab === 'places' ||
            detail.searchTab === 'youtube'
              ? detail.searchTab
              : undefined;
          nextSearchContext = { query: detail.searchQuery, tab };
        }
        pushState(nextTab, nextProfileUserId, nextChatId, nextSearchContext);
        if (nextReelId) setInitialReelId(nextReelId);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, [currentTab, profileUserId, initialChatId, initialSearchContext]);

  const handleTabChange = (tab: Tab) => {
    if (tab === 'rooms') {
      setRoomsInitialPath('/party');
      openRoomsInKaraoke('/party');
      pushState('karaoke', null, null, null);
      return;
    }
    if (currentTab === tab && !profileUserId) return;
    pushState(tab, null, null, null);
  };

  const profileBackLabel = useMemo(() => {
    if (!profileUserId) return undefined;
    const previous = history.length > 0 ? history[history.length - 1] : null;
    if (!previous) return 'Feed';
    return appTabBackLabel(previous.tab);
  }, [profileUserId, history]);

  const screen = (name: string, node: React.ReactNode) => (
    <ScreenGuard screen={name}>
      <Suspense fallback={instantSuspenseFallback()}>{node}</Suspense>
    </ScreenGuard>
  );

  const renderTabPanel = (tab: Tab) => {
    switch (tab) {
      case 'home':
        return screen('home', <Feed />);
      case 'search':
        return screen(
          'search',
          <SearchScreen
            initialContext={initialSearchContext}
            onClearContext={() => setInitialSearchContext(null)}
          />,
        );
      case 'reels':
        return screen('reels', <ReelsScreen initialReelId={initialReelId} />);
      case 'messages':
        return screen(
          'messages',
          <MessagesScreen
            onBack={goBack}
            initialChatId={initialChatId}
            onClearInitialChatId={() => setInitialChatId(null)}
          />,
        );
      case 'workspace':
        return screen('workspace', <WorkspaceGate />);
      case 'profile':
        return screen(
          'profile',
          <ProfileScreen
            key={profileUserId || db.currentUser?.id || 'me'}
            userId={profileUserId || undefined}
            onBack={profileUserId ? goBack : undefined}
            backLabel={profileBackLabel}
          />,
        );
      case 'notifications':
        return screen('notifications', <NotificationsScreen />);
      case 'dating':
        return screen('dating', <DatingScreen />);
      case 'live':
        return screen('live', <LiveScreen />);
      case 'karaoke':
      case 'rooms':
        return screen('karaoke', <KaraokeScreen />);
      case 'game-hub':
        return screen(
          'game-hub',
          <GameHubScreen
            onOpenLocalGames={() => setCurrentTab('local-games')}
            onOpenThirdParty={() => setCurrentTab('third-party-games')}
          />,
        );
      case 'greedy-tap':
        return screen('greedy-tap', <GreedyTapScreen />);
      case 'local-games':
        return screen('local-games', <LocalGamesScreen />);
      case 'third-party-games':
        return screen('third-party-games', <ThirdPartyGamesScreen />);
      case 'wallet':
        return screen('wallet', <WalletScreen />);
      case 'youtube':
        return screen('youtube', <YouTubePage onBack={goBack} />);
      default:
        return screen('home', <Feed />);
    }
  };

  const keepAliveKeyForTab = (tab: Tab): string => {
    if (tab === 'profile') return `profile-${profileUserId ?? 'me'}`;
    return tab;
  };

  const renderContent = () => (
    <>
      {visitedTabs.map((tab) => (
        <KeepAliveTab key={keepAliveKeyForTab(tab)} active={currentTab === tab}>
          {renderTabPanel(tab)}
        </KeepAliveTab>
      ))}
    </>
  );

  // Never full-screen block on auth/network — mount real routes from local state
  // immediately. Session restore runs in CloudAuthProvider in the background.
  const supabasePrimary = isPrimarySupabaseCloud();

  const canPaintMainFromCache =
    mainShellPinned ||
    hasInstantSessionCache() ||
    (db.isLoggedIn && currentUser?.id && currentUser.id !== 'unknown');

  if (!supabasePrimary && firebaseLoading && isOnline && !canPaintMainFromCache) {
    return (
      <>
        <Suspense fallback={instantSuspenseFallback()}>
          <SplashScreen isLoading={true} />
        </Suspense>
        <OfflineStatusBanner />
      </>
    );
  }

  const firebaseConfigured = isFirebaseConfigured();
  if (!supabasePrimary && firebaseConfigured && !firebaseLoading && !firebaseUser && !canPaintMainFromCache) {
    return (
      <Suspense fallback={instantSuspenseFallback()}>
        <AuthScreen />
      </Suspense>
    );
  }

  const profileReady =
    db.getLaunchProgress().profileSetupComplete || Boolean(sessionHint?.profileSetupComplete);
  if (
    !supabasePrimary &&
    !firebaseLoading &&
    firebaseUser &&
    !firebaseProfile &&
    !profileReady &&
    !canPaintMainFromCache
  ) {
    return (
      <Suspense fallback={instantSuspenseFallback()}>
        <ProfileSetup />
      </Suspense>
    );
  }

  if (effectiveLaunchRoute !== 'main' && !canPaintMainFromCache) {
    return (
      <>
        <OfflineStatusBanner />
        <Suspense fallback={instantSuspenseFallback()}>
          <LaunchFlowHost route={effectiveLaunchRoute} />
        </Suspense>
        {import.meta.env.DEV ? (
          <Suspense fallback={null}>
            <DevLivePanelHost currentTab="home" profileUserId={null} />
          </Suspense>
        ) : null}
      </>
    );
  }

  return (
    <>
      <OfflineStatusBanner insetBelowNav />
      <Suspense fallback={null}>
        <YoutubeMiniPlayerHost currentTab={currentTab} />
      </Suspense>
      <InstantRoomEntryHost />
      <ChatCallProvider
        currentUserId={currentUser?.id}
        currentUserAvatarUrl={currentUser?.avatarUrl}
      >
        <Shell currentTab={currentTab} setCurrentTab={handleTabChange} currentUser={currentUser}>
          {renderContent()}
        </Shell>
      </ChatCallProvider>
      <AnimatePresence>
        {globalPreviewUserId && (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <UserProfilePreview
                userId={globalPreviewUserId}
                onClose={() => setGlobalPreviewUserId(null)}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </AnimatePresence>
      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <DevLivePanelHost currentTab={currentTab} profileUserId={profileUserId} />
        </Suspense>
      ) : null}
      {globalStoryUserId && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <StoryRing
            story={{
              id: `story-${globalStoryUserId}`,
              user: findUserById(db.users, globalStoryUserId, db.currentUser),
              hasViewed: db.hasViewedStory(globalStoryUserId, 'feed'),
            }}
            storyScope="feed"
            isOpen={true}
            hideRing={true}
            onClose={() => setGlobalStoryUserId(null)}
            isCurrentUser={globalStoryUserId === db.currentUser?.id}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
