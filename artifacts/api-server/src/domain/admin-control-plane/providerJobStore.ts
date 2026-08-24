import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { workspacePersistDir } from "./workspaceRuntimeService";

export type ProviderJobStatus = "queued" | "running" | "ready" | "failed";

export type ProviderJob = {
  id: string;
  providerId: string;
  actionId: string;
  status: ProviderJobStatus;
  externalTaskId?: string | null;
  progress?: string | null;
  result?: Record<string, unknown> | null;
  changeSetId?: string | null;
  implementIds?: string[];
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

const JOB_DIR = workspacePersistDir("provider-jobs");

function jobPath(id: string): string {
  return path.join(JOB_DIR, `${id}.json`);
}

export function createProviderJob(input: {
  providerId: string;
  actionId: string;
  externalTaskId?: string;
}): ProviderJob {
  const id = createHash("sha256")
    .update(`${input.providerId}:${input.actionId}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 16);
  const now = new Date().toISOString();
  const job: ProviderJob = {
    id,
    providerId: input.providerId,
    actionId: input.actionId,
    status: input.externalTaskId ? "running" : "queued",
    externalTaskId: input.externalTaskId || null,
    createdAt: now,
    updatedAt: now,
  };
  writeProviderJob(job);
  return job;
}

export function writeProviderJob(job: ProviderJob): void {
  mkdirSync(JOB_DIR, { recursive: true });
  writeFileSync(jobPath(job.id), `${JSON.stringify({ ...job, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

export function readProviderJob(id: string): ProviderJob | null {
  const file = jobPath(id);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as ProviderJob;
  } catch {
    return null;
  }
}

export function patchProviderJob(id: string, patch: Partial<ProviderJob>): ProviderJob | null {
  const current = readProviderJob(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeProviderJob(next);
  return next;
}
