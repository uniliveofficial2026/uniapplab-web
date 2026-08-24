import { THIRD_PARTY_PRESETS } from "./workspaceConfigService";
import type { ThirdPartyProviderConfig } from "./workspaceConfigService";

/** Read first non-empty env value from candidate keys (server + VITE_ aliases). */
export function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const val = String(process.env[key] || "").trim();
    if (val) return val;
  }
  return "";
}

export type EnvProviderSpec = {
  id: string;
  secrets: Record<string, string[]>;
  fields: Record<string, string[]>;
  configuredWhen: (ctx: { secret: (k: string) => string; field: (k: string) => string }) => boolean;
};

export const ENV_PROVIDER_SPECS: EnvProviderSpec[] = [
  {
    id: "gemini",
    secrets: { apiKey: ["GEMINI_API_KEY", "VITE_GEMINI_API_KEY", "GOOGLE_API_KEY"] },
    fields: {},
    configuredWhen: ({ secret }) => Boolean(secret("apiKey")),
  },
  {
    id: "runway",
    secrets: { apiKey: ["RUNWAY_API_KEY", "RUNWAYML_API_SECRET", "RUNWAYML_API_KEY"] },
    fields: {},
    configuredWhen: ({ secret }) => Boolean(secret("apiKey")),
  },
  {
    id: "meshy",
    secrets: { apiKey: ["MESHY_API_KEY", "MESHY_API_SECRET"] },
    fields: {},
    configuredWhen: ({ secret }) => Boolean(secret("apiKey")),
  },
  {
    id: "figma",
    secrets: { accessToken: ["FIGMA_ACCESS_TOKEN", "FIGMA_TOKEN", "FIGMA_PERSONAL_ACCESS_TOKEN"] },
    fields: { fileKey: ["FIGMA_FILE_KEY"], teamId: ["FIGMA_TEAM_ID"] },
    configuredWhen: ({ secret }) => Boolean(secret("accessToken")),
  },
  {
    id: "tencent",
    secrets: { secretKey: ["TENCENT_RTC_SECRET_KEY", "TENCENT_SECRET_KEY", "VITE_TENCENT_SECRET_KEY"] },
    fields: { sdkAppId: ["TENCENT_RTC_SDK_APP_ID", "VITE_TENCENT_RTC_SDK_APP_ID", "TENCENT_SDK_APP_ID"] },
    configuredWhen: ({ secret, field }) => Boolean(field("sdkAppId") && secret("secretKey")),
  },
  {
    id: "livekit",
    secrets: {
      apiKey: ["LIVEKIT_API_KEY"],
      apiSecret: ["LIVEKIT_API_SECRET", "LIVEKIT_SECRET_KEY"],
    },
    fields: { serverUrl: ["LIVEKIT_URL", "LIVEKIT_SERVER_URL", "VITE_LIVEKIT_URL"] },
    configuredWhen: ({ secret, field }) =>
      Boolean(field("serverUrl") && secret("apiKey") && secret("apiSecret")),
  },
  {
    id: "vercel",
    secrets: { token: ["VERCEL_TOKEN", "VERCEL_ACCESS_TOKEN"] },
    fields: { teamSlug: ["VERCEL_TEAM_SLUG", "VERCEL_ORG_ID"], projectName: ["VERCEL_PROJECT_NAME", "VERCEL_PROJECT_ID"] },
    configuredWhen: ({ secret }) => Boolean(secret("token")),
  },
  {
    id: "stripe",
    secrets: {
      secretKey: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
      webhookSecret: ["STRIPE_WEBHOOK_SECRET"],
    },
    fields: { publishableKey: ["STRIPE_PUBLISHABLE_KEY", "VITE_STRIPE_PUBLISHABLE_KEY"] },
    configuredWhen: ({ secret }) => Boolean(secret("secretKey")),
  },
  {
    id: "openai",
    secrets: { apiKey: ["OPENAI_API_KEY"] },
    fields: { organizationId: ["OPENAI_ORG_ID", "OPENAI_ORGANIZATION_ID"] },
    configuredWhen: ({ secret }) => Boolean(secret("apiKey")),
  },
  {
    id: "cloudflare",
    secrets: { apiToken: ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"] },
    fields: { accountId: ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"] },
    configuredWhen: ({ secret }) => Boolean(secret("apiToken")),
  },
  {
    id: "railway",
    secrets: { token: ["RAILWAY_TOKEN", "RAILWAY_API_TOKEN"] },
    fields: { projectId: ["RAILWAY_PROJECT_ID"], environmentId: ["RAILWAY_ENVIRONMENT_ID"] },
    configuredWhen: ({ secret }) => Boolean(secret("token")),
  },
  {
    id: "agora",
    secrets: { appCertificate: ["AGORA_APP_CERTIFICATE", "AGORA_APP_CERT"] },
    fields: { appId: ["AGORA_APP_ID", "VITE_AGORA_APP_ID"] },
    configuredWhen: ({ secret, field }) => Boolean(field("appId") && secret("appCertificate")),
  },
  {
    id: "supabase",
    secrets: { serviceRoleKey: ["SUPABASE_SERVICE_ROLE_KEY"] },
    fields: {
      url: ["SUPABASE_URL", "VITE_SUPABASE_URL"],
      projectRef: ["SUPABASE_PROJECT_REF", "VITE_SUPABASE_PROJECT_REF"],
      anonKey: ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"],
    },
    configuredWhen: ({ field }) => Boolean(field("url")),
  },
  {
    id: "firebase",
    secrets: { serviceAccount: ["FIREBASE_SERVICE_ACCOUNT", "GOOGLE_APPLICATION_CREDENTIALS_JSON"] },
    fields: {
      apiKey: ["FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"],
      authDomain: ["FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"],
      projectId: ["FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID", "GOOGLE_CLOUD_PROJECT"],
      appId: ["FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID"],
    },
    configuredWhen: ({ field }) => Boolean(field("projectId")),
  },
];

function specFor(providerId: string): EnvProviderSpec | null {
  return ENV_PROVIDER_SPECS.find((s) => s.id === providerId) || null;
}

export function envProviderSecret(providerId: string, secretKey: string): string {
  const spec = specFor(providerId);
  if (spec?.secrets[secretKey]) return readEnv(...spec.secrets[secretKey]);
  const preset = THIRD_PARTY_PRESETS[providerId];
  const presetKey = preset?.secretEnvKeys?.[secretKey];
  if (presetKey) return readEnv(presetKey);
  return "";
}

export function envProviderField(providerId: string, field: string): string {
  const spec = specFor(providerId);
  if (spec?.fields[field]) return readEnv(...spec.fields[field]);
  return "";
}

export function isEnvProviderConfigured(providerId: string): boolean {
  const spec = specFor(providerId);
  if (!spec) return false;
  const ctx = {
    secret: (k: string) => envProviderSecret(providerId, k),
    field: (k: string) => envProviderField(providerId, k),
  };
  return spec.configuredWhen(ctx);
}

export function listEnvConnectedProviderIds(): string[] {
  return ENV_PROVIDER_SPECS.filter((s) => isEnvProviderConfigured(s.id)).map((s) => s.id);
}

export function buildEnvThirdPartyConfig(): Record<string, ThirdPartyProviderConfig> {
  const out: Record<string, ThirdPartyProviderConfig> = {};
  for (const spec of ENV_PROVIDER_SPECS) {
    if (!isEnvProviderConfigured(spec.id)) continue;
    const preset = THIRD_PARTY_PRESETS[spec.id];
    const fields: Record<string, string> = {};
    for (const field of preset?.fields || Object.keys(spec.fields)) {
      const val = envProviderField(spec.id, field);
      if (val) fields[field] = val;
    }
    for (const [field, keys] of Object.entries(spec.fields)) {
      if (!fields[field]) {
        const val = readEnv(...keys);
        if (val) fields[field] = val;
      }
    }
    out[spec.id] = {
      enabled: true,
      label: preset?.label || spec.id,
      fields,
      secretEnvKeys: preset?.secretEnvKeys,
    };
  }
  return out;
}

export function providerEnvSource(providerId: string): "env" | "config" | "none" {
  if (isEnvProviderConfigured(providerId)) return "env";
  return "none";
}

export function envAutopilotSummary(): { fromEnv: string[]; total: number } {
  const fromEnv = listEnvConnectedProviderIds();
  return { fromEnv, total: ENV_PROVIDER_SPECS.length };
}
