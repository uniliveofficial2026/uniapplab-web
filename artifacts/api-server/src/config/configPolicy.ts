import { detectRuntimeEnvironment } from "./envLoader";
import type { RuntimeEnvironment } from "./types";

export const FAIL_CLOSED_PROVIDERS = new Set(["supabase", "stripe", "livekit", "cloudflare-r2"]);

export function assertNotProductionActivationFromLocal(target: RuntimeEnvironment): void {
  if (target !== "production") return;
  if (detectRuntimeEnvironment() !== "production") {
    throw new Error("production configuration cannot be activated from local/test");
  }
  if (process.env.RUNTIME_CONFIG_ALLOW_PRODUCTION_ACTIVATION === "1") {
    throw new Error("production activation flag is forbidden in this workspace");
  }
}

export function assertEnvironmentIsolation(from: RuntimeEnvironment, to: RuntimeEnvironment): void {
  if (from === "production" && to !== "production") {
    throw new Error("production cannot fall back to development credentials");
  }
}

export function unknownKeysRejected(input: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(input).filter((k) => !allowed.has(k));
}
