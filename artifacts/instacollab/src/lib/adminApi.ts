import {
  adminBanUser,
  adminListUsers,
  adminMuteUser,
  adminSetRole,
  adminUnbanUser,
  apiFetchAdmin,
  fetchMe,
  type AdminUserRow,
} from './platformApi';

export { adminBanUser, adminListUsers, adminMuteUser, adminSetRole, adminUnbanUser, fetchMe, type AdminUserRow };

export type AdminOverview = {
  users: number;
  posts: number;
  reels: number;
  comments: number;
  chatMessages: number;
  liveStreams: number;
  activePartyRooms: number;
  giftMessages: number;
  wallets: number;
};

export type AdminContentRow = {
  id: string;
  author_id: string;
  payload: Record<string, unknown>;
  is_archived: boolean;
  created_at: string;
  author?: { username?: string; display_name?: string } | null;
};

export type AdminCommentRow = {
  id: string;
  target_kind: string;
  target_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { username?: string; display_name?: string } | null;
};

export type AdminChatMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: { username?: string; display_name?: string } | null;
};

export type AdminWalletRow = {
  user_id: string;
  balance: number;
  updated_at: string | null;
  profile?: { username?: string; display_name?: string } | null;
};

export type AdminTransactionRow = {
  id: string;
  from_user: string | null;
  to_user: string | null;
  amount: number;
  tx_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminStreamRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  privacy?: string | null;
  party_room_id?: string | null;
  room_mode?: string | null;
  host?: { username?: string; display_name?: string } | null;
};

export type AdminPartyRoomRow = {
  id: string;
  owner_id: string;
  room_name: string;
  room_mode: string;
  status: string;
  participant_count: number;
  created_at: string;
  privacy?: string | null;
  owner?: { username?: string; display_name?: string } | null;
};

export type AdminGiftRow = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  kind: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export async function adminFetchOverview(): Promise<AdminOverview> {
  return apiFetchAdmin<AdminOverview>('/api/admin/overview');
}

export async function adminListPosts(q?: string): Promise<{ items: AdminContentRow[] }> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetchAdmin(`/api/admin/content/posts${query}`);
}

export async function adminListReels(q?: string): Promise<{ items: AdminContentRow[] }> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetchAdmin(`/api/admin/content/reels${query}`);
}

export async function adminArchivePost(postId: string, archived: boolean): Promise<unknown> {
  return apiFetchAdmin(`/api/admin/content/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  });
}

export async function adminListComments(q?: string): Promise<{ items: AdminCommentRow[] }> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetchAdmin(`/api/admin/content/comments${query}`);
}

export async function adminDeleteComment(commentId: string): Promise<unknown> {
  return apiFetchAdmin(`/api/admin/content/comments/${commentId}`, { method: 'DELETE' });
}

export async function adminListChatMessages(q?: string): Promise<{ items: AdminChatMessageRow[] }> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetchAdmin(`/api/admin/chat/messages${query}`);
}

export async function adminDeleteChatMessage(messageId: string): Promise<unknown> {
  return apiFetchAdmin(`/api/admin/chat/messages/${messageId}`, { method: 'DELETE' });
}

export async function adminListWallets(q?: string): Promise<{ items: AdminWalletRow[] }> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetchAdmin(`/api/admin/wallet/users${query}`);
}

export async function adminListTransactions(): Promise<{ items: AdminTransactionRow[] }> {
  return apiFetchAdmin('/api/admin/wallet/transactions');
}

export async function adminCreditWallet(
  userId: string,
  amount: number,
  txType = 'admin_credit',
): Promise<unknown> {
  return apiFetchAdmin('/api/wallet/credit', {
    method: 'POST',
    body: JSON.stringify({ userId, amount, txType }),
  });
}

export async function adminListStreams(): Promise<{ items: AdminStreamRow[] }> {
  return apiFetchAdmin('/api/admin/streams');
}

export async function adminStopStream(
  streamId: string,
  opts?: { partyRoomId?: string; hostUserId?: string },
): Promise<unknown> {
  return apiFetchAdmin('/api/admin/moderation/stop-live', {
    method: 'POST',
    body: JSON.stringify({
      streamId,
      roomId: opts?.partyRoomId,
      hostUserId: opts?.hostUserId,
    }),
  });
}

export async function adminBanStream(
  streamId: string,
  reason?: string,
  opts?: { partyRoomId?: string; hostUserId?: string },
): Promise<unknown> {
  return apiFetchAdmin('/api/admin/moderation/ban-host', {
    method: 'POST',
    body: JSON.stringify({
      streamId,
      roomId: opts?.partyRoomId,
      hostUserId: opts?.hostUserId,
      reason: reason?.trim() || undefined,
    }),
  });
}

export async function adminListPartyRooms(q?: string): Promise<{ items: AdminPartyRoomRow[] }> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetchAdmin(`/api/admin/party-rooms${query}`);
}

export async function adminEndPartyRoom(
  roomId: string,
  opts?: { hostUserId?: string },
): Promise<unknown> {
  return apiFetchAdmin('/api/admin/moderation/stop-live', {
    method: 'POST',
    body: JSON.stringify({
      roomId,
      hostUserId: opts?.hostUserId,
    }),
  });
}

export async function adminBanPartyRoom(
  roomId: string,
  reason?: string,
  opts?: { hostUserId?: string },
): Promise<unknown> {
  return apiFetchAdmin('/api/admin/moderation/ban-host', {
    method: 'POST',
    body: JSON.stringify({
      roomId,
      hostUserId: opts?.hostUserId,
      reason: reason?.trim() || undefined,
    }),
  });
}

export async function adminListGifts(): Promise<{ items: AdminGiftRow[] }> {
  return apiFetchAdmin('/api/admin/party-rooms/gifts');
}
