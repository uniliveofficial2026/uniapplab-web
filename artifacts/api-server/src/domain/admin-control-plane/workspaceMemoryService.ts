import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isStudioEnabled, workspacePersistDir } from "./workspaceRuntimeService";

const MEMORY_DIR = workspacePersistDir("workspace-memory");

export type MemoryKind = "fact" | "implementation" | "failure" | "pick" | "pattern" | "conversion";

export type MemoryEntry = {
  id: string;
  kind: MemoryKind;
  projectId: string;
  summary: string;
  detail?: string;
  resourceId?: string | null;
  changeSetId?: string | null;
  tags: string[];
  confidence: number;
  createdAt: string;
  lastUsedAt?: string;
};

function enabled(): boolean {
  return isStudioEnabled();
}

function memoryPath(id: string): string {
  return path.join(MEMORY_DIR, `${id}.json`);
}

function writeEntry(entry: MemoryEntry): void {
  mkdirSync(MEMORY_DIR, { recursive: true });
  writeFileSync(memoryPath(entry.id), JSON.stringify(entry, null, 2));
}

export function rememberMemory(input: Omit<MemoryEntry, "id" | "createdAt"> & { id?: string }): MemoryEntry {
  if (!enabled()) {
    return { ...input, id: "disabled", createdAt: new Date().toISOString() } as MemoryEntry;
  }
  const id =
    input.id ||
    createHash("sha256").update(`${input.projectId}:${input.summary}:${Date.now()}`).digest("hex").slice(0, 12);
  const entry: MemoryEntry = {
    ...input,
    id,
    tags: input.tags || [],
    confidence: input.confidence ?? 0.9,
    createdAt: new Date().toISOString(),
  };
  writeEntry(entry);
  return entry;
}

export function listMemory(projectId?: string, limit = 100): MemoryEntry[] {
  if (!enabled() || !existsSync(MEMORY_DIR)) return [];
  return readdirSync(MEMORY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(path.join(MEMORY_DIR, f), "utf8")) as MemoryEntry;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((e) => !projectId || e!.projectId === projectId || e!.projectId === "*")
    .sort((a, b) => String(b!.createdAt).localeCompare(String(a!.createdAt)))
    .slice(0, limit) as MemoryEntry[];
}

/** Semantic-ish recall: token overlap scoring — no guessing, ranked by evidence. */
export function recallMemory(query: string, projectId = "instacollab", limit = 12): MemoryEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (!tokens.length) return listMemory(projectId, limit);

  const scored = listMemory(projectId, 200).map((entry) => {
    const blob = `${entry.summary} ${entry.detail || ""} ${entry.tags.join(" ")} ${entry.resourceId || ""}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (blob.includes(t)) score += 1;
    }
    if (entry.kind === "failure") score += 0.5;
    if (entry.kind === "implementation" && entry.confidence > 0.85) score += 0.3;
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => {
      s.entry.lastUsedAt = new Date().toISOString();
      writeEntry(s.entry);
      return s.entry;
    });
}

export function memoryContextBlock(entries: MemoryEntry[]): string {
  if (!entries.length) return "";
  return entries
    .map((e) => `[${e.kind}] ${e.summary}${e.resourceId ? ` (${e.resourceId})` : ""}${e.detail ? ` — ${e.detail.slice(0, 120)}` : ""}`)
    .join("\n");
}

export function getMemoryStats(projectId = "instacollab"): {
  total: number;
  implementations: number;
  failures: number;
  patterns: number;
  recent: MemoryEntry[];
} {
  const all = listMemory(projectId, 500);
  return {
    total: all.length,
    implementations: all.filter((e) => e.kind === "implementation").length,
    failures: all.filter((e) => e.kind === "failure").length,
    patterns: all.filter((e) => e.kind === "pattern").length,
    recent: all.slice(0, 8),
  };
}
