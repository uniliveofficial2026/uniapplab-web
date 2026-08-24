/**
 * Canonical call state → UI view model. Does not mint LiveKit tokens or change membership.
 */
import type { UseChatCallValue } from '../../lib/chat/chatCallTypes';
import type { CallSurfaceActions, CallSurfaceViewModel } from '../../presentation/calls/callSurfaceContract';

export function toCallSurfaceViewModel(call: UseChatCallValue, callId = call.activeChatId || 'unknown'): CallSurfaceViewModel {
  const state: CallSurfaceViewModel['state'] =
    call.connectPhase === 'failed' || call.error
      ? 'failed'
      : call.phase === 'incoming'
        ? 'incoming'
        : call.phase === 'outgoing'
          ? call.connectPhase === 'connecting' || call.connectPhase === 'slow'
            ? 'connecting'
            : 'outgoing'
          : call.phase === 'connected'
            ? call.connectPhase === 'connecting'
              ? 'reconnecting'
              : 'active'
            : call.phase === 'ended'
              ? 'ended'
              : 'connecting';
  return {
    callId,
    callType: call.callKind === 'audio' ? 'audio' : 'video',
    state,
    participants: (call.remoteParticipants || []).map((p) => ({
      participantId: p.participantId,
      displayName: p.participantName || 'Caller',
      isLocal: false,
      micMuted: !p.hasAudio,
      cameraEnabled: Boolean(call.remoteVideos?.some((v) => v.participantId === p.participantId)),
      networkQuality: 'unknown',
    })),
    localMedia: {
      micMuted: call.isMicMuted,
      cameraEnabled: call.isCameraEnabled,
      facingMode: call.cameraFacingMode,
    },
    permissions: {
      canToggleMic: true,
      canToggleCamera: call.callKind !== 'audio',
      canSwitchCamera: call.callKind !== 'audio',
      canShareScreen: false,
      canInvite: true,
      canEnd: true,
    },
    durationMs: call.connectedAt ? Math.max(0, Date.now() - call.connectedAt) : 0,
    networkQuality: 'unknown',
    errorCode: call.error || undefined,
  };
}

export function toCallSurfaceActions(call: UseChatCallValue): CallSurfaceActions {
  return {
    accept: () => void call.acceptCall(),
    reject: () => void call.declineCall(),
    end: () => void call.endCall(),
    toggleMicrophone: () => void call.toggleMic(),
    toggleCamera: () => void call.toggleCamera(),
    switchCamera: () => void call.flipCamera(),
    toggleSpeaker: () => void call.toggleSpeaker(),
    invite: () => undefined,
    minimize: () => call.minimizeCall(),
    retry: () => void call.retryConnect(),
  };
}
