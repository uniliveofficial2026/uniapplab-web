import type { CameraFacingMode } from '../camera/appCameraOwner';
import type {
  CallPresentation,
  ChatCallKind,
  ChatCallPhase,
  ChatConnectPhase,
  IncomingChatCall,
  RemoteCallParticipant,
  RemoteCallVideo,
} from './chatCallKit';
import type { CallLifecycleState } from './callLifecycleState';

export type UseChatCallValue = {
  phase: ChatCallPhase;
  connectPhase: ChatConnectPhase;
  /** Production lifecycle mapping (provider-neutral). */
  lifecycleState: CallLifecycleState;
  presentation: CallPresentation;
  callKind: ChatCallKind;
  activeChatId: string | null;
  incoming: IncomingChatCall | null;
  error: string | null;
  remoteVideoReady: boolean;
  localVideoStream: MediaStream | null;
  primaryRemoteStream: MediaStream | null;
  remoteVideos: RemoteCallVideo[];
  remoteParticipants: RemoteCallParticipant[];
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  isSpeakerOn: boolean;
  connectedAt: number;
  cameraFacingMode: CameraFacingMode;
  mirrorLocalPreview: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  replacePublishedVideoTrack: (track: MediaStreamTrack | null) => Promise<void>;
  startCall: (chatId: string, kind: ChatCallKind) => void;
  startAudioCall: (chatId: string) => void;
  startVideoCall: (chatId: string) => void;
  joinGroupCall: (chatId: string, kind: ChatCallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  retryConnect: () => Promise<void>;
  minimizeCall: () => void;
  expandCall: () => void;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  flipCamera: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  isLiveKitConfigured: boolean;
};
