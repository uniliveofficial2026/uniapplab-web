/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shell } from './components/layout/Shell';
import { LiveScreen } from './components/live/LiveScreen';
import { LocalGamesScreen } from './components/games/LocalGamesScreen';
import { ThirdPartyGamesScreen } from './components/games/ThirdPartyGamesScreen';
import { WalletScreen } from './components/wallet/WalletScreen';
import { Feed } from './components/feed/Feed';
import { SearchScreen } from './components/search/SearchScreen';
import { ReelsScreen } from './components/reels/ReelsScreen';
import { MessagesScreen } from './components/messages/MessagesScreen';
import { ProfileScreen } from './components/profile/ProfileScreen';
import { WorkspaceScreen } from './components/workspace/WorkspaceScreen';
import { NotificationsScreen } from './components/notifications/NotificationsScreen';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { ProfileSetup } from './components/auth/ProfileSetup';
import { SplashScreen } from './components/auth/SplashScreen';
import { AppLogo } from './components/common/AppLogo';
import { Tab, User } from './types';
import { useDB } from './lib/useDB';
import { ToastProvider, useToast } from './lib/ToastContext';
import { UserProfilePreview } from './components/profile/UserProfilePreview';
import { StoryRing } from './components/feed/StoryRing';
import { AnimatePresence } from 'motion/react';

function ToastListener() {
  const { showToast } = useToast();
  
  useEffect(() => {
    const handleAppToast = (e: any) => {
      if (e.detail) {
        showToast(e.detail);
      }
    };
    window.addEventListener('app-toast', handleAppToast);
    return () => window.removeEventListener('app-toast', handleAppToast);
  }, [showToast]);

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [initialChatId, setInitialChatId] = useState<string | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<{ query?: string, tab?: any } | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [globalPreviewUser, setGlobalPreviewUser] = useState<User | null>(null);
  const [globalStoryUserId, setGlobalStoryUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{
    tab: Tab;
    profileUserId: string | null;
    initialChatId: string | null;
    initialSearchContext: any;
  }>>([]);
  const db = useDB();
  const [splashDone, setSplashDone] = useState(false);
  
  useEffect(() => {
    const settings = db.settings;
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Sync initial language to google translate
    const initLang = () => {
       const select = document.querySelector('.goog-te-combo') as HTMLSelectElement;
       if (select && select.value !== settings.language) {
          select.value = settings.language || 'en';
          select.dispatchEvent(new Event('change'));
       } else if (!select) {
          setTimeout(initLang, 1000);
       }
    };
    if (settings.language && settings.language !== 'en') {
        initLang();
    }
  }, [db.settings.theme, db.settings.language]); // React to theme and language changes

  useEffect(() => {
    const handleShowPreview = (e: any) => {
      if (e.detail?.user) {
        setGlobalPreviewUser(e.detail.user);
      }
    };
    window.addEventListener('show-profile-preview', handleShowPreview);
    return () => window.removeEventListener('show-profile-preview', handleShowPreview);
  }, []);

  useEffect(() => {
    const handleOpenStory = (e: any) => {
      if (e.detail?.userId) {
        setGlobalPreviewUser(null);
        setGlobalStoryUserId(e.detail.userId);
      }
    };
    window.addEventListener('open-story', handleOpenStory);
    return () => window.removeEventListener('open-story', handleOpenStory);
  }, []);

  useEffect(() => {
    const handlePlay = (e: Event) => {
      const activeVideo = e.target;
      if (activeVideo instanceof HTMLVideoElement) {
        document.querySelectorAll('video').forEach((video) => {
          if (video !== activeVideo && !video.paused) {
            video.pause();
          }
        });
      }
    };
    window.addEventListener('play', handlePlay, true);
    return () => window.removeEventListener('play', handlePlay, true);
  }, []);

  const pushState = (
    nextTab: Tab, 
    nextProfileUserId: string | null = null, 
    nextChatId: string | null = null, 
    nextSearchContext: any = null
  ) => {
    setGlobalPreviewUser(null);
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
    setGlobalPreviewUser(null);
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
    const handleNavigate = (e: any) => {
      if (e.detail?.tab) {
        const nextTab = e.detail.tab;
        const nextProfileUserId = e.detail.tab === 'profile' ? (e.detail.userId || null) : null;
        const nextChatId = e.detail.chatId || null;
        let nextSearchContext = null;
        if (e.detail.searchQuery || e.detail.searchTab) {
          nextSearchContext = { query: e.detail.searchQuery, tab: e.detail.searchTab };
        }
        pushState(nextTab, nextProfileUserId, nextChatId, nextSearchContext);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, [currentTab, profileUserId, initialChatId, initialSearchContext]);

  const handleTabChange = (tab: Tab) => {
    if (currentTab === tab && !profileUserId) return;
    pushState(tab, null, null, null);
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return <Feed />;
      case 'search':
        return <SearchScreen initialContext={initialSearchContext} onClearContext={() => setInitialSearchContext(null)} />;
      case 'reels':
        return <ReelsScreen />;
      case 'messages':
        return <MessagesScreen onBack={goBack} initialChatId={initialChatId} onClearInitialChatId={() => setInitialChatId(null)} />;
      case 'workspace':
        return <WorkspaceScreen />;
      case 'profile':
        return (
          <ProfileScreen 
            key={profileUserId || db.currentUser.id} 
            userId={profileUserId || undefined} 
            onBack={(profileUserId || history.length > 0) ? goBack : undefined} 
          />
        );
      case 'notifications':
        return <NotificationsScreen />;
      case 'live':
        return <LiveScreen />;
      case 'local-games':
        return <LocalGamesScreen />;
      case 'third-party-games':
        return <ThirdPartyGamesScreen />;
      case 'wallet':
        return <WalletScreen />;
      default:
        return <Feed />;
    }
  };

  // We want instant loading in the background. The app renders immediately behind the splash screen.
  const isActuallyLoggedOut = !loading && !user;
  const isLikelyLoggedIn = user || db.isLoggedIn;
  
  if (isActuallyLoggedOut) {
    return (
      <>
        {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} isLoading={false} />}
        {splashDone && <AuthScreen />}
      </>
    );
  }

  const activeProfile = profile || (() => {
    if (user) {
      const cached = localStorage.getItem('local_profile_' + user.uid);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
    }
    return null;
  })() || db.currentUser;

  if (user && !profile && !loading && !localStorage.getItem('local_profile_' + user.uid)) {
    return (
      <>
        {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} isLoading={false} />}
        {splashDone && <ProfileSetup />}
      </>
    );
  }

  return (
    <>
      <ToastListener />
      <Shell currentTab={currentTab} setCurrentTab={handleTabChange} currentUser={activeProfile}>
        {renderContent()}
      </Shell>
      <AnimatePresence>
        {globalPreviewUser && (
          <UserProfilePreview 
            user={globalPreviewUser} 
            onClose={() => setGlobalPreviewUser(null)} 
          />
        )}
      </AnimatePresence>
      {globalStoryUserId && (
        <StoryRing 
          story={{ id: `story-${globalStoryUserId}`, user: db.users.find(u => u.id === globalStoryUserId) || db.currentUser, hasViewed: true }}
          isOpen={true}
          hideRing={true}
          onClose={() => setGlobalStoryUserId(null)}
          isCurrentUser={globalStoryUserId === db.currentUser.id}
        />
      )}
      {!splashDone && (
        <div className="fixed inset-0 z-[100000]">
           <SplashScreen onComplete={() => setSplashDone(true)} isLoading={false} />
        </div>
      )}
    </>
  );
}
