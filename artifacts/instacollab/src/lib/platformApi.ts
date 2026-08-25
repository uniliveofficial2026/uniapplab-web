import { uniapplabOrigin, isLocalDevHost, isUniapplabHost } from './domains/uniapplab';
import { getSupabaseClient } from './supabase/client';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './supabase/config';
import { fetchWithTimeout, NET_API_MS, NET_AUTH_MS, withTimeout } from './networkPolicy';
import { dedupeInflight } from './requestDedupe';

function apiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    // Same-origin /api/* on every UniLive app host (Vercel monorepo deploy).
    if (isUniapplabHost(hostname)) {
      return origin.replace(/\/$/, '');
    }
    if (import.meta.env.DEV && isLocalDevHost(hostname)) {
      return origin.replace(/\/$/, '');
    }
  }

  const fromEnv = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (import.meta.env.DEV) return 'http://localhost:5173';

  if (typeof window !== 'undefined' && isUniapplabHost(window.location.hostname)) {
    return window.location.origin.replace(/\/$/, '');
  }

  return uniapplabOrigin('api');
}

export { apiBaseUrl };

function isLocalLiveLifecyclePath(path: string): boolean {
  const clean = (path.startsWith('/') ? path : `/${path}`).split('?')[0] ?? '';
  return clean.startsWith('/api/live/pk') || clean.startsWith('/api/live/rooms');
}

function requestApiBase(path: string): string {
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    isLocalDevHost(window.location.hostname) &&
    isLocalLiveLifecyclePath(path)
  ) {
    const local =
      String(import.meta.env.VITE_LOCAL_LIVE_API || '')
        .trim()
        .replace(/\/$/, '') || 'http://127.0.0.1:5001';
    return local;
  }
  return apiBaseUrl();
}

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Never hang UI/API on a slow auth refresh.
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        NET_AUTH_MS,
        'auth.getSession',
      );
      const token = data.session?.access_token;
      if (token) {
        headers.authorization = `Bearer ${token}`;
        return headers;
      }
    } catch {
      /* try Firebase below */
    }
  }
  // Firebase-backup sessions: server auth middleware accepts Firebase ID tokens.
  try {
    const { getFirebaseAuth } = await import('./firebase/app');
    const firebaseUser = getFirebaseAuth()?.currentUser;
    if (firebaseUser) {
      const idToken = await withTimeout(
        firebaseUser.getIdToken(),
        NET_AUTH_MS,
        'firebase.getIdToken',
      );
      if (idToken) headers.authorization = `Bearer ${idToken}`;
    }
  } catch {
    /* proceed without bearer — local cache still works */
  }
  if (!headers.authorization && import.meta.env.DEV) {
    try {
      const { db } = await import('./db/localDb');
      const uid = String(db.currentUserId || '').trim();
      if (uid) headers.authorization = `Bearer dev-local.${uid}`;
    } catch {
      /* remain unauthenticated */
    }
  }
  return headers;
}

/**
 * Optional Edge Function preference (legacy Vercel cutover).
 *
 * Production UniApplab hosts serve the Render API at same-origin `/api/*`.
 * Prefer that path — Edge Functions for presence/chat/me are incomplete and
 * previously returned CORS/404 as authoritative failures, blocking the app.
 *
 * Edge is only attempted off UniApplab hosts (or when explicitly forced).
 */
const EDGE_MIGRATED_PREFIXES = [
  '/api/wallet',
  '/api/gifts',
  '/api/livekit',
  '/api/admin',
  '/api/me',
  '/api/chat',
  '/api/stream',
  '/api/presence',
  '/api/payments',
  '/api/automation',
];

/** Exact paths that should hit Edge (siblings under /api/platform stay on Express). */
const EDGE_MIGRATED_EXACT = ['/api/platform/brand'];

/** Live stop/ban/end need Express Firestore + LiveKit — never send these to Edge. */
const EXPRESS_ONLY_ADMIN_MOD =
  /^\/api\/admin\/(streams|party-rooms)\/[^/]+\/(stop|ban|end)$/;
const EXPRESS_ONLY_ADMIN_MOD_UNIFIED = /^\/api\/admin\/moderation\/(stop-live|ban-host)$/;

function preferSameOriginApi(): boolean {
  if (typeof window === 'undefined') return false;
  const forceEdge = String(import.meta.env.VITE_FORCE_EDGE_API || '').trim() === '1';
  if (forceEdge) return false;
  return isUniapplabHost(window.location.hostname);
}

function edgeMigratedPath(path: string): string | null {
  if (preferSameOriginApi()) return null;
  if (path.startsWith('http')) return null;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const bare = clean.split('?')[0] ?? clean;
  if (EXPRESS_ONLY_ADMIN_MOD.test(bare) || EXPRESS_ONLY_ADMIN_MOD_UNIFIED.test(bare)) {
    return null;
  }
  if (EDGE_MIGRATED_EXACT.some((p) => bare === p)) {
    return bare.replace(/^\/api/, '');
  }
  const matched = EDGE_MIGRATED_PREFIXES.some(
    (p) => bare === p || bare.startsWith(`${p}/`),
  );
  return matched ? clean.replace(/^\/api/, '').split('?')[0]! : null;
}

/** Supabase access token only (no Firebase). Determines the Edge Function lane. */
async function supabaseAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      NET_AUTH_MS,
      'auth.getSession',
    );
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Attempt a migrated call against the Supabase Edge Function.
 * Returns the Response when the Edge Function handled it authoritatively
 * (including business errors like 400/402/403/404), or `null` to signal the
 * caller should fall back to the Express API (Firebase lane / edge unreachable).
 */
async function tryEdgeFunction(
  edgePath: string,
  init: RequestInit | undefined,
): Promise<Response | null> {
  if (!isSupabaseConfigured()) return null;
  const supabaseUrl = getSupabaseUrl().replace(/\/$/, '');
  const anonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) return null;

  const token = await supabaseAccessToken();
  // No Supabase session → Firebase or anonymous lane stays on Express.
  if (!token) return null;

  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    apikey: anonKey,
    authorization: `Bearer ${token}`,
    ...(init?.headers as Record<string, string> | undefined),
  };

  try {
    const res = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1${edgePath}`,
      { ...init, headers },
      NET_API_MS,
      `edge:${edgePath}`,
    );
    // A rejected token means the caller belongs to a lane the Edge Function
    // can't verify (e.g. Firebase) — hand back to Express instead of erroring.
    if (res.status === 401) return null;
    // Missing Edge deploy / gateway 404 → Express (Render) is authoritative.
    if (res.status === 404) return null;
    return res;
  } catch {
    // Edge unreachable/timeout — fall back to the Express API.
    return null;
  }
}

async function apiFetchOnce<T>(path: string, init?: RequestInit): Promise<T> {
  const edgePath = edgeMigratedPath(path);
  if (edgePath) {
    const edgeRes = await tryEdgeFunction(edgePath, init);
    if (edgeRes) {
      if (!edgeRes.ok) {
        const body = await edgeRes.text().catch(() => '');
        let detail = body || edgeRes.statusText || 'Request failed';
        try {
          const parsed = JSON.parse(body) as { error?: string; message?: string };
          if (parsed?.error) detail = String(parsed.error);
          else if (parsed?.message) detail = String(parsed.message);
        } catch {
          /* keep raw body */
        }
        throw new Error(`API ${edgeRes.status}: ${detail}`);
      }
      if (edgeRes.status === 204) return null as T;
      return (await edgeRes.json()) as T;
    }
  }

  const base = requestApiBase(path);
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        ...(await authHeaders()),
        ...(init?.headers as Record<string, string> | undefined),
      },
    },
    NET_API_MS,
    path,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body || res.statusText || 'Request failed';
    try {
      const parsed = JSON.parse(body) as { error?: string; message?: string };
      if (parsed?.error) detail = String(parsed.error);
      else if (parsed?.message) detail = String(parsed.message);
    } catch {
      /* keep raw body */
    }
    throw new Error(`API ${res.status}: ${detail}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = String(init?.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return dedupeInflight(`GET:${path}`, () => apiFetchOnce<T>(path, init));
  }
  return apiFetchOnce<T>(path, init);
}

export { apiFetch };

export type MeResponse = {
  id: string;
  email?: string | null;
  role: 'user' | 'streamer' | 'admin';
  bannedAt: string | null;
  banReason: string | null;
  mutedUntil: string | null;
  username: string | null;
  displayName: string | null;
};

export type AdminUserRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  banned_at: string | null;
  ban_reason: string | null;
  muted_until: string | null;
};

export function isPlatformApiAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/me');
}

export async function fetchWallet(): Promise<{
  balance: number;
  coins?: number;
  diamonds?: number;
  rewardPoints?: number;
  bonusCoins?: number;
  promoCredits?: number;
  vipTokens?: number;
  limits?: unknown;
  transactions: unknown[];
}> {
  return apiFetch('/api/wallet');
}

export async function transferCoins(toUser: string, amount: number): Promise<unknown> {
  return apiFetch('/api/wallet/transfer', {
    method: 'POST',
    body: JSON.stringify({ toUser, amount }),
  });
}

/** Debit buyer coins; credit seller commerce_coin_earnings (not gift spendable balance). */
export async function settleCommerceCoinSaleApi(input: {
  sellerId: string;
  amount: number;
  clientRequestId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok?: boolean; duplicate?: boolean; transactionId?: string; error?: string }> {
  return apiFetch('/api/wallet/commerce-settle', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Register DEVICE↔PERSON push binding (server authority; never send personId from client). */
export async function registerPushDeviceApi(input: {
  deviceId: string;
  pushToken: string;
  platform: string;
}): Promise<{ ok?: boolean; deviceId?: string; personId?: string; platform?: string }> {
  return apiFetch('/api/push/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function clearPushDevicePersonApi(input: {
  deviceId: string;
}): Promise<{ ok?: boolean; deviceId?: string }> {
  return apiFetch('/api/push/clear-person', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type SendGiftRequest = {
  giftId: string;
  receiverId: string;
  roomId?: string;
  quantity?: number;
  combo?: number;
  clientRequestId?: string;
  giftName?: string;
  unitPrice?: number;
  tier?: string;
  metadata?: Record<string, unknown>;
};

export type SendGiftResponse = {
  ok: boolean;
  duplicate?: boolean;
  giftTransactionId?: string;
  totalCoins?: number;
  diamondsAwarded?: number;
  balances?: {
    senderCoins?: number;
    senderBonusCoins?: number;
    receiverDiamonds?: number;
  };
  event?: {
    giftId: string;
    senderId: string;
    receiverId: string;
    roomId: string | null;
    quantity: number;
    combo: number;
    timestamp: number;
    totalCoins?: number;
    tier?: string;
    giftTransactionId?: string;
  };
  error?: string;
};

export async function sendGiftApi(payload: SendGiftRequest): Promise<SendGiftResponse> {
  return apiFetch('/api/gifts/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchGiftCatalogApi(): Promise<{ gifts: unknown[] }> {
  return apiFetch('/api/gifts/catalog');
}

export async function fetchGiftHistoryApi(limit = 40): Promise<{ transactions: unknown[] }> {
  return apiFetch(`/api/gifts/history?limit=${limit}`);
}

export async function fetchGiftRoomRankingsApi(
  roomId: string,
  role: 'sender' | 'receiver' = 'sender',
): Promise<{ rankings: unknown[] }> {
  return apiFetch(
    `/api/gifts/rankings/${encodeURIComponent(roomId)}?role=${encodeURIComponent(role)}`,
  );
}

export async function fetchRechargePackages(): Promise<{
  packages: Array<{
    id: string;
    title: string;
    coins: number;
    bonusCoins: number;
    priceUsdCents: number;
    badge?: string | null;
  }>;
}> {
  return apiFetch('/api/payments/recharge/packages');
}

export async function createRechargeCheckoutSession(payload: {
  packageId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string; orderId: string }> {
  return apiFetch('/api/payments/recharge/checkout-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyRechargeCheckoutSession(
  sessionId: string,
): Promise<{ paid: boolean; credited?: boolean; orderId?: string }> {
  return apiFetch('/api/payments/recharge/verify-session', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export type CommerceCheckoutSessionRequest = {
  amountUsdCents: number;
  productId: string;
  productTitle: string;
  roomId: string;
  hostUserId: string;
  orderId: string;
  buyerUserId: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createCommerceCheckoutSession(
  payload: CommerceCheckoutSessionRequest,
): Promise<{ sessionId: string; url: string }> {
  return apiFetch('/api/payments/commerce/checkout-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyCommerceCheckoutSession(
  sessionId: string,
): Promise<{
  paid: boolean;
  amountUsdCents?: number;
  orderId?: string | null;
  hostUserId?: string | null;
  productId?: string | null;
  productTitle?: string | null;
  roomId?: string | null;
  buyerUserId?: string | null;
}> {
  return apiFetch(
    `/api/payments/commerce/verify-session?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

export async function adminListUsers(q?: string): Promise<{ users: AdminUserRow[] }> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetch(`/api/admin/users${query}`);
}

export async function adminBanUser(userId: string, reason?: string): Promise<unknown> {
  return apiFetch(`/api/admin/users/${userId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function adminUnbanUser(userId: string): Promise<unknown> {
  return apiFetch(`/api/admin/users/${userId}/unban`, { method: 'POST', body: '{}' });
}

export async function adminSetRole(userId: string, role: string): Promise<unknown> {
  return apiFetch(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function adminMuteUser(userId: string, minutes = 60): Promise<unknown> {
  return apiFetch(`/api/admin/users/${userId}/mute`, {
    method: 'POST',
    body: JSON.stringify({ minutes }),
  });
}

/** Admin-only fetch — surfaces 403 clearly. */
export async function apiFetchAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, init);
}

export type CreateChatThreadOptions = {
  threadType?: 'dm' | 'group';
  meta?: Record<string, unknown>;
};

export async function createChatThread(
  memberIds: string[],
  options: CreateChatThreadOptions = {},
): Promise<{ id: string }> {
  return apiFetch('/api/chat/threads', {
    method: 'POST',
    body: JSON.stringify({
      memberIds,
      threadType: options.threadType,
      meta: options.meta,
    }),
  });
}

export async function fetchChatThreads(): Promise<{
  threads: Array<{
    id: string;
    thread_type?: string;
    dm_key?: string | null;
    members?: string[];
    latestMessage?: unknown;
    created_at?: string;
    updated_at?: string;
  }>;
}> {
  return apiFetch('/api/chat/threads');
}


export async function fetchChatThreadMessages(
  threadId: string,
  options?: { before?: string; limit?: number },
): Promise<{ messages: unknown[]; threadId: string }> {
  const params = new URLSearchParams();
  if (options?.before) params.set('before', options.before);
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  return apiFetch(`/api/chat/threads/${encodeURIComponent(threadId)}/messages${qs ? `?${qs}` : ''}`);
}


export async function sendChatMessageApi(
  threadId: string,
  body: string,
  payload?: Record<string, unknown>,
  clientId?: string,
): Promise<{ id: string; thread_id?: string; sender_id?: string; created_at?: string }> {
  return apiFetch('/api/chat/messages', {
    method: 'POST',
    body: JSON.stringify({
      threadId,
      body,
      payload: payload ?? undefined,
      clientId: clientId ?? undefined,
    }),
  });
}

export async function deleteChatMessageApi(
  threadId: string,
  options: { messageId?: string; clientId?: string },
): Promise<{
  id: string;
  thread_id?: string;
  sender_id?: string;
  deleted_at?: string | null;
  alreadyDeleted?: boolean;
}> {
  return apiFetch('/api/chat/messages/delete', {
    method: 'POST',
    body: JSON.stringify({
      threadId,
      messageId: options.messageId,
      clientId: options.clientId,
    }),
  });
}

export async function startStream(title?: string): Promise<{ id: string }> {
  return apiFetch('/api/stream/start', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function stopStream(streamId: string): Promise<unknown> {
  return apiFetch('/api/stream/stop', {
    method: 'POST',
    body: JSON.stringify({ streamId }),
  });
}

export async function postStreamSignal(
  streamId: string,
  signalType: string,
  payload: Record<string, unknown>,
  toUser?: string | null,
): Promise<unknown> {
  return apiFetch(`/api/stream/${streamId}/signal`, {
    method: 'POST',
    body: JSON.stringify({ signalType, payload, toUser }),
  });
}

export async function fetchLiveStreams(): Promise<{ streams: unknown[] }> {
  return apiFetch('/api/stream/live');
}

export type LiveKitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  streamId: string;
  role: 'host' | 'viewer';
};

export async function fetchLiveKitToken(
  streamId: string,
  role: 'host' | 'viewer' = 'viewer',
): Promise<LiveKitTokenResponse> {
  return apiFetch('/api/livekit/token', {
    method: 'POST',
    body: JSON.stringify({ streamId, role }),
  });
}

export type PartyLiveKitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  roomId: string;
  publish: boolean;
  hidden?: boolean;
};

export async function fetchPartyLiveKitToken(
  roomId: string,
  publish = true,
  options?: { hidden?: boolean },
): Promise<PartyLiveKitTokenResponse> {
  return apiFetch('/api/livekit/party/token', {
    method: 'POST',
    body: JSON.stringify({
      roomId,
      publish: options?.hidden ? false : publish,
      hidden: Boolean(options?.hidden),
    }),
  });
}

export type ChatLiveKitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  threadId: string;
  callKind: 'audio' | 'video';
  publish: boolean;
};

export async function fetchChatLiveKitToken(
  threadId: string,
  callKind: 'audio' | 'video' = 'audio',
): Promise<ChatLiveKitTokenResponse> {
  return apiFetch('/api/livekit/chat/token', {
    method: 'POST',
    body: JSON.stringify({ threadId, callKind }),
  });
}

function getOrCreateDeviceId(): string {
  try {
    const key = 'unilive_device_id';
    const existing = localStorage.getItem(key);
    if (existing?.trim()) return existing.trim().slice(0, 120);
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return 'default';
  }
}

export async function postPresenceHeartbeat(friendIds?: string[]): Promise<{
  ok: boolean;
  online?: boolean;
  userIds?: string[];
  configured?: boolean;
}> {
  return apiFetch('/api/presence/online', {
    method: 'POST',
    body: JSON.stringify({ friendIds, deviceId: getOrCreateDeviceId() }),
  });
}

export async function postPresenceOffline(): Promise<{
  ok: boolean;
  online?: boolean;
  configured?: boolean;
}> {
  return apiFetch('/api/presence/offline', {
    method: 'POST',
    body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
  });
}

export async function fetchOnlinePresence(ids?: string[]): Promise<{
  online?: boolean;
  userId?: string;
  userIds?: string[];
  configured?: boolean;
}> {
  const query = ids?.length ? `?ids=${encodeURIComponent(ids.join(','))}` : '';
  return apiFetch(`/api/presence/online${query}`);
}

export async function fetchStreamViewers(streamId: string): Promise<{
  streamId: string;
  viewers: number;
  configured?: boolean;
}> {
  return apiFetch(`/api/stream/${encodeURIComponent(streamId)}/viewers`);
}

export async function postStreamViewer(
  streamId: string,
  action: 'join' | 'leave',
): Promise<{ streamId: string; viewers: number; action: string; configured?: boolean }> {
  return apiFetch(`/api/stream/${encodeURIComponent(streamId)}/viewers`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function postChatTyping(
  threadId: string,
  typing = true,
): Promise<{ ok: boolean; threadId: string; userIds: string[]; configured?: boolean }> {
  return apiFetch('/api/chat/typing', {
    method: 'POST',
    body: JSON.stringify({ threadId, typing }),
  });
}

export type AutomationConfig = {
  autopilot: boolean;
  enabled: boolean;
  autoPush: boolean;
  githubActionsDeploy: boolean;
  autoMachineLearning: boolean;
  liveCloudSyncAggressive?: boolean;
};

export type PlatformBrandApiResponse = {
  logoUrl: string | null;
  mediaType: 'image' | 'video';
  updatedAt: string;
  iconUrl: string | null;
  manifestUrl: string;
};

export async function fetchPlatformBrandFromApi(): Promise<PlatformBrandApiResponse> {
  return apiFetch<PlatformBrandApiResponse>('/api/platform/brand');
}

export async function publishPlatformBrandViaApi(
  logoUrl: string | null,
  mediaType: 'image' | 'video' = 'image',
): Promise<PlatformBrandApiResponse> {
  return apiFetch<PlatformBrandApiResponse>('/api/platform/brand', {
    method: 'POST',
    body: JSON.stringify({ logoUrl, mediaType }),
  });
}

export async function fetchAutomationConfig(): Promise<AutomationConfig> {
  return apiFetch<AutomationConfig>('/api/automation');
}

export async function patchAutomationConfig(
  update: Partial<AutomationConfig>,
): Promise<AutomationConfig> {
  return apiFetch<AutomationConfig>('/api/automation', {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

export type LiveLifecycleRoomType =
  | 'solo_audio'
  | 'solo_video'
  | 'audio_party'
  | 'video_multi'
  | 'pk_1v1'
  | 'pk_team'
  | 'game'
  | 'commerce';

export type LiveParticipantRole = 'host' | 'guest' | 'viewer' | 'moderator';

export type LeaveLiveRoomCommand = {
  commandId: string;
  participantSessionId: string;
  expectedRoomVersion?: number;
  reason: 'user_selected_leave' | 'navigation' | 'app_background' | 'connection_lost';
  roomType?: LiveLifecycleRoomType;
  role?: LiveParticipantRole;
  seated?: boolean;
};

export type EndLiveRoomCommand = {
  commandId: string;
  expectedRoomVersion?: number;
  reason: 'host_selected_end' | 'host_grace_expired' | 'authorized_moderation' | 'system_shutdown';
  roomType?: LiveLifecycleRoomType;
};

export type LiveHostDashboardSnapshot = {
  roomId: string;
  roomVersion: number;
  sequence: number;
  generatedAt: string;
  startedAt: string;
  roomState: 'preparing' | 'live' | 'host_reconnecting' | 'ending' | 'ended';
  audience: {
    currentConnections: number;
    currentUniqueViewers: number;
    peakConcurrentViewers: number;
    uniqueViewers: number;
    joins: number;
    leaves: number;
  };
  engagement: {
    comments: number;
    commentsPerMinute: number;
    reactions: number;
    shares: number;
    followersGained: number;
  };
  participants: { connected: number; seated: number; pendingSeatRequests: number };
  gifts: {
    confirmedGiftCount: number;
    confirmedGrossGiftValue: number | null;
    settlementState: 'not_applicable' | 'provisional' | 'confirmed';
  };
  pk: { state: string | null; localScore: number | null; opponentScore: number | null; endsAt: string | null };
  media: {
    connectionState: string;
    connectionQuality: string;
    uploadBitrate: number | null;
    framesPerSecond: number | null;
    packetLoss: number | null;
    roundTripTime: number | null;
  };
};

export type LiveHostDashboardDelta = {
  eventId: string;
  roomId: string;
  sequence: number;
  previousSequence: number;
  roomVersion: number;
  occurredAt: string;
  patch: Omit<
    Partial<LiveHostDashboardSnapshot>,
    'audience' | 'engagement' | 'participants' | 'gifts' | 'pk' | 'media'
  > & {
    audience?: Partial<LiveHostDashboardSnapshot['audience']>;
    engagement?: Partial<LiveHostDashboardSnapshot['engagement']>;
    participants?: Partial<LiveHostDashboardSnapshot['participants']>;
    gifts?: Partial<LiveHostDashboardSnapshot['gifts']>;
    pk?: Partial<LiveHostDashboardSnapshot['pk']>;
    media?: Partial<LiveHostDashboardSnapshot['media']>;
  };
};

export type LiveHostSummary = {
  roomId: string;
  roomVersion: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  uniqueViewers: number;
  peakViewers: number;
  joins: number;
  leaves: number;
  comments: number;
  reactions: number;
  shares: number;
  followersGained: number;
  guestsSeated: number;
  confirmedGiftCount: number;
  giftValue: number | null;
  giftSettlementState: 'not_applicable' | 'provisional' | 'confirmed';
  pkResult: string | null;
  reconnectCount: number;
  averageConnectionQuality: string | null;
};

export async function ensureLiveLifecycleRoom(input: {
  roomId: string;
  roomType?: LiveLifecycleRoomType;
  hasCanonicalCohostTransfer?: boolean;
}): Promise<{ roomId: string; roomType: string; roomState: string; roomVersion: number; startedAt: string }> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(input.roomId)}/ensure`, {
    method: 'POST',
    body: JSON.stringify({
      roomType: input.roomType,
      hasCanonicalCohostTransfer: Boolean(input.hasCanonicalCohostTransfer),
    }),
  });
}

export async function connectLiveLifecycleSession(input: {
  roomId: string;
  participantSessionId: string;
  role?: LiveParticipantRole;
  seated?: boolean;
  roomType?: LiveLifecycleRoomType;
}): Promise<unknown> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(input.roomId)}/sessions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function previewLiveLeave(roomId: string, role?: LiveParticipantRole): Promise<{
  policy: string | null;
  confirmationKey: string;
  deadlineAt: string | null;
  roomVersion: number;
}> {
  const q = role ? `?role=${encodeURIComponent(role)}` : '';
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/leave-preview${q}`);
}

export async function leaveLiveRoom(roomId: string, command: LeaveLiveRoomCommand): Promise<{
  commandId: string;
  actionId: 'live.room.leave';
  roomId: string;
  roomVersion: number;
  roomState: string;
  role: LiveParticipantRole;
  hostDeparturePolicy: string | null;
  hostReconnectDeadlineAt: string | null;
  ended: false;
  confirmationKey: string;
}> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/leave`, {
    method: 'POST',
    body: JSON.stringify(command),
  });
}

export async function endLiveRoom(roomId: string, command: EndLiveRoomCommand): Promise<{
  commandId: string;
  actionId: 'live.room.end';
  roomId: string;
  roomVersion: number;
  roomState: string;
  duplicate: boolean;
  summary: LiveHostSummary | null;
  opponentRoomId: string | null;
  opponentStillLive: boolean;
}> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/end`, {
    method: 'POST',
    body: JSON.stringify(command),
  });
}

export type PkMediaSurface = 'stream' | 'party';

export type LivePkSessionSnapshot = {
  id: string;
  roomId: string;
  hostUserId: string;
  opponentUserId: string | null;
  opponentRoomId: string | null;
  hostMediaId?: string | null;
  opponentMediaId?: string | null;
  hostMediaSurface?: PkMediaSurface | null;
  opponentMediaSurface?: PkMediaSurface | null;
  pkType: 'pk_1v1' | 'pk_team';
  teamSize?: 1 | 2 | 3 | 4 | 6;
  hostTeamUserIds?: string[];
  opponentTeamUserIds?: string[];
  memberScores?: Record<string, number>;
  memberGiftCounts?: Record<string, number>;
  liveSell?: boolean;
  status: 'invited' | 'accepted' | 'countdown' | 'active' | 'ended' | 'cancelled' | 'expired';
  localScore: number;
  opponentScore: number;
  endsAt: string | null;
  startedAt: string | null;
  durationSec: number;
  multiplier: number;
  version: number;
  sequence: number;
};

export async function fetchLivePkSession(roomId: string): Promise<{
  roomId: string;
  roomState: string;
  hostUserId: string;
  pk: LivePkSessionSnapshot | null;
}> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/pk/session`);
}

export async function startLivePk(
  roomId: string,
  input?: {
    opponentUserId?: string | null;
    opponentRoomId?: string | null;
    hostMediaId?: string | null;
    opponentMediaId?: string | null;
    hostMediaSurface?: PkMediaSurface | null;
    opponentMediaSurface?: PkMediaSurface | null;
    durationSec?: number;
    multiplier?: number;
    pkType?: 'pk_1v1' | 'pk_team';
    hostTeamUserIds?: string[];
    opponentTeamUserIds?: string[];
    liveSell?: boolean;
    roomType?: LiveLifecycleRoomType;
  },
): Promise<{
  roomId: string;
  hostUserId: string;
  pk: LivePkSessionSnapshot;
}> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/pk/start`, {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export async function endLivePk(roomId: string, command: {
  commandId: string;
  expectedPkVersion?: number;
}): Promise<{
  commandId: string;
  actionId: 'live.pk.end';
  roomId: string;
  pkId: string | null;
  pkStatus: string | null;
  roomState: string;
  opponentRoomId: string | null;
  opponentStillLive: boolean;
  localScore: number | null;
  opponentScore: number | null;
}> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/pk/end`, {
    method: 'POST',
    body: JSON.stringify(command),
  });
}

export type LivePkChallengeStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type LivePkChallenge = {
  id: string;
  hostRoomId: string;
  challengerRoomId: string;
  hostUserId: string;
  challengerUserId: string;
  pkType?: 'pk_1v1' | 'pk_team';
  challengerTeamUserIds?: string[];
  teamSize?: 1 | 2 | 3 | 4 | 6;
  liveSell?: boolean;
  hostMediaId?: string | null;
  challengerMediaId?: string | null;
  hostMediaSurface?: PkMediaSurface | null;
  challengerMediaSurface?: PkMediaSurface | null;
  status: LivePkChallengeStatus;
  createdAt: string;
  expiresAt: string;
  durationSec: number;
  version: number;
  pkId: string | null;
};

export type LivePkChallengeInbox = {
  incoming: LivePkChallenge | null;
  outgoing: LivePkChallenge | null;
  activePk: LivePkSessionSnapshot | null;
};

export async function createPkChallenge(input: {
  hostRoomId: string;
  challengerRoomId: string;
  hostUserId?: string | null;
  pkType?: 'pk_1v1' | 'pk_team';
  challengerTeamUserIds?: string[];
  teamSize?: 2 | 3 | 4 | 6;
  liveSell?: boolean;
  hostMediaId?: string | null;
  challengerMediaId?: string | null;
  hostMediaSurface?: PkMediaSurface | null;
  challengerMediaSurface?: PkMediaSurface | null;
  durationSec?: number;
  ttlSec?: number;
}): Promise<{ challenge: LivePkChallenge }> {
  return apiFetch('/api/live/pk/challenges', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchPkChallengeInbox(): Promise<LivePkChallengeInbox> {
  return apiFetch('/api/live/pk/challenges/inbox');
}

export type LivePkLifecycleHost = {
  userId: string;
  roomId: string;
  roomType: LiveLifecycleRoomType;
  startedAt: string;
  isLive?: boolean;
  isPkEligible?: boolean;
  lastUpdated?: string;
  supportedPkModes?: string[];
};

export async function fetchPkLiveHosts(): Promise<{ hosts: LivePkLifecycleHost[] }> {
  return apiFetch('/api/live/pk/challenges/hosts');
}

export async function setLivePkTeamRoster(
  roomId: string,
  userIds: string[],
): Promise<{ roomId: string; pkRosterUserIds: string[] }> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/pk-roster`, {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  });
}

export async function fetchPkChallenge(challengeId: string): Promise<{ challenge: LivePkChallenge }> {
  return apiFetch(`/api/live/pk/challenges/${encodeURIComponent(challengeId)}`);
}

export async function acceptPkChallenge(
  challengeId: string,
  input: { teamUserIds?: string[] } = {},
): Promise<{
  challenge: LivePkChallenge;
  pk: LivePkSessionSnapshot;
}> {
  return apiFetch(`/api/live/pk/challenges/${encodeURIComponent(challengeId)}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function declinePkChallenge(challengeId: string): Promise<{ challenge: LivePkChallenge }> {
  return apiFetch(`/api/live/pk/challenges/${encodeURIComponent(challengeId)}/decline`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function cancelPkChallenge(challengeId: string): Promise<{ challenge: LivePkChallenge }> {
  return apiFetch(`/api/live/pk/challenges/${encodeURIComponent(challengeId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function expirePkChallenge(challengeId: string): Promise<{ challenge: LivePkChallenge }> {
  return apiFetch(`/api/live/pk/challenges/${encodeURIComponent(challengeId)}/expire`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchHostDashboardSnapshot(roomId: string, afterSequence = 0): Promise<{
  snapshot: LiveHostDashboardSnapshot;
  deltas: LiveHostDashboardDelta[];
}> {
  return apiFetch(
    `/api/live/rooms/${encodeURIComponent(roomId)}/host-dashboard/snapshot?afterSequence=${Math.max(0, afterSequence)}`,
  );
}

/** After a gift wallet settle, notify lifecycle so PK scores consume the event once. */
export async function notifyLifecycleGiftSettlement(input: {
  roomId: string;
  clientRequestId: string;
  receiverId: string;
  value: number;
}): Promise<{
  ok: boolean;
  applied?: boolean;
  duplicate?: boolean;
  giftEventId?: string;
  localScore?: number | null;
  opponentScore?: number | null;
  reason?: string;
}> {
  const roomId = input.roomId.trim();
  if (!roomId) return { ok: false, reason: 'missing_room' };
  const result = await apiFetch<{
    ok: boolean;
    applied?: boolean;
    duplicate?: boolean;
    giftEventId?: string;
    localScore?: number | null;
    opponentScore?: number | null;
    reason?: string;
  }>(`/api/live/rooms/${encodeURIComponent(roomId)}/gifts/lifecycle-settle`, {
    method: 'POST',
    body: JSON.stringify({
      clientRequestId: input.clientRequestId,
      receiverId: input.receiverId,
      value: input.value,
    }),
  });
  // Mirror into UniLiveRTC PK domain (idempotent by giftEventId).
  try {
    const { applyDomainPkGiftScore } = await import('./unilive-rtc/pkDomain');
    const giftEventId = String(result?.giftEventId || input.clientRequestId || '').trim();
    if (giftEventId && Number(input.value) > 0) {
      applyDomainPkGiftScore({
        roomId,
        recipientUserId: input.receiverId,
        points: Number(input.value) || 0,
        giftEventId,
      });
    }
  } catch {
    /* domain mirror must not break settlement */
  }
  return result;
}

export type LiveHostDashboardIngest = {
  kind: 'comment' | 'reaction' | 'share' | 'follow' | 'audience' | 'media';
  count?: number;
  roomType?: LiveLifecycleRoomType;
  audience?: {
    currentUniqueViewers?: number;
    currentConnections?: number;
    seated?: number;
    pendingSeatRequests?: number;
  };
  media?: {
    connectionState?: string;
    connectionQuality?: string;
    uploadBitrate?: number | null;
    framesPerSecond?: number | null;
    packetLoss?: number | null;
    roundTripTime?: number | null;
  };
};

export async function ingestLiveHostDashboard(
  roomId: string,
  event: LiveHostDashboardIngest,
): Promise<LiveHostDashboardSnapshot | { ok: boolean }> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/host-dashboard/ingest`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function fetchHostLiveSummary(roomId: string): Promise<LiveHostSummary> {
  return apiFetch(`/api/live/rooms/${encodeURIComponent(roomId)}/host-summary`);
}

