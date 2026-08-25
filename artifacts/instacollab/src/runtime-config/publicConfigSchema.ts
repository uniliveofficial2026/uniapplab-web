export type PublicBootstrapPublic = {
  apiOrigin: string;
  appOrigin: string;
  websocketOrigin: string;
  mediaOrigin: string;
  cdnOrigin?: string;
  supportUrl?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseAppId?: string;
  livekitUrl: string;
  stripePublishableKey?: string;
  tencentRtcSdkAppId?: string;
  tencentWebarAppId?: string;
  mediaWorkerUrl?: string;
  r2PublicBaseUrl?: string;
  publicProviderIds: Record<string, string>;
  features: {
    payments: boolean;
    unifiedLive: boolean;
    handoff: boolean;
    uxTelemetry: boolean;
  };
  limits: { apiTimeoutMs: number };
  uiCatalogVersion?: number;
};

export type PublicBootstrapResponse = {
  schemaVersion: 1;
  configVersion: number;
  environment: 'local' | 'test' | 'preview' | 'staging' | 'production';
  public: PublicBootstrapPublic;
  checksum: string;
};

const ALLOWED_PUBLIC_KEYS = new Set([
  'apiOrigin',
  'appOrigin',
  'websocketOrigin',
  'mediaOrigin',
  'cdnOrigin',
  'supportUrl',
  'supabaseUrl',
  'supabaseAnonKey',
  'firebaseApiKey',
  'firebaseAuthDomain',
  'firebaseProjectId',
  'firebaseAppId',
  'livekitUrl',
  'stripePublishableKey',
  'tencentRtcSdkAppId',
  'tencentWebarAppId',
  'mediaWorkerUrl',
  'r2PublicBaseUrl',
  'publicProviderIds',
  'features',
  'limits',
  'uiCatalogVersion',
]);

export function parsePublicBootstrap(input: unknown): PublicBootstrapResponse {
  if (!input || typeof input !== 'object') throw new Error('invalid_bootstrap');
  const rec = input as Record<string, unknown>;
  if (rec.schemaVersion !== 1) throw new Error('invalid_schema_version');
  if (typeof rec.configVersion !== 'number' || rec.configVersion < 1) throw new Error('invalid_config_version');
  const env = rec.environment;
  if (env !== 'local' && env !== 'test' && env !== 'preview' && env !== 'staging' && env !== 'production') {
    throw new Error('invalid_environment');
  }
  if (typeof rec.checksum !== 'string' || rec.checksum.length < 8) throw new Error('invalid_checksum');
  const pub = rec.public;
  if (!pub || typeof pub !== 'object') throw new Error('invalid_public');
  const p = pub as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!ALLOWED_PUBLIC_KEYS.has(key)) throw new Error(`unknown_public_key:${key}`);
  }
  const features = (p.features || {}) as Record<string, unknown>;
  const limits = (p.limits || {}) as Record<string, unknown>;
  const appOrigin = String(p.appOrigin || '');
  let websocketOrigin = String(p.websocketOrigin || '');
  // Client-side fail-open: never keep localhost / insecure ws websocket origins in production.
  {
    const looksLocal =
      !websocketOrigin ||
      /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(websocketOrigin) ||
      (env === 'production' && /^ws:\/\//i.test(websocketOrigin));
    if (looksLocal) {
      try {
        const u = new URL(appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://app.uniapplab.com'));
        u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
        websocketOrigin = u.origin;
      } catch {
        websocketOrigin = 'wss://app.uniapplab.com';
      }
    }
  }
  return {
    schemaVersion: 1,
    configVersion: rec.configVersion,
    environment: env,
    checksum: rec.checksum,
    public: {
      apiOrigin: String(p.apiOrigin || ''),
      appOrigin,
      websocketOrigin,
      mediaOrigin: String(p.mediaOrigin || ''),
      cdnOrigin: p.cdnOrigin == null ? undefined : String(p.cdnOrigin),
      supportUrl: p.supportUrl == null ? undefined : String(p.supportUrl),
      supabaseUrl: String(p.supabaseUrl || ''),
      supabaseAnonKey: String(p.supabaseAnonKey || ''),
      firebaseApiKey: p.firebaseApiKey == null ? undefined : String(p.firebaseApiKey),
      firebaseAuthDomain: p.firebaseAuthDomain == null ? undefined : String(p.firebaseAuthDomain),
      firebaseProjectId: p.firebaseProjectId == null ? undefined : String(p.firebaseProjectId),
      firebaseAppId: p.firebaseAppId == null ? undefined : String(p.firebaseAppId),
      livekitUrl: String(p.livekitUrl || ''),
      stripePublishableKey: p.stripePublishableKey == null ? undefined : String(p.stripePublishableKey),
      tencentRtcSdkAppId: p.tencentRtcSdkAppId == null ? undefined : String(p.tencentRtcSdkAppId),
      tencentWebarAppId: p.tencentWebarAppId == null ? undefined : String(p.tencentWebarAppId),
      mediaWorkerUrl: p.mediaWorkerUrl == null ? undefined : String(p.mediaWorkerUrl),
      r2PublicBaseUrl: p.r2PublicBaseUrl == null ? undefined : String(p.r2PublicBaseUrl),
      publicProviderIds: (p.publicProviderIds && typeof p.publicProviderIds === 'object' ? p.publicProviderIds : {}) as Record<string, string>,
      features: {
        payments: Boolean(features.payments),
        unifiedLive: Boolean(features.unifiedLive),
        handoff: Boolean(features.handoff),
        uxTelemetry: Boolean(features.uxTelemetry),
      },
      limits: {
        apiTimeoutMs: Number(limits.apiTimeoutMs) > 0 ? Number(limits.apiTimeoutMs) : 15000,
      },
      uiCatalogVersion: typeof p.uiCatalogVersion === 'number' ? p.uiCatalogVersion : undefined,
    },
  };
}
