import { healthCheckActiveProviders, listProviderAdapters } from "../../config/ProviderConfigService";
import { ensureBaseline, getActiveVersionSummary } from "../../config/RuntimeConfigService";

export async function controlPlaneHealth() {
  ensureBaseline();
  const providers = await healthCheckActiveProviders();
  return {
    config: getActiveVersionSummary(),
    adapters: listProviderAdapters(),
    providers,
    snapshotLoading: { ok: true, fallbackRate: 0 },
    missingAssets: 0,
    missingTranslations: 0,
  };
}
