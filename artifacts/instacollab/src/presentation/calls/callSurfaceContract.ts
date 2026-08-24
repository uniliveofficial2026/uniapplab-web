/**
 * Replaceable call UI contract. Presentation only — no LiveKit tokens, identity, or membership.
 */
export type CallParticipantViewModel = {
  participantId: string;
  displayName: string;
  isLocal: boolean;
  micMuted: boolean;
  cameraEnabled: boolean;
  networkQuality: string;
};

export type LocalMediaViewModel = {
  micMuted: boolean;
  cameraEnabled: boolean;
  facingMode: 'user' | 'environment' | string;
};

export type CallUiPermissions = {
  canToggleMic: boolean;
  canToggleCamera: boolean;
  canSwitchCamera: boolean;
  canShareScreen: boolean;
  canInvite: boolean;
  canEnd: boolean;
};

export type CallSurfaceViewModel = {
  callId: string;
  callType: 'audio' | 'video';
  state:
    | 'incoming'
    | 'outgoing'
    | 'ringing'
    | 'connecting'
    | 'active'
    | 'reconnecting'
    | 'ended'
    | 'failed';
  participants: CallParticipantViewModel[];
  localMedia: LocalMediaViewModel;
  permissions: CallUiPermissions;
  durationMs: number;
  networkQuality: string;
  errorCode?: string;
};

export type CallSurfaceActions = {
  accept(): void;
  reject(): void;
  end(): void;
  toggleMicrophone(): void;
  toggleCamera(): void;
  switchCamera(): void;
  toggleSpeaker(): void;
  invite(): void;
  minimize(): void;
  retry(): void;
};

export const CALL_UI_CONTRACT_ID = 'contract.call.surface.v1' as const;
export const CALL_SURFACE_COMPONENT_IDS = [
  'call.incoming.v1',
  'call.outgoing.v1',
  'call.active.v1',
  'call.ended.v1',
  'call.participant-tile.v1',
  'call.participant-grid.v1',
  'call.controls.v1',
  'call.screen.v1',
] as const;

export const CALL_FORBIDDEN_IN_PRESENTATION = [
  'livekit.token',
  'identity.override',
  'publish.grant',
  'room.membership',
  'service.secret',
] as const;
