import { motion, AnimatePresence } from 'motion/react';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Home, Search, PlaySquare, MessageCircle, Bell, PlusSquare, LayoutDashboard, Menu, Store, Radio, MicVocal, Gamepad2, Globe, Wallet, Circle, X, Heart, Sun, Moon } from 'lucide-react';
import { Tab, User } from '../../types';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError, handleMediaError } from '../../lib/utils';
import { PostAudioPlaybackRoot } from '../playback/PostAudioPlaybackRoot';
import { pauseAllPlayback } from '../../lib/playbackAudio';
import { resetMediaOverlayLocks } from '../../lib/mediaOverlayLock';
import { applyDocumentTheme, nextTheme } from '../../lib/theme';
import { useDB } from '../../lib/useDB';
import { dispatchTapRefresh, scrollAppMainToTop } from '../../lib/appRefresh';
import { requestKaraokeStudioOpen } from '../../lib/karaokeSearch';
import { navTapButtonClass, navTapIconButtonClass, navTapRowButtonClass } from '../../lib/navTap';
import { ShellCreateModal, type CreateLaunch } from './ShellCreateModal';
import { PwaInstallPrompt } from '../common/PwaInstallPrompt';
import { MobileDevConnectBanner } from '../common/MobileDevConnectBanner';

interface ShellProps {
  currentTab: Tab;
  setCurrentTab: (tab: Tab) => void;
  currentUser: User;
  children: ReactNode;
}

export function Shell({ currentTab, setCurrentTab, currentUser, children }: ShellProps) {
  const db = useDB();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createLaunch, setCreateLaunch] = useState<CreateLaunch | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [hideMobileTopNavForChat, setHideMobileTopNavForChat] = useState(false);
  const { showToast } = useToast();

  const openCreator = (type: 'post' | 'reel' | 'text' | 'story' = 'post') => {
    setCreateLaunch({ type, step: 'upload' });
    setShowCreateMenu(true);
  };

  const isDarkTheme = db.settings.theme === 'dark';
  const ThemeToggleIcon = isDarkTheme ? Sun : Moon;
  const themeToggleLabel = isDarkTheme ? 'Light mode' : 'Dark mode';

  const toggleAppTheme = () => {
    const next = nextTheme(db.settings.theme);
    applyDocumentTheme(next);
    db.updateSettings({ theme: next });
  };

  const navigateToTab = (tab: Tab) => {
    if (tab === 'notifications') db.setHasUnreadNotifications(false);
    if (tab === 'messages') db.setUnreadMessagesCount(0);
    if (tab === 'karaoke') {
      requestKaraokeStudioOpen();
    }
    setCurrentTab(tab);
  };

  const handleHomeTap = () => {
    if (currentTab === 'home') {
      dispatchTapRefresh('home');
      scrollAppMainToTop();
      showToast('Feed refreshed');
      return;
    }
    navigateToTab('home');
  };

  const handleBottomNavTap = (tab: Tab) => {
    if (tab === 'home' && currentTab === 'home') {
      dispatchTapRefresh('home');
      scrollAppMainToTop();
      showToast('Feed refreshed');
      return;
    }
    navigateToTab(tab);
  };

  const [activeMktTab, setActiveMktTab] = useState('Presets');
  const [purchasedItems, setPurchasedItems] = useState<Record<string, boolean>>({});
  const marketplaceTabsScrollRef = useRef<HTMLDivElement | null>(null);

  const handleBuy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPurchasedItems(prev => ({ ...prev, [id]: true }));
    showToast('Item purchased successfully');
  };

  const scrollMarketplaceTabs = (direction: 'left' | 'right') => {
    const el = marketplaceTabsScrollRef.current;
    if (!el) return;
    const amount = Math.max(200, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const handleChatState = (event: Event) => {
      const customEvent = event as CustomEvent<{ chatOpen?: boolean }>;
      setHideMobileTopNavForChat(!!customEvent.detail?.chatOpen);
    };

    window.addEventListener('messages:chat-open', handleChatState as EventListener);
    return () => {
      window.removeEventListener('messages:chat-open', handleChatState as EventListener);
    };
  }, []);

  useEffect(() => {
    resetMediaOverlayLocks();
    db.setFullScreenActive(false);
    db.setCreatorEditingActive(false);
  }, [db]);

  useEffect(() => {
    db.setCreatorEditingActive(showCreateMenu);
    if (showCreateMenu) {
      pauseAllPlayback();
    }
    return () => {
      db.setCreatorEditingActive(false);
    };
  }, [showCreateMenu, db]);
  
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Explore' },
    { id: 'reels', icon: PlaySquare, label: 'Reels' },
    { id: 'karaoke', icon: MicVocal, label: 'Karaoke' },
    { id: 'messages', icon: MessageCircle, label: 'Messages' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'workspace', icon: LayoutDashboard, label: 'Workspace' },
    { id: 'dating', icon: Heart, label: 'Dating' },
    { id: 'live', icon: Radio, label: 'Live' },
    { id: 'local-games', icon: Gamepad2, label: 'Local Games' },
    { id: 'third-party-games', icon: Globe, label: 'Third Party Games' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
  ];

  const hideShellMobileTopNav =
    hideMobileTopNavForChat || currentTab === 'karaoke' || currentTab === 'rooms';
  const showShellMobileBottomNav =
    !hideMobileTopNavForChat &&
    currentTab !== 'reels' &&
    currentTab !== 'karaoke' &&
    currentTab !== 'rooms';

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden font-sans">
      <PostAudioPlaybackRoot />

      <ShellCreateModal
        open={showCreateMenu}
        onOpenChange={setShowCreateMenu}
        currentUser={currentUser}
        launch={createLaunch}
      />

      {/* Marketplace */}
      <AnimatePresence>
      {showMarketplace && (
        <div 
          id="marketplace-modal" 
          className="fixed inset-y-0 right-0 left-0 md:left-[72px] lg:left-[244px] z-50 flex items-center justify-center bg-background"
          onClick={() => setShowMarketplace(false)}
        >
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="bg-card w-full max-w-4xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 z-10 sticky top-0 bg-background">
              <h2 className="text-2xl font-black vibe-gradient-text logo-font">Creator Marketplace</h2>
              <button onClick={() => setShowMarketplace(false)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
              <div className="flex items-center gap-2 mb-8">
                 <button
                   type="button"
                   onClick={() => scrollMarketplaceTabs('left')}
                   className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-foreground hover:bg-secondary transition-colors"
                   aria-label="Scroll marketplace tabs left"
                   title="Scroll left"
                 >
                   ←
                 </button>
                 <div ref={marketplaceTabsScrollRef} className="flex flex-1 gap-2 overflow-x-auto no-scrollbar pb-2">
                   {['Presets', 'Templates', 'Consultations', 'Merch', 'Digital Goods'].map((cat, i) => (
                     <button 
                       key={i} 
                       onClick={() => setActiveMktTab(cat)}
                       className={`px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${activeMktTab === cat ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}>
                       {cat}
                     </button>
                   ))}
                 </div>
                 <button
                   type="button"
                   onClick={() => scrollMarketplaceTabs('right')}
                   className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-foreground hover:bg-secondary transition-colors"
                   aria-label="Scroll marketplace tabs right"
                   title="Scroll right"
                 >
                   →
                 </button>
              </div>

              <div className="space-y-8">
                  <div>
                    <h3 className="font-bold text-xl mb-4">Trending Presets</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={'trending-'+i} className="border border-border rounded-2xl overflow-hidden p-3 bg-secondary/10 hover:bg-secondary/40 cursor-pointer transition-all group">
                          <div className="aspect-square bg-muted rounded-xl mb-3 overflow-hidden relative">
                            <img src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&fit=crop&sig=${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Product" onError={handleMediaError} />
                            <div className="absolute top-2 right-2 bg-zinc-900/90 text-xs font-bold px-2 py-1 rounded-md text-white">
                              ⭐ 4.9
                            </div>
                          </div>
                          <div className="font-bold text-[15px] leading-tight mb-1 group-hover:text-primary transition-colors">Cinematic Film {i+1}</div>
                          <div className="text-xs text-muted-foreground font-medium mb-2">By @creator_{i+1}</div>
                          <div className="flex items-center justify-between">
                            <div className="font-black">${(10 + i * 7.3).toFixed(2)}</div>
                            <button 
                              onClick={(e) => handleBuy(`preset-${i}`, e)}
                              className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${purchasedItems[`preset-${i}`] ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}
                            >
                              {purchasedItems[`preset-${i}`] ? 'Owned' : 'Buy'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xl mb-4">Recommended for you</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={'rec-'+i} className="border border-border rounded-2xl p-4 flex gap-4 bg-secondary/10 hover:bg-secondary/40 cursor-pointer transition-all">
                           <div className="w-24 h-24 bg-secondary rounded-xl overflow-hidden shrink-0">
                             <img src={`https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200&fit=crop&sig=${i+4}`} className="w-full h-full object-cover" onError={handleMediaError} />
                           </div>
                           <div className="flex flex-col justify-center flex-1">
                              <h4 className="font-bold text-[16px] mb-1">Notion Content Planner</h4>
                              <p className="text-xs text-muted-foreground font-medium mb-3">Complete template for managing your content schedule and sponsorships.</p>
                              <div className="flex items-center justify-between mt-auto">
                                <span className="font-black text-primary">$19.99</span>
                                <span className="text-xs font-bold text-muted-foreground">⭐ 4.8 (120)</span>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      {currentTab !== 'karaoke' && currentTab !== 'rooms' && (
      <div className="hidden md:flex flex-col w-[72px] lg:w-[244px] h-full border-r border-border bg-background pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] px-3 lg:px-4 shrink-0 transition-all relative z-40 overflow-y-auto no-scrollbar">
        {/* Logo */}
        <div className="mb-10 px-2 flex items-center justify-center lg:justify-start">
          <button
            type="button"
            onClick={handleHomeTap}
            className={`${navTapButtonClass} flex items-center justify-center lg:justify-start min-h-[44px]`}
            aria-label={currentTab === 'home' ? 'Refresh feed' : 'Go to home'}
          >
            <span className="lg:hidden flex">
              <span className="font-black text-xl italic font-serif vibe-gradient-text">I</span>
            </span>
            <span className="hidden lg:flex">
              <span className="font-black text-2xl tracking-tighter vibe-gradient-text logo-font font-serif italic">InstaCollab</span>
            </span>
          </button>
        </div>

        {/* Desktop Nav Items */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'home') {
                    handleHomeTap();
                    return;
                  }
                  navigateToTab(item.id as Tab);
                }}
                className={`${navTapRowButtonClass} p-2 hover:text-foreground transition-colors group ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}
              >
                <div className="relative">
                  <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-secondary text-foreground' : 'bg-muted group-hover:bg-foreground group-hover:text-background'}`}>
                    <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 stroke-[2px]`} />
                  </div>
                  {item.id === 'notifications' && db.hasUnreadNotifications && (
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 border-2 border-background bg-red-500 rounded-full"></div>
                  )}
                  {item.id === 'messages' && db.unreadMessagesCount > 0 && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-background">{db.unreadMessagesCount}</div>
                  )}
                </div>
                <span className="hidden lg:block text-[15px]">{item.label}</span>
              </button>
            );
          })}
          
          <button
            type="button"
            onClick={() => openCreator('story')}
            className={`${navTapRowButtonClass} p-2 hover:text-foreground transition-colors group text-muted-foreground font-medium`}
          >
            <div className={`p-2 rounded-xl transition-colors bg-muted group-hover:bg-foreground group-hover:text-background`}>
              <Circle className={`w-5 h-5 transition-transform group-hover:scale-105 stroke-[2px]`} />
            </div>
            <span className="hidden lg:block text-[15px]">Creator</span>
          </button>

          <button
            onClick={() => { openCreator('reel') }}
            className={`flex items-center gap-4 w-full p-2 hover:text-foreground transition-colors group text-muted-foreground font-medium hidden`}
          >
            <div className={`p-2 rounded-xl transition-colors bg-muted group-hover:bg-foreground group-hover:text-background`}>
              <PlaySquare className={`w-5 h-5 transition-transform group-hover:scale-105 stroke-[2px]`} />
            </div>
            <span className="hidden lg:block text-[15px]">Create Reel</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToTab('profile')}
            className={`${navTapRowButtonClass} p-2 hover:text-foreground transition-colors group ${currentTab === 'profile' ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}
          >
            <div className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-colors ${currentTab === 'profile' ? 'border-primary' : 'border-transparent'}`}>
              <img src={currentUser.avatarUrl || undefined} alt="profile" className="w-full h-full object-cover" onError={handleAvatarError} />
            </div>
            <span className="hidden lg:block text-[15px]">Profile</span>
          </button>
        </nav>

        {/* Bottom Menu Button */}
        <div className="mt-auto space-y-2">
          <button type="button" onClick={() => setShowMarketplace(true)} className={`${navTapRowButtonClass} p-2 hover:text-foreground text-muted-foreground font-medium transition-colors group`}>
            <div className="p-2 rounded-xl bg-muted group-hover:bg-foreground group-hover:text-background transition-colors">
              <Store className="w-5 h-5 stroke-[2px]" />
            </div>
            <span className="hidden lg:block text-[15px]">Marketplace</span>
          </button>
          <button type="button" onClick={toggleAppTheme} aria-label={themeToggleLabel} className={`${navTapRowButtonClass} p-2 hover:text-foreground text-muted-foreground font-medium transition-colors group`}>
            <div className="p-2 rounded-xl bg-muted group-hover:bg-foreground group-hover:text-background transition-colors">
              <ThemeToggleIcon className="w-5 h-5 stroke-[2px]" />
            </div>
            <span className="hidden lg:block text-[15px]">{themeToggleLabel}</span>
          </button>
        </div>
      </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative z-10 overflow-x-hidden overflow-y-hidden min-h-0">
        
        {/* Mobile Top Header */}
        {!hideShellMobileTopNav && (
        <div className={`mobile-top-nav md:hidden sticky top-0 left-0 w-full pt-safe z-[100] border-b flex flex-col shrink-0 ${currentTab === 'reels' ? 'bg-black text-white border-zinc-800' : 'bg-background text-foreground border-border shadow-sm'}`}>
             <div className="h-[60px] flex items-center justify-between px-4 w-full">
               <button
                 type="button"
                 onClick={handleHomeTap}
                 className={`${navTapButtonClass} font-black text-2xl tracking-tighter vibe-gradient-text logo-font font-serif italic min-h-[44px]`}
                 aria-label={currentTab === 'home' ? 'Refresh feed' : 'Go to home'}
               >
                 InstaCollab
               </button>
               <div className={`flex items-center gap-1 ${currentTab === 'reels' ? 'text-white' : 'text-foreground'}`}>
                  <button type="button" onClick={() => navigateToTab('workspace')} className={navTapIconButtonClass} aria-label="Workspace">
                    <LayoutDashboard className={`w-6 h-6 stroke-[1.5px] ${currentTab === 'workspace' ? 'stroke-[2.5px]' : ''}`} />
                  </button>
                  <button type="button" onClick={() => navigateToTab('notifications')} className={`${navTapIconButtonClass} relative`} aria-label="Notifications">
                    <Bell className={`w-6 h-6 stroke-[1.5px] ${currentTab === 'notifications' ? 'stroke-[2.5px]' : ''}`} />
                    {db.hasUnreadNotifications && (
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 border-2 border-background bg-red-500 rounded-full"></div>
                    )}
                  </button>
                  <button type="button" onClick={() => navigateToTab('messages')} className={`${navTapIconButtonClass} relative`} aria-label="Messages">
                     <MessageCircle className="w-6 h-6 stroke-[1.5px]" />
                     {db.unreadMessagesCount > 0 && (
                       <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-background">{db.unreadMessagesCount}</div>
                     )}
                  </button>
                  <button type="button" onClick={() => setShowMobileMenu(true)} className={navTapIconButtonClass} aria-label="Open menu">
                     <Menu className="w-6 h-6 stroke-[1.5px]" />
                  </button>
               </div>
             </div>
          </div>
        )}

        <main className={`flex-1 flex flex-col relative w-full ${currentTab === 'rooms' ? 'pt-0' : hideShellMobileTopNav ? 'pt-[env(safe-area-inset-top)]' : ''} bg-transparent ${(currentTab === 'messages' || currentTab === 'karaoke' || currentTab === 'rooms') ? 'overflow-hidden h-full pb-0' : currentTab === 'reels' ? 'overflow-y-auto overflow-x-hidden no-scrollbar pb-0 bg-black' : 'overflow-y-auto overflow-x-hidden no-scrollbar pb-[calc(50px_+_env(safe-area-inset-bottom))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))]'}`}>
          <div className={`w-full flex-1 flex flex-col bg-transparent ${(currentTab === 'messages' || currentTab === 'karaoke' || currentTab === 'rooms') ? 'h-full justify-stretch items-stretch overflow-hidden' : 'items-center'}`}>
               {children}
          </div>
        </main>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            <button
              type="button"
              className="md:hidden fixed inset-0 z-[99] bg-black/40"
              aria-label="Close menu"
              onClick={() => setShowMobileMenu(false)}
            />
            <div id="mobile-menu-modal" className="md:hidden fixed top-0 right-0 h-full z-[100] flex justify-end pointer-events-none">
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="pointer-events-auto relative w-[300px] h-full bg-card/90 backdrop-blur-xl shadow-2xl border-l border-border pt-safe pb-safe flex flex-col"
            >
               <div className="px-6 pb-6 border-b border-border mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-xl">Menu</h3>
                  <button type="button" onClick={() => setShowMobileMenu(false)} className={`${navTapIconButtonClass} text-muted-foreground hover:text-foreground font-bold`} aria-label="Close menu"><X className="w-6 h-6" /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto px-4 space-y-2">
                 {navItems.map((item) => {
                   const Icon = item.icon;
                   const isActive = currentTab === item.id;
                   return (
                     <button
                       key={item.id}
                       type="button"
                       onClick={() => {
                         if (item.id === 'home') {
                           handleHomeTap();
                         } else {
                           navigateToTab(item.id as Tab);
                         }
                         setShowMobileMenu(false);
                       }}
                       className={`${navTapRowButtonClass} p-4 rounded-xl hover:bg-secondary font-bold transition-colors relative ${isActive ? 'text-primary' : 'text-foreground'}`}
                     >
                       <Icon className="w-6 h-6" /> 
                       {item.label}
                       {item.id === 'notifications' && db.hasUnreadNotifications && (
                         <div className="absolute left-[34px] top-4 w-2.5 h-2.5 border-2 border-background bg-red-500 rounded-full"></div>
                       )}
                       {item.id === 'messages' && db.unreadMessagesCount > 0 && (
                         <div className="absolute left-10 top-3 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full border-2 border-background">{db.unreadMessagesCount}</div>
                       )}
                     </button>
                   );
                 })}
                 
                 <button type="button" onClick={() => { setShowMobileMenu(false); openCreator('story'); }} className={`${navTapRowButtonClass} p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground`}>
                   <Circle className="w-6 h-6 text-foreground" /> Creator
                 </button>
                 
                 <button type="button" onClick={() => { setShowMobileMenu(false); openCreator('reel') }} className={`${navTapRowButtonClass} p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground`}>
                   <PlaySquare className="w-6 h-6 text-foreground" /> Create Reel
                 </button>
                 
                 <button type="button" onClick={() => { setShowMobileMenu(false); navigateToTab('profile'); }} className={`${navTapRowButtonClass} p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground`}>
                   <div className={`w-6 h-6 rounded-full overflow-hidden border ${currentTab === 'profile' ? 'border-primary' : 'border-transparent'}`}>
                     <img src={currentUser.avatarUrl || undefined} alt="profile" className="w-full h-full object-cover" onError={handleAvatarError} />
                   </div> Profile
                 </button>

                 <button type="button" onClick={() => { setShowMobileMenu(false); setShowMarketplace(true); }} className={`${navTapRowButtonClass} p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground`}>
                   <Store className="w-6 h-6 text-foreground" /> Marketplace
                 </button>
                 
                 <button type="button" onClick={() => {
                   toggleAppTheme();
                   setShowMobileMenu(false);
                 }} aria-label={themeToggleLabel} className={`${navTapRowButtonClass} p-4 rounded-xl hover:bg-secondary font-bold transition-colors text-foreground`}>
                   <ThemeToggleIcon className="w-6 h-6 text-foreground" /> {themeToggleLabel}
                 </button>
               </div>
            </motion.div>
          </div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      {showShellMobileBottomNav && (
        <div className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 w-full min-h-[50px] pt-1 pb-safe bg-background border-border border-t flex items-center justify-around z-[100] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.35)]">
          <button type="button" onClick={() => handleBottomNavTap('home')} className={navTapIconButtonClass} aria-label="Home">
            <Home className={`w-6 h-6 ${currentTab === 'home' ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
          </button>
          <button type="button" onClick={() => navigateToTab('search')} className={navTapIconButtonClass} aria-label="Explore">
            <Search className={`w-6 h-6 ${currentTab === 'search' ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
          </button>
          <button type="button" onClick={() => openCreator('post')} className={navTapIconButtonClass} aria-label="Create post">
            <PlusSquare className={`w-6 h-6 stroke-[1.5px]`} />
          </button>
          <button type="button" onClick={() => navigateToTab('reels')} className={navTapIconButtonClass} aria-label="Reels">
            <PlaySquare className="w-6 h-6 stroke-[1.5px]" />
          </button>
          <button type="button" onClick={() => navigateToTab('profile')} className={navTapIconButtonClass} aria-label="Profile">
            <div className={`w-7 h-7 rounded-full overflow-hidden ${currentTab === 'profile' ? 'border-foreground border-2' : 'border border-border'}`}>
              <img src={currentUser.avatarUrl || undefined} alt="profile" className="w-full h-full object-cover" onError={handleAvatarError} />
            </div>
          </button>
        </div>
      )}
      <MobileDevConnectBanner />
      <PwaInstallPrompt />
    </div>
  );
}
