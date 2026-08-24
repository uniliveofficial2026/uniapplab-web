import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { detectAdminEnvironment } from "./adminIdentityService";
import { buildEnvThirdPartyConfig } from "./envProviderCatalog";
import { isStudioEnabled } from "./workspaceRuntimeService";

export type CloudWorkspaceConfig = {
  enabled: boolean;
  appOrigin: string;
  apiOrigin: string;
  adminOrigin: string;
};

export type ThirdPartyProviderConfig = {
  enabled?: boolean;
  label?: string;
  /** Non-secret fields only in workspace file; secrets use env refs. */
  fields: Record<string, string>;
  secretEnvKeys?: Record<string, string>;
};

export type WorkspaceConfig = {
  version: 1;
  updatedAt: string;
  cloud: CloudWorkspaceConfig;
  thirdParty: Record<string, ThirdPartyProviderConfig>;
  customApps?: Array<{
    id: string;
    name: string;
    path: string;
    kind?: ProjectAppKind;
    devPort?: number;
    previewPath?: string;
    description?: string;
  }>;
};

type ProjectAppKind = "react-vite" | "node" | "static" | "custom";

const CONFIG_VERSION = 1 as const;

export const THIRD_PARTY_PRESETS: Record<
  string,
  { label: string; description: string; fields: string[]; secretEnvKeys?: Record<string, string> }
> = {
  supabase: {
    label: "Supabase",
    description: "Database, auth, storage, edge functions",
    fields: ["url", "projectRef", "anonKey"],
    secretEnvKeys: { serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY" },
  },
  firebase: {
    label: "Firebase",
    description: "Auth, Firestore, FCM, hosting",
    fields: ["apiKey", "authDomain", "projectId", "appId"],
    secretEnvKeys: { serviceAccount: "FIREBASE_SERVICE_ACCOUNT" },
  },
  stripe: {
    label: "Stripe",
    description: "Payments and subscriptions",
    fields: ["publishableKey"],
    secretEnvKeys: { secretKey: "STRIPE_SECRET_KEY", webhookSecret: "STRIPE_WEBHOOK_SECRET" },
  },
  vercel: {
    label: "Vercel",
    description: "Deploy previews and production",
    fields: ["teamSlug", "projectName"],
    secretEnvKeys: { token: "VERCEL_TOKEN" },
  },
  gemini: {
    label: "Google Gemini",
    description: "Design Agent and Dev Agent AI",
    fields: [],
    secretEnvKeys: { apiKey: "GEMINI_API_KEY" },
  },
  livekit: {
    label: "LiveKit",
    description: "Realtime audio/video rooms",
    fields: ["serverUrl"],
    secretEnvKeys: { apiKey: "LIVEKIT_API_KEY", apiSecret: "LIVEKIT_API_SECRET" },
  },
  tencent: {
    label: "Tencent RTC",
    description: "Live streaming and TRTC",
    fields: ["sdkAppId"],
    secretEnvKeys: { secretKey: "TENCENT_RTC_SECRET_KEY" },
  },
  railway: {
    label: "Railway",
    description: "Backend services and workers",
    fields: ["projectId", "environmentId"],
    secretEnvKeys: { token: "RAILWAY_TOKEN" },
  },
  cloudflare: {
    label: "Cloudflare",
    description: "Workers, R2, DNS, email",
    fields: ["accountId"],
    secretEnvKeys: { apiToken: "CLOUDFLARE_API_TOKEN" },
  },
  figma: {
    label: "Figma",
    description: "Design files, Dev Mode, Code Connect — replaces separate Figma workflow",
    fields: ["fileKey", "teamId"],
    secretEnvKeys: { accessToken: "FIGMA_ACCESS_TOKEN" },
  },
  runway: {
    label: "Runway",
    description: "AI video generation — replaces Runway app for asset creation",
    fields: [],
    secretEnvKeys: { apiKey: "RUNWAY_API_KEY" },
  },
  meshy: {
    label: "Meshy",
    description: "3D models & textures for AR, gifts, and characters",
    fields: [],
    secretEnvKeys: { apiKey: "MESHY_API_KEY" },
  },
  openai: {
    label: "OpenAI",
    description: "Optional secondary models for agents",
    fields: ["organizationId"],
    secretEnvKeys: { apiKey: "OPENAI_API_KEY" },
  },
  agora: {
    label: "Agora",
    description: "Alternative RTC provider",
    fields: ["appId"],
    secretEnvKeys: { appCertificate: "AGORA_APP_CERTIFICATE" },
  },
};

function configDir(): string {
  if (detectAdminEnvironment() === "local") {
    return repoPath(".local-dev");
  }
  return path.resolve(process.cwd(), ".local-media/workspace-config");
}

function configPath(): string {
  return path.join(configDir(), "workspace-config.json");
}

function defaultCloud(): CloudWorkspaceConfig {
  const appOrigin = String(process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || "https://app.uniapplab.com").trim();
  const apiOrigin = String(process.env.VITE_API_URL || process.env.API_ORIGIN || appOrigin).trim();
  const adminOrigin = String(process.env.ADMIN_ORIGIN || process.env.VITE_ADMIN_ORIGIN || "").trim();
  return {
    enabled: detectAdminEnvironment() !== "local",
    appOrigin,
    apiOrigin,
    adminOrigin,
  };
}

export function defaultWorkspaceConfig(): WorkspaceConfig {
  return {
    version: CONFIG_VERSION,
    updatedAt: new Date().toISOString(),
    cloud: defaultCloud(),
    thirdParty: {},
  };
}

function envBootstrapThirdParty(): Record<string, ThirdPartyProviderConfig> {
  return buildEnvThirdPartyConfig();
}

function mergeThirdPartyFromEnv(
  file: Record<string, ThirdPartyProviderConfig>,
): Record<string, ThirdPartyProviderConfig> {
  const fromEnv = envBootstrapThirdParty();
  const merged = { ...file };
  for (const [id, envRow] of Object.entries(fromEnv)) {
    merged[id] = {
      ...merged[id],
      ...envRow,
      enabled: true,
      fields: { ...merged[id]?.fields, ...envRow.fields },
      secretEnvKeys: envRow.secretEnvKeys || merged[id]?.secretEnvKeys,
    };
  }
  return merged;
}

export function readWorkspaceConfig(): WorkspaceConfig {
  const file = configPath();
  let base = defaultWorkspaceConfig();
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as WorkspaceConfig;
      base = { ...base, ...parsed, cloud: { ...base.cloud, ...parsed.cloud }, thirdParty: parsed.thirdParty || {} };
    } catch {
      /* use defaults */
    }
  }
  base.thirdParty = mergeThirdPartyFromEnv(base.thirdParty);
  return base;
}

export function writeWorkspaceConfig(input: Partial<WorkspaceConfig>): WorkspaceConfig {
  const current = readWorkspaceConfig();
  const next: WorkspaceConfig = {
    ...current,
    ...input,
    version: CONFIG_VERSION,
    updatedAt: new Date().toISOString(),
    cloud: { ...current.cloud, ...input.cloud },
    thirdParty: input.thirdParty ? { ...current.thirdParty, ...input.thirdParty } : current.thirdParty,
  };
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function upsertThirdPartyProvider(
  providerId: string,
  patch: { enabled?: boolean; fields?: Record<string, string> },
): WorkspaceConfig {
  const current = readWorkspaceConfig();
  const preset = THIRD_PARTY_PRESETS[providerId];
  const existing = current.thirdParty[providerId] || {
    enabled: false,
    label: preset?.label || providerId,
    fields: {},
    secretEnvKeys: preset?.secretEnvKeys,
  };
  return writeWorkspaceConfig({
    thirdParty: {
      [providerId]: {
        ...existing,
        enabled: patch.enabled ?? existing.enabled,
        fields: { ...existing.fields, ...patch.fields },
      },
    },
  });
}

/** Dev workspace features (agent, design, MCP) — local and cloud; opt out with WORKSPACE_STUDIO_DISABLED=1. */
export function isDevWorkspaceEnabled(): boolean {
  return isStudioEnabled();
}

export function publicWorkspaceBootstrap(): {
  cloud: CloudWorkspaceConfig;
  liveAppOrigin: string;
  connectMode: "proxy" | "direct";
  devWorkspaceEnabled: boolean;
} {
  const cfg = readWorkspaceConfig();
  const cloudApp = cfg.cloud.appOrigin.replace(/\/$/, "");
  const useDirect = Boolean(cloudApp && cfg.cloud.enabled);
  return {
    cloud: cfg.cloud,
    liveAppOrigin: useDirect ? cloudApp : "",
    connectMode: useDirect ? "direct" : "proxy",
    devWorkspaceEnabled: isDevWorkspaceEnabled(),
  };
}
