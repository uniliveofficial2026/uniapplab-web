/**
 * Thin chat-call host — mounts Shell immediately; loads heavy call UI/LiveKit path async.
 * Does not statically import useChatCall / livekit / call overlays.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { UseChatCallValue } from '../lib/chat/chatCallTypes';
import { isLiveKitConfigured } from '../lib/livekit/livekitConfig';

const noopAsync = async () => undefined;
const noop = () => undefined;

/** Placeholder until ChatCallProviderImpl hydrates — same shape, no LiveKit. */
export const IDLE_CHAT_CALL_VALUE: UseChatCallValue = {
  phase: 'idle',
  connectPhase: 'idle',
  presentation: 'fullscreen',
  callKind: 'audio',
  activeChatId: null,
  incoming: null,
  error: null,
  remoteVideoReady: false,
  localVideoStream: null,
  primaryRemoteStream: null,
  remoteVideos: [],
  remoteParticipants: [],
  isMicMuted: false,
  isCameraEnabled: true,
  cameraFacingMode: 'user',
  mirrorLocalPreview: true,
  localVideoRef: { current: null },
  remoteVideoRef: { current: null },
  remoteAudioRef: { current: null },
  localStreamRef: { current: null },
  replacePublishedVideoTrack: noopAsync,
  startCall: noop,
  startAudioCall: noop,
  startVideoCall: noop,
  joinGroupCall: noopAsync,
  acceptCall: noopAsync,
  declineCall: noopAsync,
  endCall: noopAsync,
  retryConnect: noopAsync,
  minimizeCall: noop,
  expandCall: noop,
  toggleMic: noopAsync,
  toggleCamera: noopAsync,
  flipCamera: noopAsync,
  isLiveKitConfigured: isLiveKitConfigured(),
};

export const ChatCallContext = createContext<UseChatCallValue | null>(null);

export function useChatCallContext(): UseChatCallValue {
  const ctx = useContext(ChatCallContext);
  if (!ctx) {
    throw new Error('useChatCallContext must be used within ChatCallProvider');
  }
  return ctx;
}

type ProviderProps = {
  children: React.ReactNode;
  currentUserId: string | null | undefined;
  currentUserAvatarUrl?: string;
  pendingCallRef?: React.MutableRefObject<{
    chatId: string;
    kind: 'audio' | 'video';
    mode: 'start' | 'join';
  } | null>;
};

type ImplComponent = React.ComponentType<ProviderProps>;

/**
 * Renders children immediately with an idle call context, then swaps in the
 * real provider (overlays + LiveKit-capable hook) once its chunk loads.
 */
export function ChatCallProviderHost({
  children,
  currentUserId,
  currentUserAvatarUrl,
}: ProviderProps) {
  const [Impl, setImpl] = useState<ImplComponent | null>(null);
  const pendingRef = useRef<{
    chatId: string;
    kind: 'audio' | 'video';
    mode: 'start' | 'join';
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('./ChatCallProviderImpl').then((m) => {
      if (!cancelled) setImpl(() => m.ChatCallProviderImpl);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Impl) {
    const idle: UseChatCallValue = {
      ...IDLE_CHAT_CALL_VALUE,
      startCall: (chatId, kind) => {
        pendingRef.current = { chatId, kind, mode: 'start' };
        void import('./ChatCallProviderImpl').then((m) => setImpl(() => m.ChatCallProviderImpl));
      },
      startAudioCall: (chatId) => {
        pendingRef.current = { chatId, kind: 'audio', mode: 'start' };
        void import('./ChatCallProviderImpl').then((m) => setImpl(() => m.ChatCallProviderImpl));
      },
      startVideoCall: (chatId) => {
        pendingRef.current = { chatId, kind: 'video', mode: 'start' };
        void import('./ChatCallProviderImpl').then((m) => setImpl(() => m.ChatCallProviderImpl));
      },
      joinGroupCall: async (chatId, kind) => {
        pendingRef.current = { chatId, kind, mode: 'join' };
        void import('./ChatCallProviderImpl').then((m) => setImpl(() => m.ChatCallProviderImpl));
      },
      isLiveKitConfigured: isLiveKitConfigured(),
    };
    return <ChatCallContext.Provider value={idle}>{children}</ChatCallContext.Provider>;
  }

  return (
    <Impl
      currentUserId={currentUserId}
      currentUserAvatarUrl={currentUserAvatarUrl}
      pendingCallRef={pendingRef}
    >
      {children}
    </Impl>
  );
}
