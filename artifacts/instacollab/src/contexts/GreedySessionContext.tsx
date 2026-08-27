import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { Tab } from '../types';
import { resolveGreedyTapAppUrl } from '../lib/greedyTap/config';
import {
  postGreedyHostInsets,
  readGreedyHostInsets,
  subscribeGreedyHostInsets,
} from '../lib/greedyTap/hostInsets';
import { startGreedyRealtimeKeepAlive, wakeGreedyRealtimeInBackground } from '../lib/greedyTap/keepAlive';
import { useDB } from '../lib/useDB';
import { resolveUser, safeAvatarUrl } from '../lib/safe';
import { getProfileDisplayName, getProfileHandle } from '../lib/profileDisplay';
import {
  creditUserCoins,
  getLiveCoinsBalance,
  isLocalWalletLedgerAllowed,
  spendWalletCoins,
} from '../lib/walletKstarSync';

export type GreedyPresentation = 'fullscreen' | 'pip';
export type GreedyPipMode = 'off' | 'native' | 'fallback';

type GreedySessionContextValue = {
  active: boolean;
  presentation: GreedyPresentation;
  /** True while Shell Admin Panel has the Greedy admin route open. */
  adminOpen: boolean;
  openFullscreen: () => void;
  /** Fullscreen Greedy Admin — never enters PiP. */
  openAdmin: () => void;
  /** Leave admin → Workspace only (no floating PiP). */
  returnToWorkspace: () => void;
  /** Collapse in-app Greedy play into PiP (admin is excluded). */
  minimizeToPip: (tab?: Tab) => void;
  expand: () => void;
  close: (tab?: Tab) => void;
};

const GreedySessionContext = createContext<GreedySessionContextValue | null>(null);

/** Matches Greedy PipPortal mini-card size (slightly compact, still readable). */
const PIP_WIDTH = 360;
const PIP_HEIGHT = 600;
/** Collapsed floating icon — hide/show the PiP card. */
const ICON_SIZE = 56;

/** Same carrot + meat symbols as the Greedy nav / wheel. */
function GreedyPipIcon({ className }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex h-7 w-7 items-center justify-center ${className ?? ''}`}
      aria-hidden="true"
    >
      <span className="absolute left-0 top-0 text-[14px] leading-none">🥕</span>
      <span className="absolute bottom-0 right-0 text-[14px] leading-none">🍖</span>
    </span>
  );
}

export function useGreedySession(): GreedySessionContextValue {
  const ctx = useContext(GreedySessionContext);
  if (!ctx) {
    throw new Error('useGreedySession must be used within GreedySessionProvider');
  }
  return ctx;
}

export function useGreedySessionOptional(): GreedySessionContextValue | null {
  return useContext(GreedySessionContext);
}

function navigateTab(tab: Tab) {
  window.dispatchEvent(new CustomEvent('navigate', { detail: { tab } }));
}

/**
 * Hosts the Greedy iframe. Home minimizes using the in-game PipPortal mini card.
 * Close tears the session down completely.
 * Card can collapse to a movable icon that show/hides the mini card.
 */
export function GreedySessionProvider({
  children,
  currentTab,
}: {
  children: React.ReactNode;
  currentTab: Tab;
}) {
  const db = useDB();
  const [active, setActive] = useState(false);
  const [presentation, setPresentation] = useState<GreedyPresentation>('fullscreen');
  const [pipMode, setPipMode] = useState<GreedyPipMode>('off');
  const [pipCollapsed, setPipCollapsed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  // Include realtime origin (?rt=) so Socket.IO uses a direct WebSocket backend.
  const appUrl = useMemo(() => resolveGreedyTapAppUrl(), [sessionKey]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevTabRef = useRef(currentTab);
  /** Sync flag: host is in fullscreen Greedy admin (survives React state races). */
  const adminSessionRef = useRef(false);
  /** Sync flag: block enter-pip across admin enter/leave transitions. */
  const blockPipRef = useRef(false);
  const [pipPos, setPipPos] = useState(() => {
    const topInset = readGreedyHostInsets().top;
    return {
      left: Math.max(12, window.innerWidth - PIP_WIDTH - 16),
      top: Math.max(topInset + 56, window.innerHeight - PIP_HEIGHT - 100),
    };
  });
  const pipPosRef = useRef(pipPos);
  pipPosRef.current = pipPos;
  const collapsedRef = useRef(pipCollapsed);
  collapsedRef.current = pipCollapsed;
  const shellRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    dx: number;
    dy: number;
    moved: boolean;
  } | null>(null);
  const dragRafRef = useRef(0);
  const pendingDeltaRef = useRef<{ dx: number; dy: number } | null>(null);

  const currentPipSize = useCallback(() => {
    if (collapsedRef.current) {
      return { width: ICON_SIZE, height: ICON_SIZE };
    }
    return {
      width: Math.min(PIP_WIDTH, window.innerWidth - 24),
      height: Math.min(PIP_HEIGHT, window.innerHeight - 48),
    };
  }, []);

  const clampDelta = useCallback(
    (originLeft: number, originTop: number, rawDx: number, rawDy: number) => {
      const { width, height } = currentPipSize();
      const minTop = Math.max(8, readGreedyHostInsets().top + 4);
      const maxLeft = window.innerWidth - width - 8;
      const maxTop = window.innerHeight - height - Math.max(8, readGreedyHostInsets().bottom + 4);
      const nextLeft = Math.min(maxLeft, Math.max(8, originLeft + rawDx));
      const nextTop = Math.min(maxTop, Math.max(minTop, originTop + rawDy));
      return { dx: nextLeft - originLeft, dy: nextTop - originTop, left: nextLeft, top: nextTop };
    },
    [currentPipSize],
  );

  const paintDragTransform = useCallback(() => {
    dragRafRef.current = 0;
    const pending = pendingDeltaRef.current;
    const el = shellRef.current;
    if (!pending || !el) return;
    el.style.transform = `translate3d(${pending.dx}px, ${pending.dy}px, 0)`;
  }, []);

  const queueDragPaint = useCallback(
    (dx: number, dy: number) => {
      pendingDeltaRef.current = { dx, dy };
      if (dragRafRef.current) return;
      dragRafRef.current = window.requestAnimationFrame(paintDragTransform);
    },
    [paintDragTransform],
  );

  const clearDragTransform = useCallback(() => {
    if (dragRafRef.current) {
      window.cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = 0;
    }
    pendingDeltaRef.current = null;
    const el = shellRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.willChange = '';
    el.style.transition = '';
  }, []);

  const beginDrag = useCallback((startX: number, startY: number) => {
    const el = shellRef.current;
    if (el) {
      el.style.willChange = 'transform';
      el.style.transition = 'none';
      el.style.transform = 'translate3d(0,0,0)';
    }
    dragRef.current = {
      startX,
      startY,
      originLeft: pipPosRef.current.left,
      originTop: pipPosRef.current.top,
      dx: 0,
      dy: 0,
      moved: false,
    };
  }, []);

  const moveDrag = useCallback(
    (x: number, y: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (Math.abs(x - drag.startX) > 3 || Math.abs(y - drag.startY) > 3) {
        drag.moved = true;
      }
      const clamped = clampDelta(drag.originLeft, drag.originTop, x - drag.startX, y - drag.startY);
      drag.dx = clamped.dx;
      drag.dy = clamped.dy;
      queueDragPaint(clamped.dx, clamped.dy);
    },
    [clampDelta, queueDragPaint],
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    const moved = Boolean(drag?.moved);
    if (drag) {
      const clamped = clampDelta(drag.originLeft, drag.originTop, drag.dx, drag.dy);
      setPipPos({ left: clamped.left, top: clamped.top });
    }
    clearDragTransform();
    return moved;
  }, [clampDelta, clearDragTransform]);

  const postToGame = useCallback((payload: Record<string, unknown>) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { source: 'uniapplab-greedy-host', ...payload },
        '*',
      );
    } catch {
      /* ignore */
    }
  }, []);

  const isFullscreenGreedyHost =
    currentTab === 'greedy-tap' && presentation === 'fullscreen' && !pipCollapsed;

  const pushHostInsetsToGame = useCallback(() => {
    postGreedyHostInsets(postToGame, { hostPaddedTop: isFullscreenGreedyHost });
  }, [isFullscreenGreedyHost, postToGame]);

  const pushSessionToGame = useCallback(() => {
    const userId = db.currentUserId;
    if (userId && db.isLoggedIn) {
      const user = resolveUser(db.users, { id: userId });
      const coins = getLiveCoinsBalance(userId);
      const username = getProfileHandle(user) || user.username || userId.slice(0, 8);
      const displayName = getProfileDisplayName(user, username);
      postToGame({
        type: 'session',
        userId,
        username,
        displayName,
        avatarUrl: safeAvatarUrl(user.avatarUrl),
        coins,
        guest: false,
        mode: 'real',
      });
      return;
    }

    // Not signed in — guest sandbox only (no free starter coins; buy to play).
    postToGame({
      type: 'session',
      userId: '',
      username: 'Guest',
      displayName: 'Guest',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=UniLiveGuest',
      coins: 0,
      guest: true,
      mode: 'guest',
    });
  }, [db.currentUserId, db.isLoggedIn, db.users, postToGame]);

  const tearDownAdminNoPip = useCallback(
    (tab: Tab = 'workspace') => {
      blockPipRef.current = true;
      adminSessionRef.current = false;
      setAdminOpen(false);
      postToGame({ type: 'exit-pip' });
      setActive(false);
      setPresentation('fullscreen');
      setPipMode('off');
      setPipCollapsed(false);
      setSessionKey((k) => k + 1);
      navigateTab(tab);
      window.setTimeout(() => {
        blockPipRef.current = false;
      }, 0);
    },
    [postToGame],
  );

  const openFullscreen = useCallback(() => {
    blockPipRef.current = false;
    adminSessionRef.current = false;
    setAdminOpen(false);
    // Wake Render realtime in the background while the iframe boots.
    wakeGreedyRealtimeInBackground();
    setActive((was) => {
      if (!was) setSessionKey((k) => k + 1);
      return true;
    });
    setPresentation('fullscreen');
    setPipMode('off');
    setPipCollapsed(false);
    queueMicrotask(() => {
      postToGame({ type: 'exit-pip' });
      postToGame({ type: 'open-game' });
      pushSessionToGame();
    });
  }, [postToGame, pushSessionToGame]);

  const openAdmin = useCallback(() => {
    // Admin is fullscreen-only — kill any game PiP before showing the panel.
    blockPipRef.current = true;
    adminSessionRef.current = true;
    setAdminOpen(true);
    wakeGreedyRealtimeInBackground();
    setActive((was) => {
      if (!was) setSessionKey((k) => k + 1);
      return true;
    });
    setPresentation('fullscreen');
    setPipMode('off');
    setPipCollapsed(false);
    navigateTab('greedy-tap');
    const kick = () => {
      postToGame({ type: 'exit-pip' });
      pushSessionToGame();
      postToGame({ type: 'open-admin' });
    };
    queueMicrotask(kick);
    window.setTimeout(kick, 400);
    window.setTimeout(kick, 1200);
    window.setTimeout(() => {
      // Keep blocking PiP only for the enter transition; adminSessionRef covers the stay.
      if (adminSessionRef.current) blockPipRef.current = false;
    }, 50);
  }, [postToGame, pushSessionToGame]);

  const minimizeToPip = useCallback(
    (tab: Tab = 'home') => {
      // PiP is in-app Greedy play only — never float or leave admin via PiP.
      if (adminSessionRef.current || adminOpen || blockPipRef.current) {
        tearDownAdminNoPip(tab === 'greedy-tap' ? 'workspace' : tab);
        return;
      }
      setAdminOpen(false);
      setActive(true);
      setPresentation('pip');
      setPipCollapsed(false);
      setPipMode((prev) => (prev === 'native' ? prev : 'fallback'));
      postToGame({ type: 'exit-pip' });
      postToGame({ type: 'open-game' });
      queueMicrotask(() => {
        if (adminSessionRef.current || blockPipRef.current) return;
        postToGame({ type: 'enter-pip' });
      });
      navigateTab(tab);
    },
    [adminOpen, postToGame, tearDownAdminNoPip],
  );

  const expand = useCallback(() => {
    blockPipRef.current = false;
    adminSessionRef.current = false;
    setAdminOpen(false);
    setActive(true);
    setPresentation('fullscreen');
    setPipMode('off');
    setPipCollapsed(false);
    postToGame({ type: 'exit-pip' });
    postToGame({ type: 'open-game' });
    navigateTab('greedy-tap');
  }, [postToGame]);

  /** Leave fullscreen Greedy admin and restore UniLive Workspace — no PiP. */
  const returnToWorkspace = useCallback(() => {
    tearDownAdminNoPip('workspace');
  }, [tearDownAdminNoPip]);

  const close = useCallback(
    (tab?: Tab) => {
      blockPipRef.current = true;
      adminSessionRef.current = false;
      postToGame({ type: 'exit-pip' });
      setAdminOpen(false);
      setActive(false);
      setPresentation('fullscreen');
      setPipMode('off');
      setPipCollapsed(false);
      setSessionKey((k) => k + 1);
      if (tab) navigateTab(tab);
      window.setTimeout(() => {
        blockPipRef.current = false;
      }, 0);
    },
    [postToGame],
  );

  const showPipCard = useCallback(() => {
    setPipCollapsed(false);
  }, []);

  const hidePipCard = useCallback(() => {
    const { width, height } = currentPipSize();
    const nextLeft = Math.min(
      window.innerWidth - ICON_SIZE - 8,
      Math.max(8, pipPosRef.current.left + Math.max(0, width - ICON_SIZE)),
    );
    const nextTop = Math.min(
      window.innerHeight - ICON_SIZE - 8,
      Math.max(8, pipPosRef.current.top + Math.max(0, height - ICON_SIZE)),
    );
    setPipPos({ left: nextLeft, top: nextTop });
    setPipCollapsed(true);
  }, [currentPipSize]);

  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = currentTab;

    // Opening the Greedy tab always brings the live host back (after Close too).
    if (currentTab === 'greedy-tap') {
      wakeGreedyRealtimeInBackground();
      setActive((was) => {
        if (!was) setSessionKey((k) => k + 1);
        return true;
      });
      setPresentation('fullscreen');
      setPipMode('off');
      setPipCollapsed(false);
      queueMicrotask(() => {
        postToGame({ type: 'exit-pip' });
        // Keep admin only if Shell explicitly opened it; otherwise game surface.
        if (adminSessionRef.current || adminOpen) {
          postToGame({ type: 'open-admin' });
        } else {
          postToGame({ type: 'open-game' });
        }
        pushSessionToGame();
      });
      return;
    }

    if (!active) return;
    if (prev === 'greedy-tap' && presentation === 'fullscreen') {
      // Leaving admin (state or sync ref) → Workspace/other tab with NO PiP.
      if (adminOpen || adminSessionRef.current || blockPipRef.current) {
        blockPipRef.current = true;
        adminSessionRef.current = false;
        setAdminOpen(false);
        postToGame({ type: 'exit-pip' });
        setActive(false);
        setPresentation('fullscreen');
        setPipMode('off');
        setPipCollapsed(false);
        setSessionKey((k) => k + 1);
        window.setTimeout(() => {
          blockPipRef.current = false;
        }, 0);
        return;
      }
      // Leaving in-app Greedy game → floating game PiP card only.
      setPresentation('pip');
      setPipCollapsed(false);
      setPipMode((m) => (m === 'native' ? m : 'fallback'));
      postToGame({ type: 'open-game' });
      postToGame({ type: 'enter-pip' });
    }
  }, [active, adminOpen, currentTab, presentation, postToGame, pushSessionToGame]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if ((data as { source?: string }).source !== 'uniapplab-greedy') return;
      const type = (data as { type?: string }).type;
      const tab = ((data as { tab?: string }).tab || 'home') as Tab;

      if (type === 'ready') {
        pushHostInsetsToGame();
        pushSessionToGame();
        // Never push admin into the floating PiP card.
        if (adminSessionRef.current || (adminOpen && presentation === 'fullscreen')) {
          postToGame({ type: 'open-admin' });
        } else if (presentation === 'pip' && !blockPipRef.current && !adminSessionRef.current) {
          postToGame({ type: 'open-game' });
          postToGame({ type: 'enter-pip' });
        }
        return;
      }
      if (type === 'wallet-sync-request') {
        // Game UI asked for the canonical UniLive wallet balance.
        pushHostInsetsToGame();
        pushSessionToGame();
        return;
      }
      if (type === 'request-host-insets') {
        pushHostInsetsToGame();
        return;
      }
      if (type === 'wallet-spend' || type === 'wallet-credit') {
        const requestId = String((data as { requestId?: string }).requestId || '');
        const amount = Number((data as { amount?: number }).amount);
        const userId = db.currentUserId;
        if (!requestId || !userId || !Number.isFinite(amount) || amount <= 0) {
          postToGame({
            type: 'wallet-result',
            requestId,
            ok: false,
            coins: userId ? getLiveCoinsBalance(userId) : 0,
            reason: 'Invalid wallet request',
          });
          return;
        }
        if (!isLocalWalletLedgerAllowed(userId)) {
          postToGame({
            type: 'wallet-result',
            requestId,
            ok: false,
            coins: getLiveCoinsBalance(userId),
            reason: 'Server wallet required',
          });
          return;
        }
        if (type === 'wallet-spend') {
          const ok = spendWalletCoins(userId, Math.floor(amount));
          window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          postToGame({
            type: 'wallet-result',
            requestId,
            ok,
            coins: getLiveCoinsBalance(userId),
            reason: ok ? undefined : 'Not enough coins',
          });
        } else {
          creditUserCoins(userId, Math.floor(amount));
          window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          postToGame({
            type: 'wallet-result',
            requestId,
            ok: true,
            coins: getLiveCoinsBalance(userId),
          });
        }
        return;
      }
      if (type === 'admin-opened') {
        // Host is opening fullscreen admin — never bounce into PiP.
        if (adminSessionRef.current || blockPipRef.current) {
          setAdminOpen(true);
          setPresentation('fullscreen');
          setPipMode('off');
          postToGame({ type: 'exit-pip' });
          return;
        }
        // Ignore admin route while floating game PiP — force game surface instead.
        if (presentation === 'pip') {
          postToGame({ type: 'open-game' });
          postToGame({ type: 'enter-pip' });
          setAdminOpen(false);
          return;
        }
        adminSessionRef.current = true;
        setAdminOpen(true);
        return;
      }
      if (type === 'admin-closed') {
        // Spurious closed while host still wants admin (route flicker) — re-assert.
        if (adminSessionRef.current) {
          postToGame({ type: 'open-admin' });
          return;
        }
        setAdminOpen(false);
        return;
      }
      if (type === 'pip-mode') {
        const mode = (data as { mode?: GreedyPipMode }).mode;
        // Admin session never adopts native/fallback PiP chrome.
        if (adminSessionRef.current || blockPipRef.current || adminOpen) {
          setPipMode('off');
          return;
        }
        if (mode === 'native' || mode === 'fallback' || mode === 'off') {
          setPipMode(mode);
        }
        return;
      }
      if (type === 'pip-collapse') {
        hidePipCard();
        return;
      }
      if (type === 'pip-expand') {
        showPipCard();
        return;
      }
      if (type === 'pip-drag-start') {
        const screenX = (data as { screenX?: number }).screenX;
        const screenY = (data as { screenY?: number }).screenY;
        const clientX = (data as { clientX?: number }).clientX;
        const clientY = (data as { clientY?: number }).clientY;
        const startX = typeof screenX === 'number' ? screenX : clientX;
        const startY = typeof screenY === 'number' ? screenY : clientY;
        if (typeof startX !== 'number' || typeof startY !== 'number') return;
        beginDrag(startX, startY);
        return;
      }
      if (type === 'pip-drag-move') {
        const screenX = (data as { screenX?: number }).screenX;
        const screenY = (data as { screenY?: number }).screenY;
        const clientX = (data as { clientX?: number }).clientX;
        const clientY = (data as { clientY?: number }).clientY;
        const x = typeof screenX === 'number' ? screenX : clientX;
        const y = typeof screenY === 'number' ? screenY : clientY;
        if (typeof x !== 'number' || typeof y !== 'number') return;
        moveDrag(x, y);
        return;
      }
      if (type === 'pip-drag-end') {
        endDrag();
        return;
      }
      if (type === 'pip-closed') {
        // PiP X always tears the session down (same as fullscreen Close).
        close('home');
        return;
      }
      if (type === 'return-workspace') {
        returnToWorkspace();
        return;
      }
      if (type === 'minimize') {
        // PiP is game-only — never float admin; leave admin → Workspace.
        if (adminOpen || adminSessionRef.current || blockPipRef.current) {
          returnToWorkspace();
          return;
        }
        minimizeToPip(tab);
        return;
      }
      if (type === 'close') {
        close(tab);
        return;
      }
      if (type === 'navigate') {
        if (adminOpen || adminSessionRef.current || blockPipRef.current) {
          returnToWorkspace();
          return;
        }
        minimizeToPip(tab);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    adminOpen,
    beginDrag,
    close,
    db.currentUserId,
    endDrag,
    hidePipCard,
    minimizeToPip,
    moveDrag,
    postToGame,
    presentation,
    pushSessionToGame,
    pushHostInsetsToGame,
    returnToWorkspace,
    showPipCard,
  ]);

  // Keep Render realtime warm while Greedy is open (fullscreen or floating PiP).
  useEffect(() => {
    if (!active) return;
    return startGreedyRealtimeKeepAlive();
  }, [active]);

  // Keep Greedy identity/balance aligned with UniLive account + wallet.
  useEffect(() => {
    if (!active) return;
    pushHostInsetsToGame();
    return subscribeGreedyHostInsets(postToGame, () => ({
      hostPaddedTop:
        currentTab === 'greedy-tap' && presentation === 'fullscreen' && !pipCollapsed,
    }));
  }, [active, currentTab, pipCollapsed, postToGame, presentation, pushHostInsetsToGame]);

  useEffect(() => {
    if (!active) return;
    pushSessionToGame();
  }, [active, db.currentUserId, db.isLoggedIn, pushSessionToGame]);

  useEffect(() => {
    if (!active) return;
    const onWallet = () => pushSessionToGame();
    window.addEventListener('wallet-coins-updated', onWallet);
    return () => window.removeEventListener('wallet-coins-updated', onWallet);
  }, [active, pushSessionToGame]);

  // After background/network drops, re-push session so the iframe recovers identity + balance.
  useEffect(() => {
    if (!active) return;
    const resync = () => {
      if (document.visibilityState !== 'visible') return;
      pushSessionToGame();
      postToGame({ type: adminSessionRef.current || adminOpen ? 'open-admin' : 'open-game' });
    };
    const onOnline = () => resync();
    const onVis = () => {
      if (document.visibilityState === 'visible') resync();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, adminOpen, postToGame, pushSessionToGame]);

  useEffect(() => {
    const onBus = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; tab?: Tab }>).detail;
      if (!detail?.action) return;
      if (detail.action === 'open-fullscreen') openFullscreen();
      else if (detail.action === 'open-admin') openAdmin();
      else if (detail.action === 'return-workspace') returnToWorkspace();
      else if (detail.action === 'minimize') {
        // Bus minimize while admin is open must not spawn game PiP.
        if (adminOpen || adminSessionRef.current || blockPipRef.current) returnToWorkspace();
        else minimizeToPip(detail.tab ?? 'home');
      } else if (detail.action === 'close') close(detail.tab);
      else if (detail.action === 'expand') expand();
    };
    window.addEventListener('uniapplab-greedy-session', onBus);
    return () => window.removeEventListener('uniapplab-greedy-session', onBus);
  }, [adminOpen, close, expand, minimizeToPip, openAdmin, openFullscreen, returnToWorkspace]);

  const onIconPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      beginDrag(event.screenX, event.screenY);

      const onMove = (ev: PointerEvent) => moveDrag(ev.screenX, ev.screenY);
      const onUp = () => {
        const moved = endDrag();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (!moved) showPipCard();
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [beginDrag, endDrag, moveDrag, showPipCard],
  );

  const value = useMemo(
    () => ({
      active,
      presentation,
      adminOpen,
      openFullscreen,
      openAdmin,
      returnToWorkspace,
      minimizeToPip,
      expand,
      close,
    }),
    [active, presentation, adminOpen, openFullscreen, openAdmin, returnToWorkspace, minimizeToPip, expand, close],
  );

  const isPip =
    active &&
    !adminOpen &&
    !adminSessionRef.current &&
    !blockPipRef.current &&
    (presentation === 'pip' || currentTab !== 'greedy-tap');
  const nativePip = isPip && pipMode === 'native' && !pipCollapsed;
  const framePip = isPip && !nativePip && !pipCollapsed;
  const iconPip = isPip && pipCollapsed;
  // Full Greedy tab (play or admin): host must fill the viewport (not the 1×1 keep-alive shell).
  const fullscreenHost =
    active &&
    currentTab === 'greedy-tap' &&
    presentation === 'fullscreen' &&
    !pipCollapsed;
  const size = currentPipSize();

  return (
    <GreedySessionContext.Provider value={value}>
      {children}
      {active && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div
                ref={(node) => {
                  if (framePip || nativePip || fullscreenHost) shellRef.current = node;
                }}
                className={
                  nativePip
                    ? 'pointer-events-none fixed h-px w-px overflow-hidden opacity-0'
                    : framePip
                      ? 'fixed z-[380] overflow-hidden rounded-2xl bg-transparent shadow-[0_18px_50px_rgba(0,0,0,0.45)] will-change-transform'
                      : fullscreenHost
                        ? 'fixed inset-0 z-[250] overflow-hidden bg-black'
                        : 'pointer-events-none fixed h-px w-px overflow-hidden opacity-0'
                }
                style={
                  framePip
                    ? {
                        left: pipPos.left,
                        top: pipPos.top,
                        width: size.width,
                        height: size.height,
                        transform: 'translate3d(0,0,0)',
                        backfaceVisibility: 'hidden',
                      }
                    : fullscreenHost
                      ? {
                          inset: 0,
                          paddingTop: 'var(--app-safe-top, env(safe-area-inset-top, 0px))',
                          paddingBottom: 'var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))',
                          paddingLeft: 'var(--app-safe-left, env(safe-area-inset-left, 0px))',
                          paddingRight: 'var(--app-safe-right, env(safe-area-inset-right, 0px))',
                          boxSizing: 'border-box',
                        }
                      : { left: 0, top: 0 }
                }
              >
                <iframe
                  ref={iframeRef}
                  key={sessionKey}
                  title="Greedy"
                  src={appUrl}
                  className="h-full w-full border-0 bg-black"
                  allow="fullscreen; gamepad; autoplay; clipboard-read; clipboard-write; picture-in-picture"
                  loading="eager"
                  onLoad={() => {
                    pushHostInsetsToGame();
                    pushSessionToGame();
                    if (adminSessionRef.current || (adminOpen && presentation === 'fullscreen')) {
                      postToGame({ type: 'open-admin' });
                    } else if (
                      presentation === 'pip' &&
                      !blockPipRef.current &&
                      !adminSessionRef.current
                    ) {
                      postToGame({ type: 'open-game' });
                      postToGame({ type: 'enter-pip' });
                    }
                  }}
                />
              </div>

              {adminOpen && fullscreenHost ? (
                <button
                  type="button"
                  onClick={() => returnToWorkspace()}
                  className="fixed left-3 z-[260] rounded-full border border-white/25 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md hover:bg-black/85"
                  style={{ top: 'max(12px, var(--app-safe-top, env(safe-area-inset-top, 0px)))' }}
                >
                  ← Workspace
                </button>
              ) : null}

              {iconPip ? (
                <button
                  ref={(node) => {
                    shellRef.current = node;
                  }}
                  type="button"
                  title="Show Greedy"
                  aria-label="Show Greedy card"
                  onPointerDown={onIconPointerDown}
                  className="fixed z-[380] flex touch-none items-center justify-center rounded-full border border-white/20 bg-zinc-950/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md will-change-transform active:cursor-grabbing"
                  style={{
                    left: pipPos.left,
                    top: pipPos.top,
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    transform: 'translate3d(0,0,0)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <GreedyPipIcon />
                </button>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </GreedySessionContext.Provider>
  );
}
