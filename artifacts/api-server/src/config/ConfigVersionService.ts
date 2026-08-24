import { RUNTIME_CONFIG_INVENTORY } from "./generated/inventory.generated";
import { parseSecretReference } from "./SecretResolver";
import { unknownKeysRejected } from "./configPolicy";
import { createDraft, getVersion, listVersions, updateStatus } from "./configRepository";
import type { RuntimeEnvironment } from "./types";

const knownIds = new Set(RUNTIME_CONFIG_INVENTORY.map((d) => d.id));

export function listConfigVersions(environment?: RuntimeEnvironment) {
  return listVersions(environment).map((v) => ({
    id: v.id,
    version: v.version,
    environment: v.environment,
    status: v.status,
    checksum: v.checksum,
    immutable: v.immutable,
    createdAt: v.createdAt,
    publishedAt: v.publishedAt,
    activatedAt: v.activatedAt,
  }));
}

export function createConfigVersion(input: {
  environment: RuntimeEnvironment;
  bindings?: Record<string, string>;
  publicValues?: Record<string, unknown>;
  actor: string;
  reason?: string;
}) {
  const bindings = input.bindings || {};
  const unknown = unknownKeysRejected(bindings, knownIds);
  if (unknown.length) throw new Error(`unknown config keys: ${unknown.join(",")}`);
  for (const [id, ref] of Object.entries(bindings)) {
    const def = RUNTIME_CONFIG_INVENTORY.find((d) => d.id === id);
    if (!def) continue;
    if (def.valueType === "secret-reference") parseSecretReference(ref);
    if (def.classification.includes("SECRET") && typeof ref === "string" && !ref.includes("://")) {
      throw new Error("secret values are not accepted; use a secret reference");
    }
  }
  if (input.publicValues && "value" in input.publicValues) {
    throw new Error("secret values are not accepted");
  }
  return createDraft({
    environment: input.environment,
    bindings,
    publicValues: input.publicValues || {},
    actor: input.actor,
    reason: input.reason,
  });
}

export function validateConfigVersion(id: string) {
  const rec = getVersion(id);
  if (!rec) throw new Error("version not found");
  const unknown = unknownKeysRejected(rec.bindings, knownIds);
  if (unknown.length) throw new Error(`unknown config keys: ${unknown.join(",")}`);
  for (const [cid, ref] of Object.entries(rec.bindings)) {
    const def = RUNTIME_CONFIG_INVENTORY.find((d) => d.id === cid);
    if (def?.valueType === "secret-reference") parseSecretReference(ref);
  }
  return updateStatus(id, "validated");
}
