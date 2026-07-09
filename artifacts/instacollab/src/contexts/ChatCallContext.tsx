import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { useChatCall, type UseChatCallValue } from '../lib/chat/useChatCall';
import { callKindLabel, resolveCallPeer } from '../lib/chat/chatCallKit';
import { db } from '../lib/db/localDb';
import { findUserById, resolveUser } from '../lib/safe';
import { MessagesActiveCallOverlay } from '../components/messages/MessagesActiveCallOverlay';
import { IncomingCallDynamicBanner } from '../components/messages/IncomingCallDynamicBanner';
import { ChatCallPipWindow } from '../components/messages/ChatCallPipWindow';
import { ChatCallMediaHost } from '../components/messages/ChatCallMediaHost';
import { ChatCallVideoEffectsHost } from './ChatCallVideoEffectsHost';
import type { ChatGroup, User } from '../types';

const ChatCallContext = createContext<UseChatCallValue | null>(null);

type CallPresentationProps = {
  chatCall: UseChatCallValue;
  callPeer: User | ChatGroup;
  isGroupCall: boolean;
  currentUserId: string | null | undefined;
  currentUserAvatarUrl?: string;
  showFullOverlay: boolean;
  showPip: boolean;
};

/** Fullscreen + PiP surfaces for one active call session. */
function ChatCallPresentation({
  chatCall,
  callPeer,
  isGroupCall,
  currentUserId,
  currentUserAvatarUrl,
  showFullOverlay,
  showPip,
}: CallPresentationProps) {
  const callControlProps = {
    isMicMuted: chatCall.isMicMuted,
    isCameraEnabled: chatCall.isCameraEnabled,
    onToggleMic: () => void chatCall.toggleMic(),
    onToggleCamera: () => void chatCall.toggleCamera(),
    onFlipCamera: () => void chatCall.flipCamera(),
  };

  const retryConnect =
    chatCall.connectPhase === 'slow' || chatCall.connectPhase === 'failed'
      ? () => void chatCall.retryConnect()
      : undefined;

  const sharedOverlayProps = {
    activeCall: chatCall.callKind,
    phase: chatCall.phase,
    connectPhase: chatCall.connectPhase,
    isGroupCall,
    selectedUser: callPeer,
    currentUserAvatarUrl,
    error: chatCall.error,
    remoteVideoReady: chatCall.remoteVideoReady,
    localVideoStream: chatCall.localVideoStream,
    primaryRemoteStream: chatCall.primaryRemoteStream,
    remoteVideos: chatCall.remoteVideos,
    remoteParticipants: chatCall.remoteParticipants,
    currentUserId,
    onRetryConnect: retryConnect,
    onEndCall: () => void chatCall.endCall(),
    ...callControlProps,
  };

  const fullscreen = showFullOverlay ? (
    <MessagesActiveCallOverlay
      key="call-fullscreen"
      {...sharedOverlayProps}
      onMinimize={chatCall.minimizeCall}
    />
  ) : null;

  const pip = showPip ? (
    <ChatCallPipWindow
      key="call-pip"
      activeCall={chatCall.callKind}
      connectPhase={chatCall.connectPhase}
      isGroupCall={isGroupCall}
      selectedUser={callPeer}
      currentUserAvatarUrl={currentUserAvatarUrl}
      remoteVideoReady={chatCall.remoteVideoReady}
      localVideoStream={chatCall.localVideoStream}
      primaryRemoteStream={chatCall.primaryRemoteStream}
      remoteVideos={chatCall.remoteVideos}
      remoteParticipants={chatCall.remoteParticipants}
      onExpand={chatCall.expandCall}
      onEndCall={() => void chatCall.endCall()}
      {...callControlProps}
    />
  ) : null;

  if (chatCall.callKind === 'video') {
    return (
      <ChatCallVideoEffectsHost
        active
        presentation={chatCall.presentation}
        cameraFacingMode={chatCall.cameraFacingMode}
        mirrorLocalPreview={chatCall.mirrorLocalPreview}
        localVideoStream={chatCall.localVideoStream}
        localStreamRef={chatCall.localStreamRef}
        localVideoRef={chatCall.localVideoRef}
        onReplaceVideoTrack={(track) => {
          void chatCall.replacePublishedVideoTrack(track);
        }}
      >
        <AnimatePresence mode="wait">{fullscreen}</AnimatePresence>
        <AnimatePresence mode="wait">{pip}</AnimatePresence>
      </ChatCallVideoEffectsHost>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">{fullscreen}</AnimatePresence>
      <AnimatePresence mode="wait">{pip}</AnimatePresence>
    </>
  );
}

export function ChatCallProvider({
  children,
  currentUserId,
  currentUserAvatarUrl,
}: {
  children: React.ReactNode;
  currentUserId: string | null | undefined;
  currentUserAvatarUrl?: string;
}) {
  const chatCall = useChatCall(currentUserId);

  const incoming = chatCall.incoming;
  const callChatId = chatCall.activeChatId || incoming?.chatId || null;

  const callPeer = useMemo(() => {
    if (!callChatId) return null;
    return resolveCallPeer(callChatId, incoming?.fromUserId);
  }, [callChatId, incoming?.fromUserId]);

  const isGroupCall = !!(incoming?.isGroup || (callPeer && 'isGroup' in callPeer));

  const incomingDisplay = useMemo(() => {
    if (!incoming) return null;
    const caller = incoming.fromUserId
      ? resolveUser(db.users, findUserById(db.users, incoming.fromUserId))
      : null;
    const dmPeer = callPeer && !('isGroup' in callPeer) ? callPeer : null;
    return {
      name:
        caller?.displayName ||
        caller?.username ||
        dmPeer?.displayName ||
        'Unknown caller',
      avatarUrl: caller?.avatarUrl || dmPeer?.avatarUrl,
    };
  }, [incoming, callPeer]);

  const incomingSubtitle = useMemo(() => {
    if (isGroupCall && callPeer && 'isGroup' in callPeer) {
      const members =
        callPeer.memberIds?.length > 0 ? ` · ${callPeer.memberIds.length} members` : '';
      return `${callPeer.displayName}${members}`;
    }
    return callKindLabel(chatCall.callKind);
  }, [isGroupCall, callPeer, chatCall.callKind]);

  const activeCallSession =
    chatCall.phase === 'outgoing' || chatCall.phase === 'connected';
  const showFullOverlay =
    activeCallSession && chatCall.presentation === 'fullscreen' && Boolean(callPeer);
  const showPip =
    activeCallSession && chatCall.presentation === 'pip' && Boolean(callPeer);
  const showIncomingBanner = chatCall.phase === 'incoming' && incoming && incomingDisplay;
  const showCallPresentation =
    activeCallSession && Boolean(callPeer) && (showFullOverlay || showPip);

  useEffect(() => {
    const defer = () => {
      void import('../lib/chat/chatNotificationBridge').then((m) =>
        m.installChatNotificationBridge(),
      );
      void import('../lib/chat/chatCallNotifications').then((m) => {
        m.installChatCallNotificationBridge();
        void m.requestChatPopoutPermission();
      });
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(defer, { timeout: 12000 });
    } else {
      window.setTimeout(defer, 4000);
    }
  }, []);

  return (
    <ChatCallContext.Provider value={chatCall}>
      {children}
      {activeCallSession ? (
        <ChatCallMediaHost
          remoteAudioRef={chatCall.remoteAudioRef}
          remoteVideoRef={chatCall.remoteVideoRef}
          localVideoRef={chatCall.localVideoRef}
        />
      ) : null}
      <AnimatePresence>
        {showIncomingBanner ? (
          <IncomingCallDynamicBanner
            key={`incoming-${incoming.chatId}`}
            callKind={chatCall.callKind}
            callerName={incomingDisplay.name}
            callerAvatarUrl={incomingDisplay.avatarUrl}
            subtitle={incomingSubtitle}
            onAccept={() => void chatCall.acceptCall()}
            onDecline={() => void chatCall.declineCall()}
          />
        ) : null}
      </AnimatePresence>
      {showCallPresentation && callPeer ? (
        <ChatCallPresentation
          key={`call-session-${callChatId}`}
          chatCall={chatCall}
          callPeer={callPeer}
          isGroupCall={isGroupCall}
          currentUserId={currentUserId}
          currentUserAvatarUrl={currentUserAvatarUrl}
          showFullOverlay={showFullOverlay}
          showPip={showPip}
        />
      ) : null}
    </ChatCallContext.Provider>
  );
}

export function useChatCallContext(): UseChatCallValue {
  const ctx = useContext(ChatCallContext);
  if (!ctx) {
    throw new Error('useChatCallContext must be used within ChatCallProvider');
  }
  return ctx;
}
