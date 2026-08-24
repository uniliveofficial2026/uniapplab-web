/* generated — public allowlist only */
export const PUBLIC_BOOTSTRAP_FIELD_MAP = {
  "config.application.api-origin": "apiOrigin",
  "config.application.app-origin": "appOrigin",
  "config.application.websocket-origin": "websocketOrigin",
  "config.application.media-origin": "mediaOrigin",
  "config.application.cdn-origin": "cdnOrigin",
  "config.application.support-url": "supportUrl",
  "config.supabase.url": "supabaseUrl",
  "config.supabase.anon-key": "supabaseAnonKey",
  "config.firebase.api-key": "firebaseApiKey",
  "config.firebase.auth-domain": "firebaseAuthDomain",
  "config.firebase.project-id": "firebaseProjectId",
  "config.firebase.app-id": "firebaseAppId",
  "config.livekit.server-url": "livekitUrl",
  "config.stripe.publishable-key": "stripePublishableKey",
  "config.tencent.rtc.sdk-app-id": "tencentRtcSdkAppId",
  "config.tencent.webar.app-id": "tencentWebarAppId",
  "config.media.worker-url": "mediaWorkerUrl",
  "config.r2.public-base-url": "r2PublicBaseUrl",
  "config.features.payments": "features.payments",
  "config.features.unified-live": "features.unifiedLive",
  "config.features.handoff": "features.handoff",
  "config.analytics.ux-telemetry": "features.uxTelemetry",
  "config.limits.api-timeout-ms": "limits.apiTimeoutMs",
  "config.ui-config.catalog-version": "uiCatalogVersion"
} as const;
export const PUBLIC_BOOTSTRAP_IDS = [
  "config.application.api-origin",
  "config.application.app-origin",
  "config.application.websocket-origin",
  "config.application.media-origin",
  "config.application.cdn-origin",
  "config.application.support-url",
  "config.supabase.url",
  "config.supabase.anon-key",
  "config.firebase.api-key",
  "config.firebase.auth-domain",
  "config.firebase.project-id",
  "config.firebase.app-id",
  "config.livekit.server-url",
  "config.stripe.publishable-key",
  "config.tencent.rtc.sdk-app-id",
  "config.tencent.webar.app-id",
  "config.media.worker-url",
  "config.r2.public-base-url",
  "config.features.payments",
  "config.features.unified-live",
  "config.features.handoff",
  "config.analytics.ux-telemetry",
  "config.limits.api-timeout-ms",
  "config.ui-config.catalog-version"
] as const;
export const BUNDLED_BOOTSTRAP_DEFAULTS = {
  "schemaVersion": 1,
  "configVersion": 1,
  "environment": "local",
  "public": {
    "apiOrigin": "http://localhost:5000",
    "appOrigin": "http://localhost:5173",
    "websocketOrigin": "ws://localhost:5173",
    "mediaOrigin": "",
    "cdnOrigin": "",
    "supportUrl": "",
    "supabaseUrl": "",
    "supabaseAnonKey": "",
    "firebaseApiKey": "",
    "firebaseAuthDomain": "",
    "firebaseProjectId": "",
    "firebaseAppId": "",
    "livekitUrl": "",
    "stripePublishableKey": "",
    "tencentRtcSdkAppId": "",
    "tencentWebarAppId": "",
    "mediaWorkerUrl": "",
    "r2PublicBaseUrl": "",
    "features": {
      "payments": false,
      "unifiedLive": false,
      "handoff": false,
      "uxTelemetry": false
    },
    "limits": {
      "apiTimeoutMs": 15000
    },
    "uiCatalogVersion": 1,
    "publicProviderIds": {
      "supabase": "supabase",
      "livekit": "livekit",
      "stripe": "stripe"
    }
  }
} as const;
