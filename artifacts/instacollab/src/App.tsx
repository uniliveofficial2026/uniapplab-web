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
import { ErrorBoundary } from './components/common/ErrorBoundary';

const ReelsScreen = lazy(() =>
  import('./components/reels/ReelsScreen').then((m) => ({ default: m.ReelsScreen }))
);
const MessagesScreen = lazy(() =>
  import('./components/messages/MessagesScreen').then((m) => ({ default: m.MessagesScreen }))
);
const WorkspaceScreen = lazy(() => import('./components/workspace/WorkspaceScreen'));
const ProfileScreen = lazy(() =>
  import('./components/profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);
const DatingScreen = lazy(() =>
  import('./components/dating/DatingScreen').then((m) => ({ default: m.DatingScreen }))
);
const Feed = lazy(() => import('./components/feed/Feed').then((m) => ({ default: m.Feed })));
const SearchScreen = lazy(() =>
  import('./components/search/SearchScreen').then((m) => ({ default: m.SearchScreen }))
);
const NotificationsScreen = lazy(() =>
  import('./components/notifications/NotificationsScreen').then((m) => ({
    default: m.NotificationsScreen,
  }))
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
const RoomsHost = lazy(() =>
  import('./smule-rooms/RoomsHost').then((m) => ({ default: m.RoomsHost }))
);
const LocalGamesScreen = lazy(() =>
  import('./components/games/LocalGamesScreen').then((m) => ({ default: m.LocalGamesScreen }))
);
const ThirdPartyGamesScreen = lazy(() =>
  import('./components/games/ThirdPartyGamesScreen').then((m) => ({
    default: m.ThirdPartyGamesScreen,
  }))
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
import { registerAppTabGetter } from './lib/karaokeReturnContext';
import { useDB } from './lib/useDB';
import { findUserById } from './lib/safe';
import { useCurrentUser } from './lib/useCurrentUser';
import { ToastProvider, useToast } from './lib/ToastContext';
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
import { getFirebaseAuth } from './lib/firebase';
import { isPrimarySupabaseCloud } from './lib/auth/config';
const SplashScreen = lazy(() =>
  import('./components/auth/SplashScreen').then((m) => ({ default: m.SplashScreen }))
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

function ToastListener() {
  const { showToast } = useToast();
  
  useEffect(() => {
    const handleAppToast = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) {
        showToast(detail);
      }
    };
    window.addEventListener('app-toast', handleAppToast);
    return () => window.removeEventListener('app-toast', handleAppToast);
  }, [showToast]);

  return null;
}

export default function App() {
  const initialShell = readInitialShellState();
  const [currentTab, setCurrentTab] = useState<Tab>(initialShell.currentTab);
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const [initialChatId, setInitialChatId] = useState<string | null>(initialShell.initialChatId);
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
  const [roomsRouterKey, setRoomsRouterKey] = useState(0);
  const deepLinkBootstrappedRef = useRef(false);
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
  const currentUser = useCurrentUser();
  const { configured: supabaseAuth, authReady } = useSupabaseAuth();
  const launchRoute = useLaunchRoute();
  const isOnline = useIsOnline();
  const { user: firebaseUser, profile: firebaseProfile, loading: firebaseLoading } = useAuth();

  useEffect(() => {
    registerAppTabGetter(() => currentTabRef.current);
    return () => registerAppTabGetter(null);
  }, []);

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
      setRoomsRouterKey((k) => k + 1);
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
    if (deepLinkBootstrappedRef.current || launchRoute !== 'main') return;
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
  }, [launchRoute, db.users]);

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
          setRoomsInitialPath(detail.roomsPath || '/party');
          setRoomsRouterKey((k) => k + 1);
        }
        const nextTab = detail.tab;
        const pendingProfileUserId =
          detail.tab === 'profile' ? consumePendingAppProfileUserId() : null;
        const nextProfileUserId =
          detail.tab === 'profile'
            ? (detail.userId || pendingProfileUserId || null)
            : null;
        const nextChatId = detail.chatId || null;
        let nextSearchContext: { query?: string; tab?: SearchTab } | null = null;
        if (detail.searchQuery || detail.searchTab) {
          const tab =
            detail.searchTab === 'top' ||
            detail.searchTab === 'accounts' ||
            detail.searchTab === 'audio' ||
            detail.searchTab === 'tags' ||
            detail.searchTab === 'places'
              ? detail.searchTab
              : undefined;
          nextSearchContext = { query: detail.searchQuery, tab };
        }
        pushState(nextTab, nextProfileUserId, nextChatId, nextSearchContext);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, [currentTab, profileUserId, initialChatId, initialSearchContext]);

  const handleTabChange = (tab: Tab) => {
    if (tab === 'rooms') {
      setRoomsInitialPath('/party');
      setRoomsRouterKey((k) => k + 1);
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
    <ScreenGuard screen={name}>{node}</ScreenGuard>
  );

  const renderContent = () => {
    switch (currentTab) {
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
        return screen('reels', <ReelsScreen />);
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
        return screen('workspace', <WorkspaceScreen />);
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
        return screen('karaoke', <KaraokeScreen />);
      case 'rooms':
        return screen(
          'rooms',
          <RoomsHost initialPath={roomsInitialPath} routerKey={roomsRouterKey} />,
        );
      case 'local-games':
        return screen('local-games', <LocalGamesScreen />);
      case 'third-party-games':
        return screen('third-party-games', <ThirdPartyGamesScreen />);
      case 'wallet':
        return screen('wallet', <WalletScreen />);
      default:
        return screen('home', <Feed />);
    }
  };

  const hasLocalSession = db.isLoggedIn && Boolean(db.currentUserId);
  const deferAuthSpinnerForLocalSession = hasLocalSession;

  if (supabaseAuth && !authReady && !deferAuthSpinnerForLocalSession) {
    return (
      <ToastProvider>
        <ToastListener />
        <LaunchShell className="items-center justify-center gap-3 p-6">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">
            {isOnline ? 'Restoring your session…' : 'Loading your saved app…'}
          </p>
        </LaunchShell>
        <OfflineStatusBanner />
      </ToastProvider>
    );
  }

  const supabasePrimary = isPrimarySupabaseCloud();

  // Firebase auth gate — skip when Supabase owns auth (primary cloud).
  if (!supabasePrimary && firebaseLoading) {
    return (
      <ToastProvider>
        <ToastListener />
        <Suspense fallback={<LaunchShell className="items-center justify-center gap-3 p-6"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></LaunchShell>}>
          <SplashScreen isLoading={true} />
        </Suspense>
      </ToastProvider>
    );
  }

  const firebaseConfigured = !!getFirebaseAuth();
  if (!supabasePrimary && firebaseConfigured && !firebaseLoading && !firebaseUser) {
    return (
      <ToastProvider>
        <ToastListener />
        <Suspense fallback={<LaunchShell className="items-center justify-center gap-3 p-6"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></LaunchShell>}>
          <AuthScreen />
        </Suspense>
      </ToastProvider>
    );
  }

  if (!supabasePrimary && !firebaseLoading && firebaseUser && !firebaseProfile) {
    return (
      <ToastProvider>
        <ToastListener />
        <Suspense fallback={<LaunchShell className="items-center justify-center gap-3 p-6"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></LaunchShell>}>
          <ProfileSetup />
        </Suspense>
      </ToastProvider>
    );
  }

  if (launchRoute !== 'main') {
    return (
      <ToastProvider>
        <ToastListener />
        <OfflineStatusBanner />
        <Suspense fallback={<LaunchShell className="items-center justify-center gap-3 p-6"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></LaunchShell>}>
          <LaunchFlowHost route={launchRoute} />
        </Suspense>
        {import.meta.env.DEV ? (
          <Suspense fallback={null}>
            <DevLivePanelHost currentTab="home" profileUserId={null} />
          </Suspense>
        ) : null}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ToastListener />
      <OfflineStatusBanner insetBelowNav />
      <Shell currentTab={currentTab} setCurrentTab={handleTabChange} currentUser={currentUser}>
        {renderContent()}
      </Shell>
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
    </ToastProvider>
  );
}
