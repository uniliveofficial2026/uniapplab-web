import { existsSync } from "node:fs";
import path from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { detectAdminEnvironment } from "./adminIdentityService";

/** Studio / dev workspace features — enabled in local and cloud unless explicitly disabled. */
export function isStudioEnabled(): boolean {
  if (detectAdminEnvironment() === "test") return false;
  if (String(process.env.WORKSPACE_STUDIO_DISABLED || "").trim() === "1") return false;
  return true;
}

export function isCloudStudioRuntime(): boolean {
  const env = detectAdminEnvironment();
  return env === "production" || env === "preview" || env === "staging";
}

export function hasRepoFilesystem(): boolean {
  try {
    return existsSync(repoPath("config/ui-catalog")) && existsSync(repoPath("config/admin-access"));
  } catch {
    return false;
  }
}

/** True when the monorepo checkout is available on disk (local dev). */
export function isLocalFilesystemWorkspace(): boolean {
  return detectAdminEnvironment() === "local" && hasRepoFilesystem();
}

export function workspaceRuntimeRoot(): string {
  if (isLocalFilesystemWorkspace()) {
    return repoPath(".local-dev");
  }
  return path.resolve(process.cwd(), ".local-media/workspace-runtime");
}

export function workspaceRuntimePath(...segments: string[]): string {
  return path.join(workspaceRuntimeRoot(), ...segments);
}

/**
 * Persistent dirs for studio runtime data. Keeps existing local paths for compatibility;
 * cloud uses `.local-media/workspace-runtime/<subdir>`.
 */
export function workspacePersistDir(subdir: string): string {
  if (isLocalFilesystemWorkspace()) {
    const localRoots: Record<string, string> = {
      media: path.resolve(process.cwd(), ".local-media"),
      "provider-jobs": path.resolve(process.cwd(), ".local-media/provider-jobs"),
      "universal-implement": path.resolve(process.cwd(), ".local-media/universal-implement"),
      "design-agent": path.resolve(process.cwd(), ".local-media/design-agent"),
      "dev-agent": repoPath(".local-dev/dev-agent"),
      "workspace-memory": repoPath(".local-dev/workspace-memory"),
      mcp: repoPath(".local-dev"),
    };
    return localRoots[subdir] || workspaceRuntimePath(subdir);
  }
  return workspaceRuntimePath(subdir);
}
