import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { readWorkspaceConfig, writeWorkspaceConfig } from "./workspaceConfigService";

export type ProjectAppKind = "react-vite" | "react-native" | "flutter" | "ios-native" | "android-native" | "node" | "static" | "custom";

export type ProjectApp = {
  id: string;
  name: string;
  path: string;
  kind: ProjectAppKind;
  devPort?: number;
  previewPath?: string;
  description?: string;
};

const BUILTIN_APPS: ProjectApp[] = [
  {
    id: "instacollab",
    name: "UniLive's App",
    path: "artifacts/instacollab",
    kind: "react-vite",
    devPort: 5173,
    previewPath: "/home",
    description: "Main customer-facing app",
  },
  {
    id: "admin-panel",
    name: "Admin Panel",
    path: "artifacts/admin-panel",
    kind: "react-vite",
    devPort: 5180,
    previewPath: "/#/studio",
    description: "Control plane and dev workspace",
  },
  {
    id: "api-server",
    name: "API Server",
    path: "artifacts/api-server",
    kind: "node",
    devPort: 5001,
    previewPath: "/api/admin/me",
    description: "Backend and admin API",
  },
  {
    id: "mockup-sandbox",
    name: "Mockup Sandbox",
    path: "artifacts/mockup-sandbox",
    kind: "react-vite",
    description: "UI experiments and mockups",
  },
  {
    id: "chat-ws",
    name: "Chat WebSocket",
    path: "artifacts/chat-ws",
    kind: "node",
    description: "Realtime messaging service",
  },
];

function readCustomApps(): ProjectApp[] {
  try {
    const cfg = readWorkspaceConfig();
    const raw = (cfg as { customApps?: ProjectApp[] }).customApps;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function listProjectApps(): ProjectApp[] {
  const custom = readCustomApps();
  const byId = new Map<string, ProjectApp>();
  for (const app of BUILTIN_APPS) {
    if (existsSync(repoPath(app.path))) byId.set(app.id, app);
  }
  for (const app of custom) byId.set(app.id, app);
  return [...byId.values()];
}

export function getProjectApp(id: string): ProjectApp | null {
  return listProjectApps().find((a) => a.id === id) || null;
}

export function scanArtifactsForApps(): ProjectApp[] {
  const dir = repoPath("artifacts");
  if (!existsSync(dir)) return listProjectApps();
  const discovered: ProjectApp[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const pkgPath = path.join(full, "package.json");
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string; scripts?: Record<string, string> };
      const kind: ProjectAppKind = pkg.scripts?.dev?.includes("vite") ? "react-vite" : "node";
      discovered.push({
        id: name,
        name: pkg.name || name,
        path: `artifacts/${name}`,
        kind,
        description: "Discovered in monorepo",
      });
    } catch {
      /* skip */
    }
  }
  const merged = new Map(listProjectApps().map((a) => [a.id, a]));
  for (const d of discovered) if (!merged.has(d.id)) merged.set(d.id, d);
  return [...merged.values()];
}

export function registerCustomApp(app: Omit<ProjectApp, "kind"> & { kind?: ProjectAppKind }): ProjectApp[] {
  const custom = readCustomApps();
  const next: ProjectApp = {
    kind: app.kind || "custom",
    ...app,
  };
  const idx = custom.findIndex((a) => a.id === next.id);
  if (idx >= 0) custom[idx] = next;
  else custom.push(next);
  writeWorkspaceConfig({ customApps: custom } as Record<string, unknown>);
  return listProjectApps();
}

export function projectContextForAgent(appId: string): Record<string, unknown> {
  const app = getProjectApp(appId);
  if (!app) return { projectId: appId };
  return {
    projectId: app.id,
    projectName: app.name,
    projectPath: app.path,
    projectKind: app.kind,
    devPort: app.devPort,
    previewPath: app.previewPath,
  };
}

function gitText(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 8000 }).trim();
  } catch {
    return "";
  }
}

function detectPackageManager(dir: string): string {
  if (existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(dir, "bun.lockb")) || existsSync(path.join(dir, "bun.lock"))) return "bun";
  if (existsSync(path.join(dir, "package-lock.json"))) return "npm";
  if (existsSync(path.join(dir, "pubspec.yaml"))) return "flutter";
  if (existsSync(path.join(dir, "Cargo.toml"))) return "cargo";
  if (existsSync(path.join(dir, "go.mod"))) return "go";
  return "git";
}

export type DetectedProject = {
  id: string;
  name: string;
  path: string;
  kind: string;
  cwd: string;
  packageManager: string;
  scripts: string[];
  git: { root: string; branch: string; status: string };
  banner: string;
};

export function detectWorkspaceProject(projectId?: string): DetectedProject {
  const apps = scanArtifactsForApps();
  const app = (projectId && apps.find((a) => a.id === projectId)) || apps.find((a) => a.id === "instacollab") || apps[0];
  const root = repoPath();
  const rel = app?.path || ".";
  const cwd = path.resolve(root, rel);
  const pkgPath = path.join(cwd, "package.json");
  let scripts: string[] = [];
  let pkgName = app?.name || path.basename(cwd);
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string; scripts?: Record<string, string> };
      if (pkg.name) pkgName = pkg.name;
      scripts = Object.keys(pkg.scripts || {}).slice(0, 12);
    } catch {
      /* ignore */
    }
  }
  const gitRoot = gitText(cwd, ["rev-parse", "--show-toplevel"]) || root;
  const branch = gitText(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  const scope = path.relative(gitRoot, cwd);
  const status = gitText(gitRoot, scope && scope !== "." ? ["status", "-sb", "--", scope] : ["status", "-sb"]);
  const packageManager = detectPackageManager(cwd);
  const id = app?.id || path.basename(cwd);
  const kind = app?.kind || "node";
  const banner = [
    `Detected ${pkgName}  ${rel}  (${kind}, ${packageManager})`,
    branch ? `git ${branch}` : "",
    status || "git clean",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id,
    name: pkgName,
    path: rel,
    kind,
    cwd,
    packageManager,
    scripts,
    git: { root: gitRoot, branch, status },
    banner,
  };
}
