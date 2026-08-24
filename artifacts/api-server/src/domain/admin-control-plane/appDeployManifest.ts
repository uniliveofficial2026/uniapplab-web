import type { AppStackKind } from "./appStackInference";
import type { ScaffoldFileDef } from "./appScaffoldTemplates";

export type DeployTarget = {
  id: string;
  label: string;
  cmd: string;
  status: "ready" | "needs-env" | "manual";
  env?: string[];
  access?: string[];
  notes?: string;
};

export type DeployManifest = {
  appId: string;
  appName: string;
  stack: AppStackKind;
  workflow: string[];
  targets: DeployTarget[];
  publish: {
    changeSetPath: string;
    runtimeBundlesPath: string;
    description: string;
  };
  github: {
    pushScript: string;
    prFlow: string;
    workflowFile: string;
  };
};

export type PipelineStage = {
  id: string;
  label?: string;
  cmd: string;
  access: string[];
  env?: string[];
};

export function buildDeployPipeline(input: {
  appId: string;
  appName: string;
  stack: AppStackKind;
  pkgName: string;
}): { stages: PipelineStage[]; manifest: DeployManifest } {
  const { appId, appName, stack, pkgName } = input;
  const rootRel = `artifacts/${appId}`;
  const filterArg = stack === "flutter" ? "" : stack === "android-native" || stack === "ios-native" ? "" : `--filter ${pkgName}`;

  const buildCmd =
    stack === "flutter"
      ? `cd ${rootRel} && flutter build web`
      : stack === "android-native"
        ? `cd ${rootRel} && ./gradlew :app:assembleRelease`
        : stack === "ios-native"
          ? `cd ${rootRel}/ios && xcodegen generate && xcodebuild -scheme ${appName.replace(/[^a-zA-Z0-9]/g, "")} build`
          : stack === "react-native"
            ? `pnpm --filter ${pkgName} exec expo export`
            : `pnpm --filter ${pkgName} build`;

  const typecheckCmd =
    stack === "flutter"
      ? `cd ${rootRel} && flutter analyze`
      : stack === "android-native"
        ? `cd ${rootRel} && ./gradlew :app:lint`
        : stack === "ios-native"
          ? `echo "Open Xcode and Product → Analyze"`
          : stack === "react-native"
            ? `pnpm --filter ${pkgName} typecheck`
            : `pnpm --filter ${pkgName} typecheck`;

  const devCmd =
    stack === "flutter"
      ? `cd ${rootRel} && flutter run`
      : stack === "android-native"
        ? `cd ${rootRel} && ./gradlew :app:installDebug`
        : stack === "ios-native"
          ? `cd ${rootRel}/ios && xcodegen generate && open *.xcodeproj`
          : stack === "react-native"
            ? `pnpm --filter ${pkgName} start`
            : `pnpm --filter ${pkgName} dev`;

  const targets: DeployTarget[] = [
    {
      id: "github-push",
      label: "Push to GitHub",
      cmd: "pnpm run git:push",
      status: "ready",
      env: ["GITHUB_TOKEN", "GH_TOKEN"],
      notes: "Uses scripts/github-push.sh — opens PR if main is protected",
    },
    {
      id: "github-pr",
      label: "Open pull request",
      cmd: "gh pr create --fill && gh pr merge --squash --delete-branch",
      status: "manual",
      env: ["GITHUB_TOKEN"],
      notes: "Required when main branch is protected",
    },
    {
      id: "publish",
      label: "Publish change set",
      cmd: "Admin → Change sets → Approve → Publish",
      status: "ready",
      access: ["publication.publish", "ui.experience.edit"],
      notes: "Staged app files ship to runtime bundles after publish",
    },
    {
      id: "vercel-preview",
      label: "Vercel preview deploy",
      cmd: `bash scripts/vercel-deploy.sh`,
      status: "needs-env",
      env: ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"],
      notes: "Web / Capacitor stacks — preview URL on every push",
    },
    {
      id: "vercel-prod",
      label: "Vercel production",
      cmd: `bash scripts/vercel-deploy.sh --prod`,
      status: "needs-env",
      env: ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"],
    },
    {
      id: "railway",
      label: "Railway deploy",
      cmd: `railway up --service ${appId}`,
      status: "needs-env",
      env: ["RAILWAY_TOKEN", "RAILWAY_PROJECT_ID"],
    },
    {
      id: "cloudflare",
      label: "Cloudflare Workers/Pages",
      cmd: `npx wrangler pages deploy ${rootRel}/dist --project-name ${appId}`,
      status: "needs-env",
      env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
    },
    {
      id: "github-actions",
      label: "GitHub Actions CI/CD",
      cmd: `git push && gh workflow run ${appId}-ci.yml`,
      status: "ready",
      notes: `See docs/github-workflow.${appId}-ci.yml — copy to repo .github/workflows/`,
    },
  ];

  if (stack === "react-native" || stack === "flutter") {
    targets.push(
      {
        id: "expo-eas",
        label: "Expo EAS build (RN)",
        cmd: `cd ${rootRel} && npx eas build --platform all`,
        status: "needs-env",
        env: ["EXPO_TOKEN"],
        notes: "React Native only — App Store + Play Store builds",
      },
      {
        id: "flutter-store",
        label: "Flutter store release",
        cmd: `cd ${rootRel} && flutter build ipa && flutter build appbundle`,
        status: "manual",
        notes: "Requires Apple/Google developer accounts",
      },
    );
  }

  const manifest: DeployManifest = {
    appId,
    appName,
    stack,
    workflow: ["install", "dev", "typecheck", "build", "github-push", "publish", "deploy"],
    targets,
    publish: {
      changeSetPath: "/#/change-sets",
      runtimeBundlesPath: "/#/runtime-bundles",
      description: "Approve change set → Publish bundles app to connected runtime",
    },
    github: {
      pushScript: "pnpm run git:push",
      prFlow: "git checkout -b feat/{appId} && git push -u origin HEAD && gh pr create --fill",
      workflowFile: `.github/workflows/${appId}-ci.yml`,
    },
  };

  const stages: PipelineStage[] = [
    { id: "install", label: "Install deps", cmd: "pnpm install", access: ["ui.experience.read"] },
    { id: "dev", label: "Local dev", cmd: devCmd, access: ["ui.experience.read"] },
    { id: "typecheck", label: "Verify", cmd: typecheckCmd, access: ["config.validate"] },
    { id: "build", label: "Production build", cmd: buildCmd, access: ["ui.experience.edit"] },
    {
      id: "github-push",
      label: "Push to GitHub",
      cmd: "pnpm run git:push",
      access: ["ui.experience.edit"],
      env: ["GITHUB_TOKEN"],
    },
    {
      id: "publish",
      label: "Publish change set",
      cmd: "Admin panel → Change sets → Publish",
      access: ["publication.publish"],
    },
    {
      id: "deploy",
      label: "Deploy preview",
      cmd: stack === "react-web" || stack === "capacitor" ? "bash scripts/vercel-deploy.sh" : `See config/deploy.manifest.json`,
      access: ["publication.publish"],
      env: ["VERCEL_TOKEN"],
    },
  ];

  return { stages, manifest };
}

export function buildDeployScaffoldFiles(input: {
  appId: string;
  appName: string;
  stack: AppStackKind;
  pkgName: string;
  manifest: DeployManifest;
}): ScaffoldFileDef[] {
  const { appId, appName, stack, pkgName, manifest } = input;
  const rootRel = `artifacts/${appId}`;
  const workflowName = `${appId}-ci.yml`;

  const ciSteps =
    stack === "flutter"
      ? `      - uses: subosito/flutter-action@v2
        with:
          channel: stable
      - run: cd ${rootRel} && flutter pub get && flutter analyze`
      : stack === "android-native"
        ? `      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - run: cd ${rootRel} && ./gradlew :app:assembleDebug`
        : stack === "ios-native"
          ? `      - run: echo "iOS builds require macOS runner — use Xcode locally or Expo EAS"`
          : `      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${pkgName} typecheck
      - run: pnpm --filter ${pkgName} build`;

  return [
    {
      path: "config/deploy.manifest.json",
      role: "config",
      description: "Deploy targets — GitHub, publish, Vercel, Railway, Cloudflare",
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: "pipeline/deploy.md",
      role: "doc",
      description: "Deploy runbook — push, publish, ship",
      content: `# Deploy — ${appName}

## Quick ship

1. **Build** — \`${manifest.targets.find((t) => t.id === "publish") ? manifest.workflow.join(" → ") : "build"}\`
2. **Push to GitHub** — \`pnpm run git:push\` (needs \`GITHUB_TOKEN\`)
3. **Publish** — Admin → [Change sets](${manifest.publish.changeSetPath}) → Approve → Publish
4. **Deploy** — Vercel auto-deploys on merge to main, or run \`bash scripts/vercel-deploy.sh --prod\`

## GitHub

\`\`\`bash
git checkout -b feat/${appId}
git add ${rootRel}
git commit -m "Add ${appName} app"
pnpm run git:push
gh pr create --fill
\`\`\`

## Providers

| Target | Command | Env |
|--------|---------|-----|
${manifest.targets
  .slice(0, 8)
  .map((t) => `| ${t.label} | \`${t.cmd}\` | ${t.env?.join(", ") || "—"} |`)
  .join("\n")}

See \`config/deploy.manifest.json\` for full manifest.
`,
    },
    {
      path: `docs/github-workflow.${workflowName}.yml`,
      role: "doc",
      description: "Copy to repo .github/workflows/ for CI on this app",
      content: `# Copy to .github/workflows/${workflowName}
name: CI — ${appName}

on:
  push:
    paths:
      - '${rootRel}/**'
      - '.github/workflows/${workflowName}'
  pull_request:
    paths:
      - '${rootRel}/**'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${ciSteps}

  deploy-preview:
    needs: verify
    if: github.event_name == 'push' && github.ref != 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Vercel preview
        if: env.VERCEL_TOKEN != ''
        env:
          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}
        run: bash scripts/vercel-deploy.sh
`,
    },
    {
      path: "scripts/ship.sh",
      role: "code",
      description: "One-command ship — build, push, publish reminder",
      content: `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "▸ Building ${appName}…"
${stack === "flutter" ? `cd ${rootRel} && flutter pub get && flutter analyze` : stack === "react-native" ? `pnpm --filter ${pkgName} typecheck` : `pnpm --filter ${pkgName} typecheck && pnpm --filter ${pkgName} build`}

echo "▸ Pushing to GitHub…"
pnpm run git:push || {
  echo "GitHub push failed — create a PR branch:"
  echo "  git checkout -b feat/${appId} && git push -u origin HEAD && gh pr create --fill"
  exit 1
}

echo "✓ Code pushed. Next: Admin → Change sets → Publish → Vercel deploys on merge."
`,
    },
  ];
}

export function appendDeployScaffoldFiles(
  files: ScaffoldFileDef[],
  input: { appId: string; appName: string; stack: AppStackKind; pkgName: string; manifest: DeployManifest },
): ScaffoldFileDef[] {
  const deployFiles = buildDeployScaffoldFiles(input);
  const existing = new Set(files.map((f) => f.path));
  return [...files, ...deployFiles.filter((f) => !existing.has(f.path))];
}

export function inferDeployProvider(message: string): string | null {
  const lower = message.toLowerCase();
  if (/\bvercel\b/.test(lower)) return "vercel";
  if (/\brailway\b/.test(lower)) return "railway";
  if (/\bcloudflare\b|\bwrangler\b/.test(lower)) return "cloudflare";
  if (/\bgithub\b|\bgit push\b|\bpush to git\b/.test(lower)) return "github";
  if (/\bpublish\b|\bchange set\b|\bchangeset\b/.test(lower)) return "publish";
  if (/\bdeploy\b|\bship\b|\brelease\b/.test(lower)) return "deploy";
  return null;
}

export function detectDeployIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(deploy|publish|push|ship|release|public)\b/i.test(message) &&
    /\b(app|project|github|vercel|railway|cloudflare|change set|changeset|production|preview|remote)\b/i.test(
      lower,
    )
  );
}
