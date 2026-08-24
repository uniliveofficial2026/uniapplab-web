import { secretReferenceEditSchema } from "@workspace/api-zod";
import { RUNTIME_CONFIG_INVENTORY } from "../../config/generated/inventory.generated";
import { secretReferenceAvailable } from "../../config/SecretResolver";
import { redactRecord } from "../../config/redaction";

export function listSecretMetadata() {
  return RUNTIME_CONFIG_INVENTORY.filter((d) => d.classification.includes("SECRET") || d.secretReference).map((d) => {
    const avail = d.secretReference ? secretReferenceAvailable(d.secretReference) : { ok: false, reason: "none" };
    return redactRecord({
      id: d.id,
      name: d.name,
      provider: d.provider,
      classification: d.classification,
      secretReference: d.secretReference,
      configured: avail.ok,
      health: avail.ok ? "configured" : avail.reason || "not_configured",
      consumers: d.runtimeConsumers,
      lastRotatedAt: null,
    });
  });
}

export function editSecretReference(input: unknown) {
  const body = secretReferenceEditSchema.parse(input);
  const def = RUNTIME_CONFIG_INVENTORY.find((d) => d.id === body.configId);
  if (!def) throw Object.assign(new Error("unknown config"), { status: 404, code: "error.notFound" });
  const avail = secretReferenceAvailable(body.secretReference);
  return {
    id: def.id,
    secretReference: body.secretReference,
    configured: avail.ok,
    health: avail.ok ? "configured" : avail.reason || "not_configured",
  };
}
