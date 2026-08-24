import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { getUiCloneDetail } from "./uiCloneCatalogService";
import { getProjectApp, projectContextForAgent } from "./projectRegistryService";
import type { DevAgentContext } from "./devAgentService";
import { hasRepoFilesystem } from "./workspaceRuntimeService";

export type GroundedSourceFile = {
  path: string;
  exists: boolean;
  excerpt: string;
  lineCount: number;
};

export type GroundedContext = {
  citations: string[];
  missing: string[];
  catalogDetail?: Record<string, unknown> | null;
  sourceFiles: GroundedSourceFile[];
  project: Record<string, unknown>;
  pickSummary?: Record<string, unknown> | null;
  debugSummary?: { errorCount: number; warnCount: number; lastErrors: string[] };
};

const MAX_EXCERPT = 6000;

function safeReadRepoFile(relPath: string): GroundedSourceFile {
  const normalized = relPath.replace(/^\/+/, "");
  const abs = repoPath(normalized);
  if (!existsSync(abs)) {
    return { path: normalized, exists: false, excerpt: "", lineCount: 0 };
  }
  try {
    const text = readFileSync(abs, "utf8");
    return {
      path: normalized,
      exists: true,
      excerpt: text.slice(0, MAX_EXCERPT),
      lineCount: text.split("\n").length,
    };
  } catch {
    return { path: normalized, exists: false, excerpt: "", lineCount: 0 };
  }
}

function grepComponentHint(componentId: string, projectPath: string): GroundedSourceFile | null {
  const base = repoPath(projectPath, "src");
  if (!existsSync(base)) return null;
  const slug = componentId.replace(/^component\./, "").split(".")[0];
  const candidates = [
    join(projectPath, "src", "components", `${slug}.tsx`),
    join(projectPath, "src", "components", slug, "index.tsx"),
  ];
  for (const rel of candidates) {
    const file = safeReadRepoFile(rel);
    if (file.exists) return file;
  }
  return null;
}

export function buildGroundedContext(ctx: DevAgentContext): GroundedContext {
  const citations: string[] = [];
  const missing: string[] = [];
  const sourceFiles: GroundedSourceFile[] = [];
  let catalogDetail: Record<string, unknown> | null = null;

  const projectId = ctx.projectId || "instacollab";
  const project = projectContextForAgent(String(projectId));
  citations.push(`project:${projectId}`);

  const app = getProjectApp(String(projectId));
  if (app) citations.push(`path:${app.path}`);

  if (ctx.detail?.resourceId) {
    try {
      catalogDetail = getUiCloneDetail(ctx.detail.resourceId) as Record<string, unknown>;
      citations.push(`catalog:${ctx.detail.resourceId}`);
      const sp =
        (catalogDetail.sourcePath as string | null) ||
        (ctx.detail.sourcePath as string | null) ||
        null;
      if (sp) {
        const file = safeReadRepoFile(sp);
        sourceFiles.push(file);
        if (file.exists) citations.push(`file:${sp}`);
        else if (hasRepoFilesystem()) missing.push(`Source file not found: ${sp}`);
      }
    } catch {
      missing.push(`Catalog resource not found: ${ctx.detail.resourceId}`);
    }
  }

  if (ctx.pick?.componentId && app?.path) {
    const hint = grepComponentHint(ctx.pick.componentId, app.path);
    if (hint) {
      sourceFiles.push(hint);
      citations.push(`file:${hint.path}`);
    }
  }

  const debugLogs = ctx.debugLogs || [];
  const errors = debugLogs.filter((l) => l.level === "error");
  const warns = debugLogs.filter((l) => l.level === "warn");

  return {
    citations,
    missing,
    catalogDetail,
    sourceFiles,
    project,
    pickSummary: ctx.pick || ctx.detail || null,
    debugSummary: debugLogs.length
      ? {
          errorCount: errors.length,
          warnCount: warns.length,
          lastErrors: errors.slice(-5).map((e) => e.message),
        }
      : undefined,
  };
}

export function groundingBlocksExecution(grounded: GroundedContext, mode: string): string | null {
  if (mode === "ask" || mode === "plan") return null;
  if (grounded.missing.length && !grounded.catalogDetail && !grounded.sourceFiles.some((f) => f.exists)) {
    return `Cannot act without ground truth. Missing: ${grounded.missing.join("; ")}. Pick an element or specify a catalog resource.`;
  }
  return null;
}
