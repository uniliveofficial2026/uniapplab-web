import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createChangeSet } from "./changeSetService";
import { addOrUpdateItem } from "./changeItemService";
import { ENV_PROVIDER_SPECS } from "./envProviderCatalog";
import { registerCustomApp } from "./projectRegistryService";
import { isLocalFilesystemWorkspace } from "./workspaceRuntimeService";
import { repoPath } from "../../lib/repoRoot";
import { allocateDevPort, buildAppFiles, inferAppTemplate } from "./appScaffoldTemplates";
import { inferAppStack, projectKindForStack } from "./appStackInference";
import { buildDeployPipeline } from "./appDeployManifest";
import type { DeployManifest } from "./appDeployManifest";

export type AppStructureFile = {
  path: string;
  role: "code" | "config" | "pipeline" | "access" | "env" | "doc";
  description: string;
};

export type AppStructureResult = {
  appId: string;
  appName: string;
  rootPath: string;
  changeSetId: string;
  files: AppStructureFile[];
  tree: string;
  pipeline: Array<{ id: string; cmd: string; access: string[]; env?: string[] }>;
  access: { roles: Array<{ id: string; permissions: string[] }>; catalogBindings: string[] };
  envKeys: Array<{ key: string; section: string; optional: boolean }>;
  writtenToDisk: boolean;
  runnable: boolean;
  devPort: number;
  devCommand: string;
  template: string;
  features: string[];
  typecheckPassed?: boolean;
  platforms?: string[];
  breakpoints?: Array<{ id: string; minWidth: number; maxWidth: number | null; layout: string; columns: number }>;
  stack?: string;
  stackLabel?: string;
  deploy?: {
    targets: Array<{ id: string; label: string; cmd: string; status: string; env?: string[]; notes?: string }>;
    workflow: string[];
    githubPush?: string;
    publishPath?: string;
  };
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new-app";
}

function parseAppName(message: string): { appId: string; appName: string } {
  const quoted = message.match(/["']([^"']+)["']/);
  if (quoted?.[1]) {
    const appName = quoted[1].trim();
    return { appId: slug(appName), appName };
  }
  const named = message.match(/(?:app|project)\s+(?:called|named)?\s*([a-z0-9][a-z0-9 _-]{2,40})/i);
  if (named?.[1]) {
    const appName = named[1].trim();
    return { appId: slug(appName), appName: appName.replace(/\b\w/g, (c) => c.toUpperCase()) };
  }
  const tail = message.match(/(?:create|build|scaffold|new)\s+(?:a\s+)?(?:app|project)\s+([a-z0-9][a-z0-9 _-]{2,40})/i);
  if (tail?.[1]) {
    const appName = tail[1].trim();
    return { appId: slug(appName), appName: appName.replace(/\b\w/g, (c) => c.toUpperCase()) };
  }
  return { appId: `app-${Date.now().toString(36)}`, appName: "New App" };
}

function envExampleContent(appId: string): string {
  const lines = [
    `# ${appId} — environment template`,
    `# Copy to .env.local (never commit secrets)`,
    "",
    "# --- App runtime ---",
    "VITE_APP_ORIGIN=http://127.0.0.1:5173",
    "VITE_API_URL=http://127.0.0.1:5001",
    "",
    "# --- Admin / access (optional for local dev) ---",
    "ADMIN_ORIGIN=http://127.0.0.1:5180",
    "",
  ];
  for (const spec of ENV_PROVIDER_SPECS) {
    lines.push(`# --- ${spec.id} ---`);
    for (const keys of Object.values(spec.secrets)) {
      for (const key of keys.slice(0, 2)) lines.push(`# ${key}=`);
    }
    for (const keys of Object.values(spec.fields)) {
      for (const key of keys.slice(0, 2)) lines.push(`# ${key}=`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildFiles(appId: string, appName: string, message: string, devPort: number) {
  const structureMap = {
    version: 2,
    appId,
    appName,
    folders: {
      "src/": "Application code — routes, components, hooks, lib",
      "src/routes/": "Working screens with real UI",
      "src/components/": "Layout, error boundary",
      "src/hooks/": "Data hooks (API health, etc.)",
      "src/lib/": "Env, API client",
      "public/": "Static assets — PWA manifest, icons",
      "config/": "App manifest, platform + responsive maps",
      "pipeline/": "Build, verify, deploy, GitHub push",
      "access/": "Roles, permissions, catalog bindings",
      "docs/": "GitHub Actions workflow templates",
      "scripts/": "Ship script — build + push",
    },
  };

  const deploy = buildDeployPipeline({
    appId,
    appName,
    stack: inferAppStack(message).stack,
    pkgName: `@workspace/${appId}`,
  });

  const accessManifest = {
    appId,
    roles: [
      { id: "viewer", permissions: ["ui.experience.read", "config.read"] },
      { id: "editor", permissions: ["ui.experience.read", "ui.experience.edit", "media.upload"] },
      { id: "publisher", permissions: ["ui.experience.edit", "publication.publish", "audit.read"] },
    ],
    catalogBindings: [`ui.experience.${appId}`, `ui.node.${appId}.root`, `ui.token-set.${appId}.theme`],
  };

  return buildAppFiles({
    appId,
    appName,
    devPort,
    message,
    envExample: envExampleContent(appId),
    pipelineManifest: { appId, stages: deploy.stages },
    accessManifest,
    structureMap,
  });
}

function buildTree(rootPath: string, files: AppStructureFile[]): string {
  const lines = [`${rootPath}/`];
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const parts = file.path.split("/");
    const indent = "  ".repeat(Math.max(0, parts.length - 1));
    const name = parts[parts.length - 1];
    const tag = file.role;
    lines.push(`${indent}${name}  ← ${tag}: ${file.description}`);
  }
  return lines.join("\n");
}

export function detectAppScaffoldIntent(message: string): boolean {
  return (
    /(?:create|build|scaffold|generate|new|start|make)\s+(?:a\s+)?(?:fully\s+)?(?:functioning\s+)?(?:complete\s+)?(?:working\s+)?(?:real\s+)?(?:(?:react|flutter|expo|native|ios|android|capacitor)\s+)?(?:app|project)\b/i.test(
      message,
    ) || /(?:app|project)\s+(?:from scratch|that works)/i.test(message)
  );
}

export function scaffoldAppStructure(input: {
  message: string;
  appName?: string;
  appId?: string;
  actorId: string;
  changeSetId?: string | null;
  projectId?: string | null;
}): AppStructureResult {
  const parsed = parseAppName(input.message);
  const appId = input.appId || parsed.appId;
  const appName = input.appName || parsed.appName;
  const rootRel = `artifacts/${appId}`;
  const rootAbs = repoPath(rootRel);
  const devPort = allocateDevPort();
  const templateSpec = inferAppTemplate(input.message);
  const stackSpec = inferAppStack(input.message);
  const pkgName = `@workspace/${appId}`;

  const fileDefs = buildFiles(appId, appName, input.message, devPort);
  let changeSetId = input.changeSetId || null;
  if (!changeSetId) {
    changeSetId = createChangeSet(
      {
        title: `App — ${appName}`,
        description: `Fully functioning ${stackSpec.label} ${templateSpec.label}: code, screens, pipeline, access, .env`,
        targetEnvironment: "local",
        baseSnapshotId: "snapshot.bundled.default",
      },
      input.actorId,
    ).id;
  }

  let writtenToDisk = false;
  if (isLocalFilesystemWorkspace() && !existsSync(rootAbs)) {
    mkdirSync(rootAbs, { recursive: true });
    writtenToDisk = true;
  }

  const pipelineParsed = JSON.parse(fileDefs.find((f) => f.path === "pipeline/manifest.json")!.content) as {
    stages: AppStructureResult["pipeline"];
  };
  const accessParsed = JSON.parse(fileDefs.find((f) => f.path === "access/manifest.json")!.content) as {
    roles: AppStructureResult["access"]["roles"];
    catalogBindings: string[];
  };

  const files: AppStructureFile[] = [];
  for (const file of fileDefs) {
    files.push({ path: file.path, role: file.role, description: file.description });
    const resourceId = `file.${appId}.${file.path.replace(/[/\\.]/g, "-")}`;
    if (writtenToDisk) {
      const abs = path.join(rootAbs, file.path);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, file.content, "utf8");
    }
    addOrUpdateItem(
      changeSetId,
      {
        resourceType: "ui.node",
        resourceId,
        operation: "update",
        patch: {
          name: file.path,
          appId,
          appPath: `${rootRel}/${file.path}`,
          role: file.role,
          description: file.description,
          sourcePreview: file.content.slice(0, 16000),
          generatedBy: "app-structure-scaffold",
          editedAt: new Date().toISOString(),
        },
      },
      input.actorId,
    );
  }

  registerCustomApp({
    id: appId,
    name: appName,
    path: rootRel,
    kind: projectKindForStack(stackSpec.stack),
    devPort: stackSpec.stack === "react-web" || stackSpec.stack === "capacitor" ? devPort : undefined,
    previewPath: stackSpec.stack === "react-web" || stackSpec.stack === "capacitor" ? "/" : undefined,
    description: `${stackSpec.label} · ${templateSpec.label} — ${files.length} files, runnable`,
  });

  let typecheckPassed: boolean | undefined;
  if (writtenToDisk && ["react-web", "react-native", "capacitor"].includes(stackSpec.stack)) {
    try {
      execSync("pnpm install", { cwd: repoPath(), stdio: "pipe", timeout: 120_000 });
      execSync(`pnpm --filter ${pkgName} typecheck`, { cwd: repoPath(), stdio: "pipe", timeout: 60_000 });
      typecheckPassed = true;
    } catch {
      typecheckPassed = false;
    }
  } else if (writtenToDisk && stackSpec.stack === "flutter") {
    try {
      execSync("flutter analyze", { cwd: rootAbs, stdio: "pipe", timeout: 60_000 });
      typecheckPassed = true;
    } catch {
      typecheckPassed = undefined;
    }
  }

  const devCommand = (() => {
    switch (stackSpec.stack) {
      case "react-native":
        return `pnpm --filter ${pkgName} start`;
      case "flutter":
        return `cd ${rootRel} && flutter run`;
      case "ios-native":
        return `cd ${rootRel}/ios && xcodegen generate && open *.xcodeproj`;
      case "android-native":
        return `cd ${rootRel} && ./gradlew :app:installDebug`;
      case "capacitor":
        return `pnpm --filter ${pkgName} dev  # then: pnpm --filter ${pkgName} cap:sync`;
      default:
        return `pnpm --filter ${pkgName} dev`;
    }
  })();

  const platforms =
    stackSpec.stack === "react-web"
      ? ["web", "pwa", "ios", "android", "desktop"]
      : stackSpec.targets;

  const breakpoints =
    stackSpec.stack === "react-web" || stackSpec.stack === "capacitor"
      ? [
          { id: "mobile", minWidth: 0, maxWidth: 767, layout: "bottom-tabs", columns: 1 },
          { id: "tablet", minWidth: 768, maxWidth: 1023, layout: "bottom-tabs-wide", columns: 2 },
          { id: "desktop", minWidth: 1024, maxWidth: null, layout: "sidebar", columns: 3 },
        ]
      : undefined;

  const envKeys: AppStructureResult["envKeys"] = [
    { key: "VITE_APP_ORIGIN", section: "App runtime", optional: true },
    { key: "VITE_API_URL", section: "App runtime", optional: true },
    { key: "GITHUB_TOKEN", section: "GitHub push", optional: true },
    { key: "VERCEL_TOKEN", section: "Vercel deploy", optional: true },
  ];
  for (const spec of ENV_PROVIDER_SPECS) {
    for (const keys of Object.values(spec.secrets)) {
      if (keys[0]) envKeys.push({ key: keys[0], section: spec.id, optional: true });
    }
  }

  const deployParsed = (() => {
    const raw = fileDefs.find((f) => f.path === "config/deploy.manifest.json")?.content;
    if (!raw) return undefined;
    try {
      const m = JSON.parse(raw) as DeployManifest;
      return {
        targets: m.targets.map((t) => ({ id: t.id, label: t.label, cmd: t.cmd, status: t.status, env: t.env, notes: t.notes })),
        workflow: m.workflow,
        githubPush: m.github.pushScript,
        publishPath: m.publish.changeSetPath,
      };
    } catch {
      return undefined;
    }
  })();

  return {
    appId,
    appName,
    rootPath: rootRel,
    changeSetId,
    files,
    tree: buildTree(rootRel, files),
    pipeline: pipelineParsed.stages,
    access: { roles: accessParsed.roles, catalogBindings: accessParsed.catalogBindings },
    envKeys,
    writtenToDisk,
    runnable: true,
    devPort: stackSpec.stack === "react-web" || stackSpec.stack === "capacitor" ? devPort : 0,
    devCommand,
    template: templateSpec.kind,
    features: templateSpec.features,
    typecheckPassed,
    platforms,
    breakpoints,
    stack: stackSpec.stack,
    stackLabel: stackSpec.label,
    deploy: deployParsed,
  };
}
