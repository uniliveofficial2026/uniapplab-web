/**
 * Smule-clone room shell — mirrors src/App.tsx route chrome from smule-clone.zip (no main nav bars).
 * Page/component files under smule-rooms/ are verbatim from the zip.
 */

import React, { useEffect } from 'react';
import { MemoryRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Party } from './pages/Party';
import { Room } from './pages/Room';
import EditRoom from './pages/EditRoom';
import RoomDetails from './pages/RoomDetails';
import CreateRoom from './pages/CreateRoom';
import { RoomSelfProvider } from './context/RoomSelfContext';
import './smule-rooms.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    return <Navigate to="/party" replace />;
  }
  return children;
}

function OpenMainAppTab({ tab }: { tab: string }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { tab } }));
  }, [tab]);
  return <Navigate to="/party" replace />;
}

function AppContent() {
  const location = useLocation();
  const isFullscreen =
    location.pathname.startsWith('/record/') ||
    location.pathname === '/login' ||
    location.pathname === '/subscription' ||
    location.pathname === '/live';

  return (
    <div className="flex w-full h-[100dvh] bg-black overflow-hidden relative">
      <div className="flex-1 flex justify-center h-full">
        <div
          className={`w-full h-full relative flex flex-col overflow-hidden bg-gray-950 ${isFullscreen ? '' : 'sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl md:border-x border-gray-900 shadow-[0_0_40px_rgba(168,85,247,0.1)]'}`}
        >
          <Routes>
            <Route path="/party" element={<ProtectedRoute><Party /></ProtectedRoute>} />
            <Route path="/room/:id" element={<ProtectedRoute><Room /></ProtectedRoute>} />
            <Route path="/room/edit/:id" element={<ProtectedRoute><EditRoom /></ProtectedRoute>} />
            <Route path="/room/details/:id" element={<ProtectedRoute><RoomDetails /></ProtectedRoute>} />
            <Route path="/room/create" element={<ProtectedRoute><CreateRoom /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/party" replace />} />
            <Route path="/live" element={<Navigate to="/party" replace />} />
            <Route path="/sing" element={<Navigate to="/party" replace />} />
            <Route path="/messages" element={<OpenMainAppTab tab="messages" />} />
            <Route path="/profile" element={<OpenMainAppTab tab="profile" />} />
            <Route path="/discover" element={<OpenMainAppTab tab="search" />} />
            <Route path="/notifications" element={<OpenMainAppTab tab="notifications" />} />
            <Route path="*" element={<Navigate to="/party" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export function RoomsHost({ initialPath = '/party', routerKey = 0 }: { initialPath?: string; routerKey?: number }) {
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      localStorage.setItem('auth_token', 'demo');
    }
  }, []);

  return (
    <MemoryRouter key={routerKey} initialEntries={[initialPath]}>
      <div className="font-sans selection:bg-purple-500/30 h-full w-full">
        <RoomSelfProvider>
          <AppContent />
        </RoomSelfProvider>
      </div>
    </MemoryRouter>
  );
}
