import { uniapplabOrigin, isLocalDevHost, isUniapplabHost } from './domains/uniapplab';
import { getSupabaseClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

function apiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    // Same-origin /api/* on every UniAppLab app host (Vercel monorepo deploy).
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

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

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

export async function fetchWallet(): Promise<{ balance: number; transactions: unknown[] }> {
  return apiFetch('/api/wallet');
}

export async function transferCoins(toUser: string, amount: number): Promise<unknown> {
  return apiFetch('/api/wallet/transfer', {
    method: 'POST',
    body: JSON.stringify({ toUser, amount }),
  });
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

export async function createChatThread(memberIds: string[]): Promise<{ id: string }> {
  return apiFetch('/api/chat/threads', {
    method: 'POST',
    body: JSON.stringify({ memberIds }),
  });
}

export async function sendChatMessageApi(threadId: string, body: string): Promise<unknown> {
  return apiFetch('/api/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ threadId, body }),
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
};

export async function fetchPartyLiveKitToken(
  roomId: string,
  publish = true,
): Promise<PartyLiveKitTokenResponse> {
  return apiFetch('/api/livekit/party/token', {
    method: 'POST',
    body: JSON.stringify({ roomId, publish }),
  });
}
