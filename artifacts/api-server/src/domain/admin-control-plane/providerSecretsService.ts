import { readWorkspaceConfig, THIRD_PARTY_PRESETS } from "./workspaceConfigService";
import {
  envProviderField,
  envProviderSecret,
  isEnvProviderConfigured,
  listEnvConnectedProviderIds,
  providerEnvSource,
} from "./envProviderCatalog";

export function getProviderSecret(providerId: string, secretKey: string): string {
  const fromEnv = envProviderSecret(providerId, secretKey);
  if (fromEnv) return fromEnv;

  const cfg = readWorkspaceConfig();
  const provider = cfg.thirdParty[providerId];
  const preset = THIRD_PARTY_PRESETS[providerId];
  const envKey = provider?.secretEnvKeys?.[secretKey] || preset?.secretEnvKeys?.[secretKey];
  if (!envKey) return "";
  return String(process.env[envKey] || "").trim();
}

export function getProviderField(providerId: string, field: string): string {
  const fromEnv = envProviderField(providerId, field);
  if (fromEnv) return fromEnv;

  const cfg = readWorkspaceConfig();
  const fromConfig = cfg.thirdParty[providerId]?.fields?.[field];
  if (fromConfig) return String(fromConfig).trim();
  return "";
}

/** Env keys always win — no Config toggle required. */
export function isProviderEnabled(providerId: string): boolean {
  if (isEnvProviderConfigured(providerId)) return true;
  const cfg = readWorkspaceConfig();
  const row = cfg.thirdParty[providerId];
  if (row?.enabled === false) return false;
  return isProviderConfigured(providerId);
}

export function isProviderConfigured(providerId: string): boolean {
  if (isEnvProviderConfigured(providerId)) return true;

  switch (providerId) {
    case "gemini":
      return Boolean(getProviderSecret("gemini", "apiKey"));
    case "runway":
      return Boolean(getProviderSecret("runway", "apiKey"));
    case "meshy":
      return Boolean(getProviderSecret("meshy", "apiKey"));
    case "figma":
      return Boolean(getProviderSecret("figma", "accessToken"));
    case "tencent":
      return Boolean(getProviderField("tencent", "sdkAppId")) && Boolean(getProviderSecret("tencent", "secretKey"));
    case "livekit":
      return Boolean(getProviderField("livekit", "serverUrl")) &&
        Boolean(getProviderSecret("livekit", "apiKey")) &&
        Boolean(getProviderSecret("livekit", "apiSecret"));
    case "vercel":
      return Boolean(getProviderSecret("vercel", "token"));
    case "stripe":
      return Boolean(getProviderSecret("stripe", "secretKey"));
    case "openai":
      return Boolean(getProviderSecret("openai", "apiKey"));
    case "cloudflare":
      return Boolean(getProviderSecret("cloudflare", "apiToken"));
    case "railway":
      return Boolean(getProviderSecret("railway", "token"));
    case "agora":
      return Boolean(getProviderField("agora", "appId")) && Boolean(getProviderSecret("agora", "appCertificate"));
    case "supabase":
      return Boolean(getProviderField("supabase", "url"));
    case "firebase":
      return Boolean(getProviderField("firebase", "projectId"));
    default: {
      const cfg = readWorkspaceConfig();
      return Boolean(cfg.thirdParty[providerId]?.enabled);
    }
  }
}

export function listAutoConnectedProviders(): string[] {
  return listEnvConnectedProviderIds();
}

export function providerSetupHint(providerId: string): string {
  if (isEnvProviderConfigured(providerId)) {
    return `Auto from .env (${providerEnvSource(providerId)})`;
  }
  return "Local engine — real work without this API; add .env key for native speed";
}

export { providerEnvSource, listEnvConnectedProviderIds };
