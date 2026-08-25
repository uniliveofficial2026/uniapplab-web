/* generated — names/references only */
export const RUNTIME_CONFIG_INVENTORY = [
  {
    "id": "config.application.api-origin",
    "name": "Public API origin",
    "provider": "uniapplab",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "instacollab"
    ],
    "secretReference": null,
    "envName": "PUBLIC_APP_ORIGIN",
    "viteName": "VITE_API_URL",
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.application.app-origin",
    "name": "Public app origin",
    "provider": "uniapplab",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "instacollab"
    ],
    "secretReference": null,
    "envName": "PUBLIC_APP_ORIGIN",
    "viteName": "VITE_APP_ORIGIN",
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.application.websocket-origin",
    "name": "Public WebSocket origin",
    "provider": "uniapplab",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "instacollab",
      "chat-ws"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_CHAT_URL",
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.application.media-origin",
    "name": "Public media origin",
    "provider": "cloudflare-r2",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "instacollab"
    ],
    "secretReference": null,
    "envName": "R2_PUBLIC_BASE_URL",
    "viteName": "VITE_MEDIA_URL",
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.application.cdn-origin",
    "name": "Public CDN origin",
    "provider": "cloudflare",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_CDN_URL",
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.application.support-url",
    "name": "Support URL",
    "provider": "uniapplab",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.supabase.url",
    "name": "Supabase URL",
    "provider": "supabase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "instacollab",
      "edge"
    ],
    "secretReference": null,
    "envName": "SUPABASE_URL",
    "viteName": "VITE_SUPABASE_URL",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.supabase.anon-key",
    "name": "Supabase anon/publishable key",
    "provider": "supabase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "publishable-key",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "instacollab",
      "edge",
      "worker"
    ],
    "secretReference": null,
    "envName": "SUPABASE_ANON_KEY",
    "viteName": "VITE_SUPABASE_ANON_KEY",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.supabase.service-role-key",
    "name": "Supabase service-role key",
    "provider": "supabase",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://SUPABASE_SERVICE_ROLE_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.database.url",
    "name": "Postgres connection URL",
    "provider": "supabase-postgres",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://DATABASE_URL",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.api-key",
    "name": "Firebase web API key",
    "provider": "firebase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "publishable-key",
    "required": false,
    "runtimeConsumers": [
      "instacollab",
      "api-server"
    ],
    "secretReference": null,
    "envName": "FIREBASE_API_KEY",
    "viteName": "VITE_FIREBASE_API_KEY",
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.auth-domain",
    "name": "Firebase auth domain",
    "provider": "firebase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "hostname",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_FIREBASE_AUTH_DOMAIN",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.project-id",
    "name": "Firebase project ID",
    "provider": "firebase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab",
      "api-server"
    ],
    "secretReference": null,
    "envName": "FIREBASE_PROJECT_ID",
    "viteName": "VITE_FIREBASE_PROJECT_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.app-id",
    "name": "Firebase app ID",
    "provider": "firebase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_FIREBASE_APP_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.messaging-sender-id",
    "name": "FCM sender ID",
    "provider": "firebase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.storage-bucket",
    "name": "Firebase storage bucket name",
    "provider": "firebase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_FIREBASE_STORAGE_BUCKET",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.measurement-id",
    "name": "GA measurement ID",
    "provider": "firebase",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_FIREBASE_MEASUREMENT_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.firebase.service-account",
    "name": "Firebase service account JSON",
    "provider": "firebase",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://FIREBASE_SERVICE_ACCOUNT_JSON",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.oauth.native-scheme",
    "name": "Native OAuth URL scheme",
    "provider": "oauth",
    "classification": "NATIVE_BUILD_TIME",
    "valueType": "string",
    "required": true,
    "runtimeConsumers": [
      "instacollab-native"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": true,
    "requiresNativeRebuild": true
  },
  {
    "id": "config.oauth.google-client-id",
    "name": "Google OAuth client ID",
    "provider": "google-oauth",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.oauth.client-secret",
    "name": "OAuth client secret",
    "provider": "google-oauth",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": "env://OAUTH_CLIENT_SECRET",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.livekit.server-url",
    "name": "LiveKit server URL",
    "provider": "livekit",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "instacollab",
      "edge"
    ],
    "secretReference": null,
    "envName": "LIVEKIT_URL",
    "viteName": "VITE_LIVEKIT_URL",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.livekit.api-key",
    "name": "LiveKit API key",
    "provider": "livekit",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": "env://LIVEKIT_API_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.livekit.api-secret",
    "name": "LiveKit API secret",
    "provider": "livekit",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": "env://LIVEKIT_API_SECRET",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.tencent.rtc.sdk-app-id",
    "name": "Tencent RTC SDKAppID",
    "provider": "tencent-rtc",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "api-server",
      "instacollab"
    ],
    "secretReference": null,
    "envName": "TENCENT_RTC_SDK_APP_ID",
    "viteName": "VITE_TENCENT_RTC_SDK_APP_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.tencent.rtc.secret-key",
    "name": "Tencent RTC secret key",
    "provider": "tencent-rtc",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://TENCENT_RTC_SECRET_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.tencent.webar.app-id",
    "name": "Tencent WebAR App ID",
    "provider": "tencent-webar",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_TENCENT_WEBAR_APP_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.tencent.webar.license-key",
    "name": "Tencent WebAR license key",
    "provider": "tencent-webar",
    "classification": "PUBLIC_BUILD_TIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_TENCENT_WEBAR_LICENSE_KEY",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": true,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.tencent.webar.token",
    "name": "Tencent WebAR token",
    "provider": "tencent-webar",
    "classification": "PUBLIC_BUILD_TIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_TENCENT_WEBAR_TOKEN",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": true,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.tencent.native.bundle-id",
    "name": "Tencent native bundle ID",
    "provider": "tencent-webar",
    "classification": "NATIVE_BUILD_TIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab-native"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_TENCENT_BUNDLE_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": true
  },
  {
    "id": "config.tencent.native.license-url",
    "name": "Tencent native license URL",
    "provider": "tencent-webar",
    "classification": "NATIVE_BUILD_TIME",
    "valueType": "url",
    "required": false,
    "runtimeConsumers": [
      "instacollab-native"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_TENCENT_LICENSE_URL",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": true
  },
  {
    "id": "config.tencent.native.license-key",
    "name": "Tencent native license key",
    "provider": "tencent-webar",
    "classification": "NATIVE_BUILD_TIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab-native"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_TENCENT_LICENSE_KEY",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": true
  },
  {
    "id": "config.upstash.redis-url",
    "name": "Upstash Redis REST URL",
    "provider": "upstash",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": null,
    "envName": "UPSTASH_REDIS_REST_URL",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.upstash.redis-token",
    "name": "Upstash Redis REST token",
    "provider": "upstash",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": "env://UPSTASH_REDIS_REST_TOKEN",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.qstash.current-signing-key",
    "name": "QStash current signing key",
    "provider": "upstash-qstash",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://QSTASH_CURRENT_SIGNING_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.qstash.next-signing-key",
    "name": "QStash next signing key",
    "provider": "upstash-qstash",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://QSTASH_NEXT_SIGNING_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.r2.public-base-url",
    "name": "R2 public base URL",
    "provider": "cloudflare-r2",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "instacollab",
      "worker"
    ],
    "secretReference": null,
    "envName": "R2_PUBLIC_BASE_URL",
    "viteName": null,
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.r2.account-id",
    "name": "R2 account ID",
    "provider": "cloudflare-r2",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": null,
    "envName": "R2_ACCOUNT_ID",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.r2.endpoint",
    "name": "R2 S3 endpoint",
    "provider": "cloudflare-r2",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "url",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": null,
    "envName": "R2_ENDPOINT",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.r2.bucket",
    "name": "R2 bucket name",
    "provider": "cloudflare-r2",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "string",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "worker"
    ],
    "secretReference": null,
    "envName": "R2_BUCKET",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.r2.access-key-id",
    "name": "R2 access key ID",
    "provider": "cloudflare-r2",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://R2_ACCESS_KEY_ID",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.r2.secret-access-key",
    "name": "R2 secret access key",
    "provider": "cloudflare-r2",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://R2_SECRET_ACCESS_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.media.worker-url",
    "name": "Media worker URL",
    "provider": "cloudflare-worker",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "url",
    "required": false,
    "runtimeConsumers": [
      "api-server",
      "instacollab",
      "edge"
    ],
    "secretReference": null,
    "envName": "MEDIA_WORKER_URL",
    "viteName": "VITE_MEDIA_WORKER_URL",
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.media.upload-signing-secret",
    "name": "Media upload signing secret",
    "provider": "cloudflare-worker",
    "classification": "WORKER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "worker"
    ],
    "secretReference": "cloudflare-secret://UPLOAD_SIGNING_SECRET",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.stripe.publishable-key",
    "name": "Stripe publishable key",
    "provider": "stripe",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "publishable-key",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_STRIPE_PUBLISHABLE_KEY",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.stripe.secret-key",
    "name": "Stripe secret key",
    "provider": "stripe",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": "env://STRIPE_SECRET_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.stripe.webhook-secret",
    "name": "Stripe webhook secret",
    "provider": "stripe",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": "env://STRIPE_WEBHOOK_SECRET",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.email.resend-api-key",
    "name": "Resend API key",
    "provider": "resend",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://RESEND_API_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.email.from",
    "name": "Resend from address",
    "provider": "resend",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "email",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": null,
    "envName": "RESEND_FROM",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.translation.gemini-api-key",
    "name": "Gemini / translation API key",
    "provider": "gemini",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": true,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://GEMINI_API_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": true,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.notifications.fcm-sender-id",
    "name": "Push sender ID",
    "provider": "firebase-messaging",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.analytics.ux-telemetry",
    "name": "UX telemetry flag",
    "provider": "uniapplab",
    "classification": "FEATURE_FLAG",
    "valueType": "boolean",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_UX_TELEMETRY",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.features.handoff",
    "name": "Handoff feature flag",
    "provider": "uniapplab",
    "classification": "FEATURE_FLAG",
    "valueType": "boolean",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_HANDOFF",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.features.unified-live",
    "name": "Unified live flag",
    "provider": "uniapplab",
    "classification": "FEATURE_FLAG",
    "valueType": "boolean",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_UNIFIED_LIVE",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.features.tencent-rtc-transport",
    "name": "Tencent RTC transport flag",
    "provider": "tencent-rtc",
    "classification": "FEATURE_FLAG",
    "valueType": "boolean",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_TENCENT_RTC_TRANSPORT",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.features.firebase-emulators",
    "name": "Firebase emulator flag",
    "provider": "firebase",
    "classification": "FEATURE_FLAG",
    "valueType": "boolean",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_FIREBASE_USE_EMULATORS",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.features.pwa-dev",
    "name": "PWA dev flag",
    "provider": "uniapplab",
    "classification": "PUBLIC_BUILD_TIME",
    "valueType": "boolean",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_PWA_DEV",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": true,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.features.payments",
    "name": "Payments enabled",
    "provider": "stripe",
    "classification": "FEATURE_FLAG",
    "valueType": "boolean",
    "required": false,
    "runtimeConsumers": [
      "api-server",
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.limits.api-timeout-ms",
    "name": "API timeout ms",
    "provider": "uniapplab",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "number",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.internal.api-secret",
    "name": "Internal API shared secret",
    "provider": "uniapplab",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://INTERNAL_API_SECRET",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.internal.admin-usernames",
    "name": "Platform admin usernames",
    "provider": "uniapplab",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "api-server",
      "edge"
    ],
    "secretReference": null,
    "envName": "PLATFORM_ADMIN_USERNAMES",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.discord.public-key",
    "name": "Discord interactions public key",
    "provider": "discord",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": null,
    "envName": "DISCORD_PUBLIC_KEY",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.youtube.api-key",
    "name": "YouTube Data API key",
    "provider": "youtube",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://YOUTUBE_API_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.linear.api-key",
    "name": "Linear API key",
    "provider": "linear",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://LINEAR_API_KEY",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.linear.team-id",
    "name": "Linear team ID",
    "provider": "linear",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": null,
    "envName": "LINEAR_TEAM_ID",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.linear.webhook-secret",
    "name": "Linear webhook secret",
    "provider": "linear",
    "classification": "SERVER_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": "env://LINEAR_WEBHOOK_SECRET",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.edge.disk-cleanup-secret",
    "name": "Disk cleanup secret",
    "provider": "uniapplab",
    "classification": "EDGE_SECRET",
    "valueType": "secret-reference",
    "required": false,
    "runtimeConsumers": [
      "edge"
    ],
    "secretReference": "supabase-secret://DISK_CLEANUP_SECRET",
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.deepar.license-key",
    "name": "DeepAR license key",
    "provider": "deepar",
    "classification": "PUBLIC_BUILD_TIME",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "instacollab"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": "VITE_DEEPAR_LICENSE_KEY",
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": true,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.native.android-application-id",
    "name": "Android application ID",
    "provider": "uniapplab",
    "classification": "NATIVE_BUILD_TIME",
    "valueType": "string",
    "required": true,
    "runtimeConsumers": [
      "instacollab-native"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": true
  },
  {
    "id": "config.native.ios-bundle-id",
    "name": "iOS bundle identifier",
    "provider": "uniapplab",
    "classification": "NATIVE_BUILD_TIME",
    "valueType": "string",
    "required": true,
    "runtimeConsumers": [
      "instacollab-native"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": true
  },
  {
    "id": "config.ui-config.catalog-version",
    "name": "UI catalog bootstrap version",
    "provider": "uniapplab",
    "classification": "PUBLIC_RUNTIME",
    "valueType": "number",
    "required": true,
    "runtimeConsumers": [
      "instacollab",
      "api-server"
    ],
    "secretReference": null,
    "envName": null,
    "viteName": null,
    "fallbackPolicy": "last-known-good",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  },
  {
    "id": "config.vercel.environment",
    "name": "Vercel environment name",
    "provider": "vercel",
    "classification": "OPERATIONAL_PRIVATE",
    "valueType": "string",
    "required": false,
    "runtimeConsumers": [
      "api-server"
    ],
    "secretReference": null,
    "envName": "VERCEL_ENV",
    "viteName": null,
    "fallbackPolicy": "fail-closed",
    "requiresServerRestart": false,
    "requiresFrontendRebuild": false,
    "requiresNativeRebuild": false
  }
] as const;
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
export const BUNDLED_BOOTSTRAP_DEFAULTS = {
  "schemaVersion": 1,
  "configVersion": 1,
  "environment": "local",
  "public": {
    "apiOrigin": "http://localhost:5000",
    "appOrigin": "http://localhost:5173",
    "websocketOrigin": "",
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
export const PROVIDER_REGISTRY = [
  {
    "id": "supabase",
    "adapter": "AuthenticationProvider",
    "public": [
      "config.supabase.url",
      "config.supabase.anon-key"
    ],
    "private": [
      "config.supabase.service-role-key"
    ],
    "health": "supabaseUrlReachable",
    "domains": [
      "auth",
      "database",
      "realtime"
    ],
    "uiDependency": "none"
  },
  {
    "id": "livekit",
    "adapter": "LiveMediaProvider",
    "public": [
      "config.livekit.server-url"
    ],
    "private": [
      "config.livekit.api-key",
      "config.livekit.api-secret"
    ],
    "health": "livekitConfigured",
    "domains": [
      "live",
      "calls"
    ],
    "uiDependency": "call/live view models only"
  },
  {
    "id": "stripe",
    "adapter": "PaymentProvider",
    "public": [
      "config.stripe.publishable-key"
    ],
    "private": [
      "config.stripe.secret-key",
      "config.stripe.webhook-secret"
    ],
    "health": "stripeSecretPresent",
    "domains": [
      "wallet",
      "payments"
    ],
    "uiDependency": "PurchaseViewModel"
  },
  {
    "id": "cloudflare-r2",
    "adapter": "MediaStorageProvider",
    "public": [
      "config.r2.public-base-url",
      "config.media.worker-url"
    ],
    "private": [
      "config.r2.access-key-id",
      "config.r2.secret-access-key",
      "config.media.upload-signing-secret"
    ],
    "health": "r2OrWorkerConfigured",
    "domains": [
      "media"
    ],
    "uiDependency": "asset URLs only"
  },
  {
    "id": "upstash",
    "adapter": "RealtimeCacheProvider",
    "public": [],
    "private": [
      "config.upstash.redis-token"
    ],
    "operational": [
      "config.upstash.redis-url"
    ],
    "health": "upstashConfigured",
    "domains": [
      "presence",
      "ratelimit"
    ],
    "uiDependency": "none"
  },
  {
    "id": "gemini",
    "adapter": "TranslationProvider",
    "public": [],
    "private": [
      "config.translation.gemini-api-key"
    ],
    "health": "geminiKeyPresent",
    "domains": [
      "i18n"
    ],
    "uiDependency": "translation catalog only"
  },
  {
    "id": "resend",
    "adapter": "EmailProvider",
    "public": [],
    "private": [
      "config.email.resend-api-key"
    ],
    "health": "resendKeyPresent",
    "domains": [
      "email"
    ],
    "uiDependency": "none"
  },
  {
    "id": "firebase",
    "adapter": "NotificationProvider",
    "public": [
      "config.firebase.api-key",
      "config.firebase.project-id",
      "config.firebase.app-id"
    ],
    "private": [
      "config.firebase.service-account"
    ],
    "health": "firebasePublicConfigured",
    "domains": [
      "auth-fallback",
      "push"
    ],
    "uiDependency": "none"
  },
  {
    "id": "tencent-rtc",
    "adapter": "LiveMediaProvider",
    "public": [
      "config.tencent.rtc.sdk-app-id"
    ],
    "private": [
      "config.tencent.rtc.secret-key"
    ],
    "health": "tencentRtcConfigured",
    "domains": [
      "live-backup"
    ],
    "uiDependency": "none unless flag on"
  }
] as const;
