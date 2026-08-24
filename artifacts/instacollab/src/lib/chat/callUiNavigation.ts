export type CallMessagesSurfaceAction =
  | 'chat'
  | 'members'
  | 'invite'
  | 'requests'
  | 'settings'
  | 'report';

export type CallMessagesSurfaceRequest = {
  action: CallMessagesSurfaceAction;
  chatId: string;
  groupId?: string;
  peerId?: string;
  callKind?: 'audio' | 'video';
};

let pendingRequest: CallMessagesSurfaceRequest | null = null;

function normalizeRequest(detail: CallMessagesSurfaceRequest): CallMessagesSurfaceRequest | null {
  const chatId = String(detail.chatId || '').trim();
  if (!chatId) return null;
  const groupId = detail.groupId ? String(detail.groupId).trim() : undefined;
  const peerId = detail.peerId ? String(detail.peerId).trim() : undefined;
  return {
    action: detail.action,
    chatId,
    groupId: groupId || undefined,
    peerId: peerId || undefined,
    callKind: detail.callKind,
  };
}

/**
 * Global call -> Messages bridge.
 *
 * The call provider lives above MessagesScreen, so MessagesScreen can be unmounted
 * when a user taps Chat/Members/Invite/etc. Store the request until Messages mounts,
 * navigate to the canonical local chat id, then let MessagesScreen consume the request.
 */
export function openCallMessagesSurface(detail: CallMessagesSurfaceRequest): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeRequest(detail);
  if (!normalized) return;
  pendingRequest = normalized;
  const targetChatId = normalized.groupId || normalized.chatId;
  window.dispatchEvent(
    new CustomEvent('navigate', {
      detail: { tab: 'messages', chatId: targetChatId },
    }),
  );
  window.dispatchEvent(new CustomEvent('unilive-call-ui-action', { detail: normalized }));
}

export function peekPendingCallMessagesSurface(): CallMessagesSurfaceRequest | null {
  return pendingRequest;
}

export function consumePendingCallMessagesSurface(): CallMessagesSurfaceRequest | null {
  const next = pendingRequest;
  pendingRequest = null;
  return next;
}

export function acknowledgePendingCallMessagesSurface(request?: CallMessagesSurfaceRequest | null): void {
  if (!pendingRequest) return;
  if (!request || pendingRequest === request) pendingRequest = null;
}
