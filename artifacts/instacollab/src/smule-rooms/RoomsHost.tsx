/**
 * Smule-clone room shell — mirrors src/App.tsx route chrome from smule-clone.zip (no main nav bars).
 * Page/component files under smule-rooms/ are verbatim from the zip.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Party } from './pages/Party';
import { Room } from './pages/Room';
import EditRoom from './pages/EditRoom';
import RoomDetails from './pages/RoomDetails';
import CreateRoom from './pages/CreateRoom';
import { RoomSelfProvider } from './context/RoomSelfContext';
import { RoomFlowProvider } from './context/RoomFlowContext';
import type { RoomFlowEntry } from './context/RoomFlowContext';
import type { PendingLiveRoomOpen } from '../lib/live/pendingLiveRoomOpen';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import './smule-rooms.css';

import { db } from '../lib/db/localDb';
import { hasInstantSessionCache } from '../lib/instantCachePolicy';

/** Recoverable room fallback — a room/beauty crash must never blank the whole app. */
function RoomsCrashFallback({ onExit }: { onExit: () => void }) {
  return (
    <div className="flex h-full min-h-[40vh] w-full flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white">
      <p className="text-lg font-bold">This room hit a snag</p>
      <p className="max-w-md text-sm text-white/70">
        The live room stopped unexpectedly. Your app is fine — head back and try again.
      </p>
      <button
        type="button"
        onClick={onExit}
        className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"
      >
        Back
      </button>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(() => hasInstantSessionCache() || db.isLoggedIn);
  const [loggedIn, setLoggedIn] = React.useState(() => db.isLoggedIn);

  React.useEffect(() => {
    let cancelled = false;
    void db.whenStorageReady().then(() => {
      if (!cancelled) {
        setLoggedIn(db.isLoggedIn);
        setReady(true);
      }
    });
    const unsub = db.subscribe(() => setLoggedIn(db.isLoggedIn));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!ready) return null;
  if (!loggedIn) {
    return <Navigate to="/party" replace />;
  }
  return <>{children}</>;
}

function OpenMainAppTab({ tab }: { tab: string }) {
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { tab } }));
  }, [tab]);
  return <Navigate to="/party" replace />;
}

/** In-router navigation when Live discovery opens a room while Rooms tab is already mounted. */
function RoomsLiveOpenBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<PendingLiveRoomOpen>).detail;
      const path = detail?.path?.trim();
      if (!path) return;
      navigate(path);
    };
    window.addEventListener('rooms-live-open', onOpen);
    return () => window.removeEventListener('rooms-live-open', onOpen);
  }, [navigate]);

  return null;
}

function AppContent({
  flowEntry,
  onFlowExit,
}: {
  flowEntry: RoomFlowEntry;
  onFlowExit: () => void;
}) {
  const location = useLocation();
  const isFullscreen =
    location.pathname.startsWith('/record/') ||
    location.pathname === '/login' ||
    location.pathname === '/subscription' ||
    location.pathname === '/live' ||
    location.pathname.startsWith('/room/');

  return (
    <RoomFlowProvider onExit={onFlowExit} entry={flowEntry}>
      <RoomsLiveOpenBridge />
      <div className="flex w-full h-vv max-h-vv bg-black overflow-hidden relative min-h-0">
        <div className="flex-1 flex justify-center h-full">
          <div
            className={`w-full h-full relative flex flex-col overflow-hidden bg-gray-950 ${isFullscreen ? '' : 'sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl md:border-x border-gray-900 shadow-[0_0_40px_rgba(168,85,247,0.1)]'}`}
          >
            <ErrorBoundary screen="rooms" fallback={<RoomsCrashFallback onExit={onFlowExit} />}>
            <Routes>
              <Route path="/party" element={<Party />} />
              <Route path="/room/:id" element={<RequireAuth><Room /></RequireAuth>} />
              <Route path="/room/edit/:id" element={<RequireAuth><EditRoom /></RequireAuth>} />
              <Route path="/room/details/:id" element={<RequireAuth><RoomDetails /></RequireAuth>} />
              <Route path="/room/create" element={<RequireAuth><CreateRoom /></RequireAuth>} />
              <Route path="/" element={<Navigate to="/party" replace />} />
              <Route path="/live" element={<Navigate to="/party" replace />} />
              <Route path="/sing" element={<Navigate to="/party" replace />} />
              <Route path="/messages" element={<OpenMainAppTab tab="messages" />} />
              <Route path="/profile" element={<OpenMainAppTab tab="profile" />} />
              <Route path="/discover" element={<OpenMainAppTab tab="search" />} />
              <Route path="/notifications" element={<OpenMainAppTab tab="notifications" />} />
              <Route path="*" element={<Navigate to="/party" replace />} />
            </Routes>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </RoomFlowProvider>
  );
}

function resolveRoomFlowFromPending(
  pending: PendingLiveRoomOpen | null,
): { entry: RoomFlowEntry; onExit: () => void } {
  if (pending?.entry === 'live-discovery') {
    return {
      entry: 'live-discovery',
      onExit: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'live' } }));
      },
    };
  }
  return {
    entry: 'default',
    onExit: () => {
      window.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { tab: 'rooms', roomsPath: '/party', preserveRouter: true },
        }),
      );
    },
  };
}

export function RoomsHost({ initialPath = '/party', routerKey = 0 }: { initialPath?: string; routerKey?: number }) {
  const [flow] = useState(() => {
    try {
      const raw = sessionStorage.getItem('pendingLiveRoomOpen');
      const pending = raw ? (JSON.parse(raw) as PendingLiveRoomOpen) : null;
      return resolveRoomFlowFromPending(pending);
    } catch {
      return resolveRoomFlowFromPending(null);
    }
  });

  const flowProps = useMemo(
    () => ({ flowEntry: flow.entry, onFlowExit: flow.onExit }),
    [flow.entry, flow.onExit],
  );

  return (
    <MemoryRouter key={routerKey} initialEntries={[initialPath]}>
      <div className="font-sans selection:bg-purple-500/30 h-full w-full">
        <RoomSelfProvider>
          <AppContent {...flowProps} />
        </RoomSelfProvider>
      </div>
    </MemoryRouter>
  );
}
