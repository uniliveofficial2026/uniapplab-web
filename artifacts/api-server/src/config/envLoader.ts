import type { RuntimeEnvironment } from "./types";

export function detectRuntimeEnvironment(): RuntimeEnvironment {
  const explicit = String(process.env.UNILIVE_RUNTIME_ENV || "").trim();
  if (explicit === "local" || explicit === "test" || explicit === "preview" || explicit === "staging" || explicit === "production") {
    return explicit;
  }
  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.NODE_ENV === "production" && process.env.VERCEL === "1") return "production";
  return "local";
}

export function readPublicEnv(name: string | null | undefined): string {
  if (!name) return "";
  return String(process.env[name] || "").trim();
}

export function envPresent(name: string): boolean {
  return Boolean(String(process.env[name] || "").trim());
}
