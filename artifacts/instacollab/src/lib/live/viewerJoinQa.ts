/**
 * DEBUG/QA-only viewer join stage traces.
 * No tokens or credentials — stage names + safe hashes only.
 */
import { hashId } from '../camera/cameraSwitchTrace';

export type ViewerJoinStage =
  | 'VIEWER_DISCOVERY_START'
  | 'VIEWER_ROOM_FOUND'
  | 'VIEWER_ROOM_ID_RESOLVED'
  | 'VIEWER_JOIN_REQUEST'
  | 'VIEWER_JOIN_OK'
  | 'VIEWER_RTC_GRANT_OK'
  | 'VIEWER_LIVEKIT_CONNECT_START'
  | 'VIEWER_LIVEKIT_CONNECTED'
  | 'VIEWER_HOST_PARTICIPANT_FOUND'
  | 'VIEWER_VIDEO_SUBSCRIBED'
  | 'VIEWER_AUDIO_SUBSCRIBED'
  | 'VIEWER_REMOTE_FRAMES_ACTIVE'
  | 'VIEWER_JOIN_FAIL';

export type ViewerJoinQaSnapshot = {
  stage: ViewerJoinStage;
  appRoomIdHash?: string;
  hostPersonHash?: string;
  failClass?: string;
  detail?: string;
  at: number;
};

type ViewerJoinQaWindow = Window & {
  __UNILIVE_VIEWER_JOIN_QA__?: ViewerJoinQaSnapshot;
  __UNILIVE_VIEWER_JOIN_HISTORY__?: ViewerJoinQaSnapshot[];
};

export function emitViewerJoinStage(
  stage: ViewerJoinStage,
  options?: {
    appRoomId?: string;
    hostPersonId?: string;
    failClass?: string;
    detail?: string;
  },
): void {
  if (typeof window === 'undefined') return;
  const snap: ViewerJoinQaSnapshot = {
    stage,
    appRoomIdHash: hashId(options?.appRoomId?.trim() || undefined),
    hostPersonHash: hashId(options?.hostPersonId?.trim() || undefined),
    failClass: options?.failClass?.slice(0, 80),
    detail: options?.detail?.slice(0, 120),
    at: Date.now(),
  };
  try {
    const w = window as ViewerJoinQaWindow;
    w.__UNILIVE_VIEWER_JOIN_QA__ = snap;
    const hist = Array.isArray(w.__UNILIVE_VIEWER_JOIN_HISTORY__)
      ? w.__UNILIVE_VIEWER_JOIN_HISTORY__
      : [];
    hist.push(snap);
    while (hist.length > 40) hist.shift();
    w.__UNILIVE_VIEWER_JOIN_HISTORY__ = hist;
    console.info('[ViewerJoinQa]', snap);
  } catch {
    /* ignore */
  }
}
