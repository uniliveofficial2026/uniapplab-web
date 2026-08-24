import { createHash, randomUUID } from "node:crypto";
import type { AuditRecord, ConfigVersionStatus, RuntimeConfigVersion, RuntimeEnvironment } from "./types";

const versions = new Map<string, RuntimeConfigVersion>();
const activations = new Map<RuntimeEnvironment, { versionId: string; checksum: string; activatedAt: string }>();
const audit: AuditRecord[] = [];
let seq = 1;

function checksum(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function listVersions(environment?: RuntimeEnvironment): RuntimeConfigVersion[] {
  const all = [...versions.values()].sort((a, b) => b.version - a.version);
  return environment ? all.filter((v) => v.environment === environment) : all;
}

export function getVersion(id: string): RuntimeConfigVersion | undefined {
  return versions.get(id);
}

export function createDraft(input: {
  environment: RuntimeEnvironment;
  bindings: Record<string, string>;
  publicValues: Record<string, unknown>;
  actor: string;
  reason?: string;
}): RuntimeConfigVersion {
  const version = seq++;
  const rec: RuntimeConfigVersion = {
    id: randomUUID(),
    version,
    environment: input.environment,
    status: "draft",
    checksum: checksum({ bindings: input.bindings, publicValues: input.publicValues, version }),
    bindings: { ...input.bindings },
    publicValues: { ...input.publicValues },
    immutable: false,
    createdAt: new Date().toISOString(),
    actor: input.actor,
    reason: input.reason,
  };
  versions.set(rec.id, rec);
  return rec;
}

export function updateStatus(id: string, status: ConfigVersionStatus, extra: Partial<RuntimeConfigVersion> = {}): RuntimeConfigVersion {
  const rec = versions.get(id);
  if (!rec) throw new Error("version not found");
  if (rec.immutable && rec.status === "published" && status !== "active" && status !== "superseded" && status !== "rolled_back") {
    throw new Error("published versions are immutable");
  }
  if (rec.immutable && extra.bindings) throw new Error("published versions are immutable");
  if (rec.immutable && extra.publicValues) throw new Error("published versions are immutable");
  const next = { ...rec, ...extra, status };
  if (status === "published") {
    next.immutable = true;
    next.publishedAt = new Date().toISOString();
  }
  versions.set(id, next);
  return next;
}

export function getActive(environment: RuntimeEnvironment) {
  return activations.get(environment) ?? null;
}

export function activateAtomic(environment: RuntimeEnvironment, rec: RuntimeConfigVersion): RuntimeConfigVersion {
  const prev = activations.get(environment);
  if (prev) {
    const old = versions.get(prev.versionId);
    if (old && old.status === "active") updateStatus(old.id, "superseded");
  }
  const next = updateStatus(rec.id, "active", { activatedAt: new Date().toISOString(), immutable: true });
  activations.set(environment, { versionId: next.id, checksum: next.checksum, activatedAt: next.activatedAt! });
  return next;
}

export function appendAudit(row: Omit<AuditRecord, "id" | "at">): AuditRecord {
  const rec: AuditRecord = { id: randomUUID(), at: new Date().toISOString(), ...row };
  audit.push(rec);
  return rec;
}

export function listAudit(): AuditRecord[] {
  return [...audit].reverse();
}

export function seedPublishedBaseline(input: {
  environment: RuntimeEnvironment;
  bindings: Record<string, string>;
  publicValues: Record<string, unknown>;
}): RuntimeConfigVersion {
  const rec = createDraft({
    environment: input.environment,
    bindings: input.bindings,
    publicValues: input.publicValues,
    actor: "system",
    reason: "bundled baseline",
  });
  const published = updateStatus(rec.id, "published");
  return activateAtomic(input.environment, published);
}
