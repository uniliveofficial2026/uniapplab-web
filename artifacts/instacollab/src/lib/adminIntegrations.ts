import { readIntegrationEnv, saveIntegrationEnv, getIntegrationEnvOverrides, type IntegrationEnvKey } from './integrationEnv';
import { isSupabaseConfigured } from './supabase/config';
import { isLiveKitConfigured } from './livekit/livekitConfig';
import { isTencentWebARConfigured } from './webar/webarConfig';
import { isTencentEffectMobileLicenseConfigured } from './webar/tencentMobileLicenseConfig';
import { isTencentRtcSdkAppIdConfigured } from './tencent/rtcConfig';
import { isDeepARConfigured } from './deepar/deeparConfig';
import { DEEPAR_ENABLED } from './deepar/deeparEnabled';
import { ensureBundledFirebaseConfig } from './firebase/runtimeAuthConfig';

export type { IntegrationEnvKey } from './integrationEnv';
export { readIntegrationEnv, saveIntegrationEnv, getIntegrationEnvOverrides } from './integrationEnv';

export type IntegrationServiceDef = {
  id: string;
  name: string;
  description: string;
  envKeys: string[];
  packages: string[];
  files: string[];
  scripts: string[];
  docsPath?: string;
};

export const BUILTIN_INTEGRATION_SERVICES: IntegrationServiceDef[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Auth, Postgres, realtime, storage',
    envKeys: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    packages: ['@supabase/supabase-js'],
    files: ['src/lib/supabase/client.ts', 'public/supabase-config.json', 'supabase/migrations/'],
    scripts: ['auth:bootstrap-db', 'auth:check:prod'],
    docsPath: 'artifacts/instacollab/.env.example',
  },
  {
    id: 'livekit',
    name: 'LiveKit',
    description: 'Live & party room real-time A/V',
    envKeys: ['VITE_LIVEKIT_URL'],
    packages: ['livekit-client'],
    files: ['src/lib/livekit/livekitConfig.ts', 'src/lib/live/liveDiscoveryPreviewKit.ts'],
    scripts: ['livekit:setup', 'check-livekit', 'livekit:env-vercel'],
  },
  {
    id: 'trtc',
    name: 'TRTC WebAR Beauty (Web&H5)',
    description: 'Tencent beauty on desktop + mobile browsers (domain-bound Web license)',
    envKeys: ['VITE_TENCENT_WEBAR_APP_ID', 'VITE_TENCENT_WEBAR_LICENSE_KEY', 'VITE_TENCENT_WEBAR_TOKEN'],
    packages: ['tencentcloud-webar'],
    files: ['src/lib/webar/webarConfig.ts', 'src/lib/webar/tencentWebARPool.ts', 'src/smule-rooms/components/LiveBeautySheet.tsx'],
    scripts: ['trtc:install', 'tencent:env-vercel', 'smoke-camera-pipeline'],
  },
  {
    id: 'trtc-mobile',
    name: 'Tencent Effect Mobile',
    description: 'Native iOS/Android Beauty AR license (License URL + Key) — not used by the web SDK',
    envKeys: [
      'VITE_TENCENT_APP_ID',
      'VITE_TENCENT_LICENSE_URL',
      'VITE_TENCENT_LICENSE_KEY',
      'VITE_TENCENT_BUNDLE_ID',
    ],
    packages: [],
    files: ['src/lib/webar/tencentMobileLicenseConfig.ts'],
    scripts: [],
  },
  {
    id: 'tencent-rtc',
    name: 'Tencent RTC (backup)',
    description:
      'Optional standby for Call · Conference · Live · Chat · RTC Engine — not active; LiveKit remains A/V transport',
    envKeys: ['VITE_TENCENT_RTC_SDK_APP_ID'],
    packages: [],
    files: ['src/lib/tencent/rtcConfig.ts'],
    scripts: [],
  },
  {
    id: 'deepar',
    name: 'DeepAR',
    description: 'DeepAR beauty presets (optional)',
    envKeys: ['VITE_DEEPAR_LICENSE_KEY'],
    packages: ['deepar'],
    files: ['src/lib/deepar/deeparConfig.ts', 'public/deepar-resources/', 'src/lib/deepar/deeparEnabled.ts'],
    scripts: ['deepar:setup', 'deepar:install', 'deepar:env-vercel'],
  },
  {
    id: 'firebase',
    name: 'Firebase',
    description: 'Fallback auth & Firestore sync',
    envKeys: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'],
    packages: ['firebase'],
    files: ['src/lib/firebase/app.ts', 'src/lib/firebase/runtimeAuthConfig.ts'],
    scripts: ['auth:check'],
  },
];

export const INTEGRATION_SERVICES = BUILTIN_INTEGRATION_SERVICES;

export type IntegrationServiceStatus = {
  id: string;
  configured: boolean;
  healthy: boolean;
  missingKeys: string[];
  note?: string;
};

export function getIntegrationServiceStatus(service: IntegrationServiceDef): IntegrationServiceStatus {
  const missingKeys = service.envKeys.filter((key) => !readIntegrationEnv(key));
  let configured = missingKeys.length === 0;
  let healthy = configured;
  let note: string | undefined;

  if (service.id === 'supabase') {
    configured = isSupabaseConfigured();
    healthy = configured;
  } else if (service.id === 'livekit') {
    configured = isLiveKitConfigured();
    healthy = configured;
  } else if (service.id === 'trtc') {
    configured = isTencentWebARConfigured();
    healthy = configured;
  } else if (service.id === 'trtc-mobile') {
    configured = isTencentEffectMobileLicenseConfigured();
    healthy = configured;
    if (configured) {
      note = 'Stored for native apps; phone browsers still use Web&H5 (VITE_TENCENT_WEBAR_*)';
    }
  } else if (service.id === 'tencent-rtc') {
    configured = isTencentRtcSdkAppIdConfigured();
    healthy = configured;
    if (configured) {
      note =
        'Backup credentials only. LiveKit still powers Call/Live/Chat. Flip VITE_TENCENT_RTC_TRANSPORT=true later if you opt into Tencent A/V.';
    }
  } else if (service.id === 'deepar') {
    configured = isDeepARConfigured();
    healthy = configured && DEEPAR_ENABLED;
    if (configured && !DEEPAR_ENABLED) note = 'License present but DEEPAR_ENABLED=false';
  } else if (service.id === 'firebase') {
    try {
      ensureBundledFirebaseConfig();
      configured = missingKeys.length === 0;
      healthy = configured;
    } catch {
      configured = false;
      healthy = false;
    }
  }

  return { id: service.id, configured, healthy, missingKeys, note };
}

export function buildEnvTemplate(services: IntegrationServiceDef[] = BUILTIN_INTEGRATION_SERVICES): string {
  const lines = ['# Instacollab integration template — paste into artifacts/instacollab/.env', ''];
  for (const service of services) {
    lines.push(`# ${service.name}`);
    for (const key of service.envKeys) {
      lines.push(`${key}=`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function autoFillIntegrationEnvFromRuntime(services: IntegrationServiceDef[] = BUILTIN_INTEGRATION_SERVICES): Record<string, string> {
  const next: Record<string, string> = { ...getIntegrationEnvOverrides() };
  for (const service of services) {
    for (const key of service.envKeys) {
      const builtIn = String(import.meta.env[key] ?? '').trim();
      if (builtIn && !next[key]) next[key] = builtIn;
    }
  }
  return next;
}
