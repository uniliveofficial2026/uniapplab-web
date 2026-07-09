import React, { useEffect, useRef } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CreateRoom from '../../smule-rooms/pages/CreateRoom';
import { Room } from '../../smule-rooms/pages/Room';
import EditRoom from '../../smule-rooms/pages/EditRoom';
import RoomDetails from '../../smule-rooms/pages/RoomDetails';
import { RoomSelfProvider } from '../../smule-rooms/context/RoomSelfContext';
import {
  RoomFlowProvider,
  type RoomFlowEntry,
} from '../../smule-rooms/context/RoomFlowContext';
import '../../smule-rooms/smule-rooms.css';
import './karaoke-smule-embed.css';
import './admin-embed-full.css';

function KaraokeFlowBack({ onClose }: { onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    onCloseRef.current();
  }, []);

  return null;
}

/** Keeps verbatim smule pages sized to the embed panel, not the viewport. */
function FlowPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="karaoke-smule-room-stage relative h-full min-h-0 flex flex-col overflow-hidden [&_.h-screen]:!h-full [&_.max-h-screen]:!max-h-full [&_.room-shell]:!h-full [&_.room-shell]:!max-h-full">
      {children}
    </div>
  );
}

/** Same route chrome as smule-rooms/RoomsHost AppContent — verbatim shell, no main nav. */
function AppContent({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const isFullscreen =
    location.pathname.startsWith('/record/') ||
    location.pathname === '/login' ||
    location.pathname === '/subscription' ||
    location.pathname === '/live';

  return (
    <div className="flex w-full h-full min-h-0 min-w-0 flex-1 overflow-hidden relative">
      <div className="karaoke-smule-room-panel-host flex min-h-0 min-w-0 h-full w-full flex-1 overflow-hidden">
        <div
          className={`karaoke-smule-room-panel w-full max-w-full min-w-0 h-full min-h-0 relative flex flex-col overflow-hidden bg-gray-950 ${isFullscreen ? '' : 'md:border-x border-gray-900 shadow-[0_0_40px_rgba(168,85,247,0.1)]'}`}
        >
          <Routes>
            <Route path="/karaoke/party-back" element={<KaraokeFlowBack onClose={onClose} />} />
            <Route path="/party" element={<KaraokeFlowBack onClose={onClose} />} />
            <Route path="/" element={<KaraokeFlowBack onClose={onClose} />} />
            <Route path="/room/create" element={<FlowPageShell><CreateRoom /></FlowPageShell>} />
            <Route path="/room/edit/:id" element={<FlowPageShell><EditRoom /></FlowPageShell>} />
            <Route path="/room/details/:id" element={<FlowPageShell><RoomDetails /></FlowPageShell>} />
            <Route path="/room/:id" element={<FlowPageShell><Room /></FlowPageShell>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

type KaraokeSmuleRoomFlowProps = {
  onClose: () => void;
  initialPath?: string;
  flowKey?: number;
  flowEntry?: RoomFlowEntry;
  /** panel = compact karaoke embed; full = admin iframe fidelity (real live UX) */
  embedVariant?: 'panel' | 'full';
};

/** Smule room pages verbatim — embedded inside KaraokeScreen with Party-tab shell. */
export function KaraokeSmuleRoomFlow({
  onClose,
  initialPath = '/room/create',
  flowKey = 0,
  flowEntry = 'default',
  embedVariant = 'panel',
}: KaraokeSmuleRoomFlowProps) {
  useEffect(() => {
    if (flowEntry === 'admin-embed') return;
    if (!localStorage.getItem('auth_token')) {
      localStorage.setItem('auth_token', 'demo');
    }
  }, [flowEntry]);

  const initialEntries =
    initialPath === '/room/create' || initialPath.startsWith('/room/')
      ? ['/karaoke/party-back', initialPath]
      : [initialPath];
  const initialIndex = initialEntries.length - 1;
  const embedRootClass =
    embedVariant === 'full'
      ? 'karaoke-smule-room-embed-full absolute inset-0 z-[70] font-sans selection:bg-purple-500/30 flex flex-col min-h-0 overflow-hidden bg-black'
      : 'karaoke-smule-room-embed absolute inset-0 z-[70] font-sans selection:bg-purple-500/30 flex flex-col min-h-0 overflow-hidden bg-black';

  return (
    <>
      <div className={embedRootClass} data-embed-variant={embedVariant}>
        <div className="flex-1 min-h-0 flex flex-col">
          <MemoryRouter key={flowKey} initialEntries={initialEntries} initialIndex={initialIndex}>
            <RoomSelfProvider>
              <RoomFlowProvider onExit={onClose} entry={flowEntry}>
                <AppContent onClose={onClose} />
              </RoomFlowProvider>
            </RoomSelfProvider>
          </MemoryRouter>
        </div>
      </div>
      <div
        id="party-room-profile-preview-portal"
        className="fixed inset-0 z-[9998] pointer-events-none"
        aria-hidden
      />
    </>
  );
}
