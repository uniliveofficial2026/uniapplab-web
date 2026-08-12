import { uniapplabOrigin, isLocalDevHost, isUniapplabHost } from './domains/uniapplab';
import { getSupabaseClient } from './supabase/client';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './supabase/config';
import { fetchWithTimeout, NET_API_MS, NET_AUTH_MS, withTimeout } from './networkPolicy';

function apiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    // Same-origin /api/* on every UniLive app host (Vercel monorepo deploy).
    if (isUniapplabHost(hostname)) {
      return origin.replace(/\/$/, '');
    }
    // Local dev server and vite preview both use same-origin /api (dev proxy or soft 404).
    if (isLocalDevHost(hostname)) {
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
  return headers;
}

/**
 * Route groups migrated to Supabase Edge Functions.
 * `/api/<group>/...` → `${SUPABASE_URL}/functions/v1/<group>/...`.
 * The Vercel Express API remains the fallback for the Firebase-auth lane,
 * network failures, and any surface not yet cut over.
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

function edgeMigratedPath(path: string): string | null {
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
    // LiveKit party rooms may live only in Firestore, which the Edge Function
    // can't resolve; let Express (with its Firestore fallback) try on 404.
    if (res.status === 404 && edgePath.startsWith('/livekit/')) return null;
    // Only fall back when the Edge route itself is missing — not business 404s.
    // Also fall back for stream/party not found so Express can use Firestore/LiveKit.
    if (res.status === 404 && edgePath.startsWith('/admin/')) {
      const bodyText = await res.clone().text().catch(() => '');
      if (
        /"error"\s*:\s*"not_found"/i.test(bodyText) ||
        /"error"\s*:\s*"(stream_not_found|party_room_not_found)"/i.test(bodyText) ||
        (!bodyText.trim() && /\/(stop|ban|end)$/.test(edgePath))
      ) {
        return null;
      }
    }
    return res;
  } catch {
    // Edge unreachable/timeout — fall back to the Express API.
    return null;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

  const base = apiBaseUrl();
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

export async function createChatThread(memberIds: string[]): Promise<{ id: string }> {
  return apiFetch('/api/chat/threads', {
    method: 'POST',
    body: JSON.stringify({ memberIds }),
  });
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

export async function postPresenceHeartbeat(friendIds?: string[]): Promise<{
  ok: boolean;
  online?: boolean;
  userIds?: string[];
  configured?: boolean;
}> {
  return apiFetch('/api/presence/online', {
    method: 'POST',
    body: JSON.stringify({ friendIds }),
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
