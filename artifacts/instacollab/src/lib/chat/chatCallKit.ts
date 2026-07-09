/**
 * TRTC CallKit-style shared types + peer resolution for 1v1 and group calls.
 */
import { db } from '../db/localDb';
import { findUserById } from '../safe';
import type { ChatGroup, ChatMessage, User } from '../../types';
import { isGroupChatId } from './cloudChatSync';

export type ChatCallKind = 'audio' | 'video';
export type ChatCallPhase = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';
export type ChatConnectPhase = 'idle' | 'connecting' | 'slow' | 'connected' | 'failed';
export type CallPresentation = 'fullscreen' | 'pip';

export const SLOW_CONNECT_MS = 2_000;
export const INCOMING_RING_TIMEOUT_MS = 45_000;

export type IncomingChatCall = {
  chatId: string;
  fromUserId: string;
  callKind: ChatCallKind;
  threadId: string;
  callRoomName?: string;
  isGroup?: boolean;
};

export type ChatCallSignal = {
  chatId: string;
  fromUserId: string;
  action: 'end' | 'decline';
  callKind?: ChatCallKind;
};

export function normalizeCallKind(kind: unknown): ChatCallKind {
  return kind === 'video' ? 'video' : 'audio';
}

export function resolveCallPeer(chatId: string, fromUserId?: string): User | ChatGroup | null {
  if (!chatId) return null;
  if (isGroupChatId(chatId)) {
    const group = db.getChatGroup(chatId);
    if (group) return group;
    return {
      id: chatId,
      displayName: 'Group call',
      username: 'group',
      avatarUrl: '',
      isGroup: true,
      memberIds: [],
      createdBy: '',
      adminIds: [],
      mutedMemberIds: [],
      adminOnlyPosting: false,
      requireApprovalToJoin: false,
    };
  }
  const peerId = fromUserId?.trim() || chatId;
  return findUserById(db.users, peerId);
}

export function callKindLabel(kind: ChatCallKind): string {
  return kind === 'video' ? 'Video call' : 'Audio call';
}

export type RemoteCallVideo = {
  participantId: string;
  participantName: string;
  stream: MediaStream;
};

export type RemoteCallParticipant = {
  participantId: string;
  participantName: string;
  hasAudio: boolean;
};

export function resolveParticipantAvatar(participantId: string): string | undefined {
  const user = findUserById(db.users, participantId);
  return user?.avatarUrl || undefined;
}

export type ActiveGroupCall = {
  callKind: ChatCallKind;
  callRoomName: string;
  fromUserId?: string;
  startedAt?: number;
};

/** Latest open group invite in thread history (invite without a later end). */
export function resolveActiveGroupCall(messages: readonly ChatMessage[]): ActiveGroupCall | null {
  let active: ActiveGroupCall | null = null;
  for (const msg of messages) {
    if (!msg.isCallEvent) continue;
    const action = typeof msg.callAction === 'string' ? msg.callAction : '';
    if (action === 'invite') {
      const room = typeof msg.callRoomName === 'string' ? msg.callRoomName.trim() : '';
      if (!room) continue;
      const ts =
        typeof msg.timestamp === 'number'
          ? msg.timestamp
          : typeof msg.timestamp === 'string'
            ? Date.parse(msg.timestamp)
            : undefined;
      active = {
        callKind: normalizeCallKind(msg.callKind),
        callRoomName: room,
        fromUserId: typeof msg.from === 'string' ? msg.from : undefined,
        startedAt: Number.isFinite(ts) ? ts : undefined,
      };
    } else if (action === 'end' && active) {
      active = null;
    }
  }
  return active;
}
