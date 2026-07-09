import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import type { Tab } from '../types';
import { exitNativeVideoPip, tryEnterNativeVideoPip } from '../lib/chat/chatCallPip';
import { RoomLivePipWindow } from '../smule-rooms/components/RoomLivePipWindow';

export type RoomLivePipPresentation = 'fullscreen' | 'pip';

export type RoomLivePipSession = {
  roomId: string;
  roomTitle: string;
  roomMode: string;
  hasVideo: boolean;
  videoStream: MediaStream | null;
  userMicOn: boolean;
  userVoiceActive: boolean;
  voiceEffectLabel?: string;
  onToggleMic: () => void;
  onLeave: () => void;
};

type RoomLivePipContextValue = {
  presentation: RoomLivePipPresentation;
  session: RoomLivePipSession | null;
  updateSession: (patch: Partial<RoomLivePipSession>) => void;
  registerSession: (session: RoomLivePipSession | null) => void;
  minimize: () => void;
  expand: () => void;
  clearSession: () => void;
};

const RoomLivePipContext = createContext<RoomLivePipContextValue | null>(null);

export function useRoomLivePip(): RoomLivePipContextValue {
  const ctx = useContext(RoomLivePipContext);
  if (!ctx) {
    throw new Error('useRoomLivePip must be used within RoomLivePipProvider');
  }
  return ctx;
}

export function useRoomLivePipOptional(): RoomLivePipContextValue | null {
  return useContext(RoomLivePipContext);
}

export function RoomLivePipProvider({
  children,
  currentTab,
}: {
  children: React.ReactNode;
  currentTab: Tab;
}) {
  const [presentation, setPresentation] = useState<RoomLivePipPresentation>('fullscreen');
  const [session, setSession] = useState<RoomLivePipSession | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  const registerSession = useCallback((next: RoomLivePipSession | null) => {
    setSession(next);
    if (!next) {
      setPresentation('fullscreen');
      void exitNativeVideoPip();
    }
  }, []);

  const updateSession = useCallback((patch: Partial<RoomLivePipSession>) => {
    setSession((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    setPresentation('fullscreen');
    void exitNativeVideoPip();
  }, []);

  const minimize = useCallback(() => {
    if (!session) return;
    setPresentation('pip');
    if (session.hasVideo && session.videoStream) {
      void tryEnterNativeVideoPip(pipVideoRef.current);
    }
  }, [session]);

  const expand = useCallback(() => {
    if (!session) return;
    setPresentation('fullscreen');
    void exitNativeVideoPip();
    window.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { tab: 'rooms', roomsPath: `/room/${session.roomId}`, preserveRouter: true },
      }),
    );
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (currentTab !== 'rooms' && presentation === 'fullscreen') {
      setPresentation('pip');
      if (session.hasVideo && session.videoStream) {
        void tryEnterNativeVideoPip(pipVideoRef.current);
      }
    }
  }, [currentTab, presentation, session]);

  useEffect(() => {
    if (presentation !== 'pip' || !session?.hasVideo || !session.videoStream) return;
    const video = pipVideoRef.current;
    if (!video) return;
    if (video.srcObject !== session.videoStream) {
      video.srcObject = session.videoStream;
      void video.play().catch(() => undefined);
    }
    void tryEnterNativeVideoPip(video);
  }, [presentation, session?.hasVideo, session?.videoStream]);

  const value = useMemo(
    () => ({
      presentation,
      session,
      updateSession,
      registerSession,
      minimize,
      expand,
      clearSession,
    }),
    [presentation, session, updateSession, registerSession, minimize, expand, clearSession],
  );

  const showPip = Boolean(session && presentation === 'pip');

  return (
    <RoomLivePipContext.Provider value={value}>
      {children}
      <video ref={pipVideoRef} className="sr-only" playsInline muted autoPlay />
      <AnimatePresence>
        {showPip && session ? (
          <RoomLivePipWindow
            key={`room-pip-${session.roomId}`}
            session={session}
            onExpand={expand}
            onEnd={session.onLeave}
            onToggleMic={session.onToggleMic}
          />
        ) : null}
      </AnimatePresence>
    </RoomLivePipContext.Provider>
  );
}
