/**
 * UniAppLab production domain map.
 * Override any URL via VITE_* env vars in `.env` (see .env.example).
 */

export type UniapplabService =
  | 'landing'
  | 'www'
  | 'app'
  | 'api'
  | 'live'
  | 'call'
  | 'chat'
  | 'media'
  | 'cdn'
  | 'admin';

const HOSTS: Record<UniapplabService, string> = {
  landing: 'uniapplab.com',
  www: 'www.uniapplab.com',
  app: 'app.uniapplab.com',
  api: 'api.uniapplab.com',
  live: 'live.uniapplab.com',
  call: 'call.uniapplab.com',
  chat: 'chat.uniapplab.com',
  media: 'media.uniapplab.com',
  cdn: 'cdn.uniapplab.com',
  admin: 'admin.uniapplab.com',
};

const ENV_KEYS: Record<UniapplabService, string> = {
  landing: 'VITE_LANDING_URL',
  www: 'VITE_SITE_URL',
  app: 'VITE_APP_ORIGIN',
  api: 'VITE_API_URL',
  live: 'VITE_LIVE_URL',
  call: 'VITE_CALL_URL',
  chat: 'VITE_CHAT_URL',
  media: 'VITE_MEDIA_URL',
  cdn: 'VITE_CDN_URL',
  admin: 'VITE_ADMIN_URL',
};

export const UNIAPPLAB_APEX = 'uniapplab.com';

export function uniapplabHost(service: UniapplabService): string {
  return HOSTS[service];
}

/** HTTPS origin for a service (env override → production default). */
export function uniapplabOrigin(service: UniapplabService): string {
  const envKey = ENV_KEYS[service];
  const fromEnv = String(import.meta.env[envKey as keyof ImportMetaEnv] || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return `https://${HOSTS[service]}`;
}

export function isUniapplabHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === UNIAPPLAB_APEX || host.endsWith(`.${UNIAPPLAB_APEX}`);
}

export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** Primary app URL — production app subdomain or local dev server. */
export function getAppOrigin(): string {
  const fromEnv = String(import.meta.env.VITE_APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (isLocalDevHost(hostname)) {
      return origin.replace(/^https?:\/\/127\.0\.0\.1/, 'http://localhost');
    }
    if (isUniapplabHost(hostname)) return origin;
  }

  return uniapplabOrigin('app');
}

/** All origins to allowlist in Supabase + Google OAuth. */
export function getOAuthAllowlistOrigins(): string[] {
  const origins = new Set<string>([
    getAppOrigin(),
    uniapplabOrigin('app'),
    uniapplabOrigin('landing'),
    uniapplabOrigin('www'),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  if (typeof window !== 'undefined') {
    origins.add(window.location.origin.replace(/^https?:\/\/127\.0\.0\.1/, 'http://localhost'));
  }

  return [...origins].filter(Boolean);
}

export const UNIAPPLAB_SERVICES: { service: UniapplabService; label: string; url: string }[] = (
  Object.keys(HOSTS) as UniapplabService[]
).map((service) => ({
  service,
  label: HOSTS[service],
  url: uniapplabOrigin(service),
}));
