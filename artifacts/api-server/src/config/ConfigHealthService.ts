import { isLiveKitConfigured } from "../lib/livekit";
import { isR2Configured } from "../lib/r2";
import { envPresent } from "./envLoader";
import { secretReferenceAvailable } from "./SecretResolver";
import { RUNTIME_CONFIG_INVENTORY } from "./generated/inventory.generated";
import type { RuntimeConfigVersion } from "./types";

export type ProviderHealthResult = {
  providerId: string;
  ok: boolean;
  reason?: string;
  checkedAt: string;
};

export function healthCheckVersion(rec: RuntimeConfigVersion): { ok: boolean; results: ProviderHealthResult[] } {
  const now = new Date().toISOString();
  const results: ProviderHealthResult[] = [];

  for (const [id, ref] of Object.entries(rec.bindings)) {
    const def = RUNTIME_CONFIG_INVENTORY.find((d) => d.id === id);
    if (!def || def.valueType !== "secret-reference") continue;
    const avail = secretReferenceAvailable(ref);
    if (!avail.ok && def.required) {
      results.push({ providerId: def.provider, ok: false, reason: avail.reason || "missing_secret_reference", checkedAt: now });
    }
  }

  results.push({
    providerId: "livekit",
    ok: isLiveKitConfigured() || !envPresent("LIVEKIT_API_SECRET"),
    reason: isLiveKitConfigured() ? undefined : envPresent("LIVEKIT_API_SECRET") ? "incomplete" : "optional_unset",
    checkedAt: now,
  });
  results.push({
    providerId: "cloudflare-r2",
    ok: isR2Configured() || envPresent("MEDIA_WORKER_URL") || !envPresent("R2_SECRET_ACCESS_KEY"),
    reason: isR2Configured() || envPresent("MEDIA_WORKER_URL") ? undefined : "optional_unset",
    checkedAt: now,
  });
  results.push({
    providerId: "stripe",
    ok: envPresent("STRIPE_SECRET_KEY") || !String(rec.publicValues.paymentsEnabled || false),
    reason: envPresent("STRIPE_SECRET_KEY") ? undefined : "optional_unset",
    checkedAt: now,
  });
  results.push({
    providerId: "supabase",
    ok: envPresent("SUPABASE_URL") && (envPresent("SUPABASE_ANON_KEY") || envPresent("VITE_SUPABASE_ANON_KEY")),
    reason: envPresent("SUPABASE_URL") ? undefined : "missing_public_url",
    checkedAt: now,
  });

  const requiredFail = results.some((r) => r.ok === false && (r.providerId === "supabase" && envPresent("SUPABASE_URL") === false ? false : r.reason === "missing_secret_reference"));
  const ok = !requiredFail && !results.some((r) => r.reason === "missing_secret_reference");
  return { ok, results };
}
