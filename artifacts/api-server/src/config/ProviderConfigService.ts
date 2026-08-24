import { PROVIDER_REGISTRY } from "./generated/inventory.generated";
import { healthCheckVersion } from "./ConfigHealthService";
import { getActive, getVersion } from "./configRepository";
import { detectRuntimeEnvironment } from "./envLoader";
import type { ProviderHealthResult } from "./ConfigHealthService";

export function listProviderAdapters() {
  return PROVIDER_REGISTRY.map((p) => ({
    provider: p.id,
    adapter: p.adapter,
    public: p.public,
    private: p.private,
    health: p.health,
    domains: p.domains,
    uiDependency: p.uiDependency,
  }));
}

export async function healthCheckActiveProviders(): Promise<ProviderHealthResult[]> {
  const env = detectRuntimeEnvironment();
  const active = getActive(env);
  if (!active) return [];
  const rec = getVersion(active.versionId);
  if (!rec) return [];
  return healthCheckVersion(rec).results;
}
