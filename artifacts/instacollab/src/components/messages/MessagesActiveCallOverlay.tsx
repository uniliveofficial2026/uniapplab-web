import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  FlipHorizontal2,
  Loader2,
  Minimize2,
  MoreHorizontal,
  Settings,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import type {
  ChatCallKind,
  ChatCallPhase,
  ChatConnectPhase,
  RemoteCallParticipant,
  RemoteCallVideo,
} from '../../lib/chat/chatCallKit';
import { useOptionalChatCallVideoEffects } from '../../contexts/ChatCallVideoEffectsHost';
import { CallVideoSurface } from './CallVideoSurface';
import { ChatCallControls } from './ChatCallControls';
import { AudioCallStage } from './AudioCallStage';
import { GroupVideoCallStage } from './GroupVideoCallStage';
import { OutgoingCallStage } from './OutgoingCallStage';
import {
  EncryptionPill,
  InCallChat,
  SecureLabel,
  StableCallPill,
  VerifiedMark,
  resolveCreatorMetric,
  useCallElapsed,
} from './CallApprovedChrome';
import { openCallMessagesSurface, type CallMessagesSurfaceAction } from '../../lib/chat/callUiNavigation';
import {
  getCallAddFriendButtonLabel,
  isCallAddFriendDisabled,
  performCallAddFriend,
  shouldShowCallAddFriendCard,
  showCallAddFriendToast,
} from '../../lib/chat/callAddFriend';
import { db } from '../../lib/db/localDb';
import { findUserById, resolveUser } from '../../lib/safe';
import './call-approved-ui.css';

type MessagesActiveCallOverlayProps = {
  activeCall: ChatCallKind;
  phase: ChatCallPhase;
  connectPhase?: ChatConnectPhase;
  activeChatId?: string | null;
  connectedAt?: number | null;
  isGroupCall?: boolean;
  selectedUser: User | ChatGroup;
  currentUserAvatarUrl?: string;
  error?: string | null;
  remoteVideoReady?: boolean;
  localVideoStream?: MediaStream | null;
  primaryRemoteStream?: MediaStream | null;
  remoteVideos?: RemoteCallVideo[];
  remoteParticipants?: RemoteCallParticipant[];
  currentUserId?: string | null;
  isMicMuted?: boolean;
  isCameraEnabled?: boolean;
  isSpeakerOn?: boolean;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onFlipCamera?: () => void;
  onToggleSpeaker?: () => void;
  onRetryConnect?: () => void;
  onMinimize?: () => void;
  onEndCall: () => void;
};

function dispatchCallAction(action: string, detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('unilive-call-ui-action', { detail: { action, ...detail } }));
}

export function MessagesActiveCallOverlay({
  activeCall,
  phase,
  connectPhase = 'idle',
  activeChatId = null,
  connectedAt = 0,
  isGroupCall = false,
  selectedUser,
  currentUserAvatarUrl,
  error,
  remoteVideoReady = false,
  localVideoStream = null,
  primaryRemoteStream = null,
  remoteVideos = [],
  remoteParticipants = [],
  currentUserId = null,
  isMicMuted = false,
  isCameraEnabled = true,
  isSpeakerOn = false,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onToggleSpeaker,
  onRetryConnect,
  onMinimize,
  onEndCall,
}: MessagesActiveCallOverlayProps) {
  const videoCall = activeCall === 'video';
  const isGroup = isGroupCall || 'isGroup' in selectedUser;
  const fx = useOptionalChatCallVideoEffects();
  const [moreOpen, setMoreOpen] = useState(false);
  const [, setSocialRevision] = useState(0);
  const elapsed = useCallElapsed(connectedAt);
  const hasRemoteVideo = videoCall && remoteVideoReady && Boolean(primaryRemoteStream);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setSocialRevision((value) => value + 1);
    });
    return () => {
      unsub();
    };
  }, []);

  const peerUserId =
    !isGroup && selectedUser && 'id' in selectedUser ? String(selectedUser.id || '').trim() : '';
  const peerUser = peerUserId ? resolveUser(db.users, findUserById(db.users, peerUserId)) : null;

  const handleAddFriend = () => {
    if (!peerUserId) return;
    const result = performCallAddFriend(peerUserId);
    showCallAddFriendToast(result, peerUser?.displayName || peerUser?.username);
  };

  const localDisplayStream =
    videoCall && fx
      ? fx.resolveLocalDisplayStream(isCameraEnabled, localVideoStream)
      : isCameraEnabled
        ? localVideoStream
        : null;

  const actionDetail = {
    chatId: activeChatId || selectedUser.id,
    peerId: !isGroup ? selectedUser.id : undefined,
    groupId: isGroup ? selectedUser.id : undefined,
    callKind: activeCall,
  };

  const handleGift = () => dispatchCallAction('gift', actionDetail);
  const handleSticker = () => dispatchCallAction('sticker', actionDetail);
  const openMessagesSurface = (action: CallMessagesSurfaceAction) => {
    const chatId = String(actionDetail.chatId || '').trim();
    if (!chatId) return;
    // The call remains alive. We minimize to the existing PiP presentation and open
    // the SAME canonical Messages chat/group; no second in-call message store exists.
    onMinimize?.();
    openCallMessagesSurface({
      action,
      chatId,
      groupId: actionDetail.groupId,
      peerId: actionDetail.peerId,
      callKind: activeCall,
    });
  };
  const handleInvite = () => openMessagesSurface('invite');
  const handleMembers = () => openMessagesSurface('members');
  const handleRequests = () => openMessagesSurface('requests');
  const handleSettings = () => openMessagesSurface('settings');
  const handleReport = () => openMessagesSurface('report');
  const handleChat = () => openMessagesSurface('chat');

  const statusLabel =
    phase === 'connected'
      ? 'Connected'
      : connectPhase === 'slow'
        ? 'Slow connection — still connecting…'
        : connectPhase === 'failed'
          ? 'Could not connect'
          : 'Connecting…';

  if (phase === 'outgoing') {
    return (
      <OutgoingCallStage
        callKind={activeCall}
        selectedUser={selectedUser}
        isGroup={isGroup}
        isMicMuted={isMicMuted}
        isCameraEnabled={isCameraEnabled}
        isSpeakerOn={isSpeakerOn}
        localVideoStream={localDisplayStream}
        currentUserAvatarUrl={currentUserAvatarUrl}
        mirrorLocalPreview={fx?.mirrorLocalPreview ?? true}
        connectPhase={connectPhase}
        error={error}
        onToggleMic={() => void onToggleMic?.()}
        onToggleCamera={videoCall ? () => void onToggleCamera?.() : undefined}
        onFlipCamera={videoCall ? () => void onFlipCamera?.() : undefined}
        onToggleSpeaker={() => void onToggleSpeaker?.()}
        onBeauty={videoCall ? () => fx?.toggleBeautyPanel() : undefined}
        onCancel={onEndCall}
        onRetry={onRetryConnect}
        onAddFriend={peerUserId ? handleAddFriend : undefined}
        addFriendLabel={peerUserId ? getCallAddFriendButtonLabel(peerUserId) : 'Add Friend'}
        addFriendDisabled={peerUserId ? isCallAddFriendDisabled(peerUserId) : false}
        showAddFriendCard={peerUserId ? shouldShowCallAddFriendCard(peerUserId) : false}
      />
    );
  }

  if (!videoCall) {
    return (
      <div className="call-approved-screen" data-ui-id={isGroup ? 'call.group.audio.screen' : 'call.1v1.audio.screen'}>
        <AudioCallStage
          phase={phase}
          connectPhase={connectPhase}
          isGroup={isGroup}
          selectedUser={selectedUser}
          activeChatId={activeChatId}
          connectedAt={connectedAt}
          currentUserAvatarUrl={currentUserAvatarUrl}
          currentUserId={currentUserId}
          remoteParticipants={remoteParticipants}
          statusLabel={statusLabel}
          error={error}
          isMicMuted={isMicMuted}
          onRetryConnect={onRetryConnect}
          onMore={() => setMoreOpen((open) => !open)}
        />
        <div className="mx-auto w-full max-w-[540px] px-3 pb-[max(12px,var(--app-safe-bottom,0px))]">
          <ChatCallControls
            callKind="audio"
            isMicMuted={isMicMuted}
            isCameraEnabled={false}
            isSpeakerOn={isSpeakerOn}
            isGroupCall={isGroup}
            onToggleMic={() => void onToggleMic?.()}
            onToggleCamera={() => undefined}
            onToggleSpeaker={() => void onToggleSpeaker?.()}
            onEndCall={onEndCall}
            onInvite={handleInvite}
            onMore={() => setMoreOpen((open) => !open)}
          />
        </div>
        {moreOpen ? (
          <CallMoreSheet
            video={false}
            onClose={() => setMoreOpen(false)}
            onMinimize={onMinimize}
            onReport={handleReport}
          />
        ) : null}
      </div>
    );
  }

  if (isGroup) {
    const group = selectedUser as ChatGroup;
    const memberIds = group.memberIds || [];
    const memberCount = Math.max(memberIds.length, remoteParticipants.length + 1);
    return (
      <div className="call-approved-screen" data-ui-id="call.group.video.active">
        <div className="call-approved-mobile-shell flex min-h-full flex-col gap-3">
          <div className="call-approved-topbar">
            <button type="button" onClick={onMinimize} aria-label="Minimize call"><ArrowLeft className="h-5 w-5" /></button>
            <div>
              <div className="flex items-center gap-2">
                <span className="brand">UniLive’s</span>
                <span className="tag">GROUP CALL</span>
              </div>
              <SecureLabel />
            </div>
            <span className="grow" />
            <StableCallPill elapsed={elapsed} memberCount={memberCount} />
            <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-label="More call options"><MoreHorizontal className="h-5 w-5" /></button>
          </div>

          <div className="call-approved-audio-header">
            <div>
              <h1>Group Call</h1>
              <p>ID: {group.id}</p>
            </div>
            <button type="button" onClick={() => dispatchCallAction('speaker-view', actionDetail)} className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs text-white">
              ▦&nbsp;&nbsp; Speaker View
            </button>
          </div>

          <GroupVideoCallStage
            remoteVideos={remoteVideos}
            remoteParticipants={remoteParticipants}
            localStream={localDisplayStream}
            currentUserId={currentUserId}
            currentUserAvatarUrl={currentUserAvatarUrl}
            groupMemberIds={memberIds}
            hostUserId={group.createdBy}
            localLabel="You"
          />

          <div className="call-approved-group-lower">
            <InCallChat chatId={activeChatId || group.id} currentUserId={currentUserId} maxMessages={3} />
            <div className="call-approved-group-actions">
              <button type="button" onClick={handleMembers}><Users className="h-5 w-5" /><span>Members<br />{memberCount}</span></button>
              <button type="button" onClick={handleInvite}><UserPlus className="h-5 w-5" /><span>Invite</span></button>
              <button type="button" onClick={handleRequests}><Users className="h-5 w-5" /><span>Requests</span></button>
              <button type="button" onClick={handleSettings}><Settings className="h-5 w-5" /><span>Settings</span></button>
            </div>
          </div>

          <ChatCallControls
            callKind="video"
            isMicMuted={isMicMuted}
            isCameraEnabled={isCameraEnabled}
            isSpeakerOn={isSpeakerOn}
            isGroupCall
            onToggleMic={() => void onToggleMic?.()}
            onToggleCamera={() => void onToggleCamera?.()}
            onFlipCamera={() => void onFlipCamera?.()}
            onToggleSpeaker={() => void onToggleSpeaker?.()}
            onEndCall={onEndCall}
            onGift={handleGift}
            onEffects={() => fx?.toggleDeeparPanel()}
            onSticker={handleSticker}
            onBeauty={() => fx?.toggleBeautyPanel()}
            onChat={handleChat}
            onMore={() => setMoreOpen((open) => !open)}
          />

          {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
        </div>
        {moreOpen ? (
          <CallMoreSheet
            video
            onClose={() => setMoreOpen(false)}
            onFlipCamera={onFlipCamera}
            onMinimize={onMinimize}
            onReport={handleReport}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="call-approved-screen call-approved-screen--active-video" data-ui-id="call.1v1.video.active">
      <div className="call-approved-video-root">
        {hasRemoteVideo && primaryRemoteStream ? (
          <CallVideoSurface stream={primaryRemoteStream} layout="fullscreen" framing="cover" label={`${selectedUser.displayName} camera`} />
        ) : (
          <img
            src={selectedUser.avatarUrl || undefined}
            alt={selectedUser.displayName}
            className="absolute inset-0 h-full w-full object-cover"
            onError={handleAvatarError}
          />
        )}

        <div className="call-approved-video-header">
          <div className="call-approved-video-brand">
            <button type="button" onClick={onMinimize} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35" aria-label="Minimize call">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <strong>UniLive’s</strong>
              <span className="sub"><SecureLabel compact /></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StableCallPill elapsed={elapsed} />
            <button type="button" onClick={() => setMoreOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30" aria-label="More call options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="call-approved-video-identity">
          <strong>{selectedUser.displayName}<VerifiedMark /></strong>
          <span>{resolveCreatorMetric(selectedUser) ? `🌸 ${resolveCreatorMetric(selectedUser)}` : statusLabel}</span>
        </div>

        <div className="call-approved-video-pip" data-ui-id="call.1v1.video.local-pip">
          {localDisplayStream ? (
            <CallVideoSurface stream={localDisplayStream} mirrored={fx?.mirrorLocalPreview ?? true} layout="fill" framing="cover" label="Your camera" />
          ) : (
            <img src={currentUserAvatarUrl || undefined} alt="You" className="h-full w-full object-cover" onError={handleAvatarError} />
          )}
          <div className="label"><strong>You</strong><span>{isCameraEnabled ? 'Camera on' : 'Camera off'}</span></div>
        </div>

        {connectPhase !== 'connected' || error ? (
          <div className="absolute left-1/2 top-[42%] z-[8] -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-xs text-white backdrop-blur-md">
            {(connectPhase === 'connecting' || connectPhase === 'slow') ? <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> : null}
            {error || statusLabel}
          </div>
        ) : null}

        <div className="call-approved-video-bottom">
          <EncryptionPill />
          <ChatCallControls
            callKind="video"
            isMicMuted={isMicMuted}
            isCameraEnabled={isCameraEnabled}
            isSpeakerOn={isSpeakerOn}
            onToggleMic={() => void onToggleMic?.()}
            onToggleCamera={() => void onToggleCamera?.()}
            onFlipCamera={() => void onFlipCamera?.()}
            onToggleSpeaker={() => void onToggleSpeaker?.()}
            onEndCall={onEndCall}
            onGift={handleGift}
            onEffects={() => fx?.toggleDeeparPanel()}
            onSticker={handleSticker}
            onBeauty={() => fx?.toggleBeautyPanel()}
            onChat={handleChat}
            onMore={() => setMoreOpen((open) => !open)}
          />
        </div>

        {moreOpen ? (
          <CallMoreSheet
            video
            onClose={() => setMoreOpen(false)}
            onFlipCamera={onFlipCamera}
            onMinimize={onMinimize}
            onReport={handleReport}
          />
        ) : null}
      </div>
    </div>
  );
}

function CallMoreSheet({
  video,
  onClose,
  onFlipCamera,
  onMinimize,
  onReport,
}: {
  video: boolean;
  onClose: () => void;
  onFlipCamera?: () => void;
  onMinimize?: () => void;
  onReport: () => void;
}) {
  return (
    <div className="fixed inset-x-3 bottom-[100px] z-[240] mx-auto max-w-[500px] rounded-[24px] border border-white/10 bg-[#090e1d]/95 p-3 shadow-2xl backdrop-blur-xl" data-ui-id="call.more.sheet">
      <div className="grid grid-cols-3 gap-2">
        {video ? (
          <button type="button" onClick={() => { onFlipCamera?.(); onClose(); }} className="flex flex-col items-center gap-2 rounded-2xl bg-white/[.04] p-3 text-xs">
            <FlipHorizontal2 className="h-5 w-5" /> Flip camera
          </button>
        ) : null}
        <button type="button" onClick={() => { onMinimize?.(); onClose(); }} className="flex flex-col items-center gap-2 rounded-2xl bg-white/[.04] p-3 text-xs">
          <Minimize2 className="h-5 w-5" /> Minimize
        </button>
        <button type="button" onClick={() => { onReport(); onClose(); }} className="flex flex-col items-center gap-2 rounded-2xl bg-white/[.04] p-3 text-xs">
          <ShieldAlert className="h-5 w-5" /> Report
        </button>
      </div>
      <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl bg-white/[.04] py-2 text-xs text-white/70">Close</button>
    </div>
  );
}
