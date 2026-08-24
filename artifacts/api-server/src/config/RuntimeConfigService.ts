import { RUNTIME_CONFIG_INVENTORY } from "./generated/inventory.generated";
import { detectRuntimeEnvironment } from "./envLoader";
import { getActive, getVersion, seedPublishedBaseline } from "./configRepository";
import { buildPublicBootstrapFromEnv } from "./PublicConfigService";

let seeded = false;

export function ensureBaseline(): void {
  if (seeded) return;
  const env = detectRuntimeEnvironment();
  if (!getActive(env)) {
    const bindings: Record<string, string> = {};
    for (const d of RUNTIME_CONFIG_INVENTORY) {
      if (d.secretReference) bindings[d.id] = d.secretReference;
      else if (d.envName) bindings[d.id] = `env://${d.envName}`;
      else if (d.viteName) bindings[d.id] = `env://${d.viteName}`;
    }
    seedPublishedBaseline({
      environment: env,
      bindings,
      publicValues: buildPublicBootstrapFromEnv().public,
    });
  }
  seeded = true;
}

export function listDefinitions() {
  return RUNTIME_CONFIG_INVENTORY.map((d) => ({
    id: d.id,
    name: d.name,
    provider: d.provider,
    classification: d.classification,
    valueType: d.valueType,
    required: d.required,
    runtimeConsumers: d.runtimeConsumers,
    secretReference: d.secretReference,
    fallbackPolicy: d.fallbackPolicy,
    requiresServerRestart: d.requiresServerRestart,
    requiresFrontendRebuild: d.requiresFrontendRebuild,
    requiresNativeRebuild: d.requiresNativeRebuild,
  }));
}

export function getActiveVersionSummary() {
  ensureBaseline();
  const env = detectRuntimeEnvironment();
  const active = getActive(env);
  if (!active) return null;
  const rec = getVersion(active.versionId);
  if (!rec) return null;
  return {
    id: rec.id,
    version: rec.version,
    environment: rec.environment,
    status: rec.status,
    checksum: rec.checksum,
  };
}
