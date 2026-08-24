import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { repoPath } from "../../lib/repoRoot";
import { listProjectApps } from "./projectRegistryService";
import { isProviderConfigured } from "./providerSecretsService";
import type { DeployManifest, DeployTarget } from "./appDeployManifest";
import { detectDeployIntent, inferDeployProvider } from "./appDeployManifest";

export type DeployAgentResult = {
  reply: string;
  executed: string[];
  suggestions: string[];
  deploy?: {
    appId?: string;
    provider?: string;
    targets: DeployTarget[];
    manifest?: DeployManifest;
    changeSetUrl?: string;
  };
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
}

function parseAppIdFromMessage(message: string): string | null {
  const quoted = message.match(/["']([^"']+)["']/);
  if (quoted?.[1]) return slug(quoted[1]);
  const apps = listProjectApps();
  const lower = message.toLowerCase();
  for (const app of apps) {
    if (lower.includes(app.id) || lower.includes(app.name.toLowerCase())) return app.id;
  }
  const named = message.match(/(?:app|project)\s+([a-z0-9][a-z0-9 _-]{2,40})/i);
  if (named?.[1]) return slug(named[1]);
  return null;
}

function readDeployManifest(appId: string): DeployManifest | null {
  const manifestPath = repoPath(`artifacts/${appId}/config/deploy.manifest.json`);
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as DeployManifest;
  } catch {
    return null;
  }
}

function providerStatus(target: DeployTarget): DeployTarget {
  if (!target.env?.length) return target;
  const configured = target.env.some((key) => {
    if (key === "GITHUB_TOKEN" || key === "GH_TOKEN") {
      return Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
    }
    if (key.startsWith("VERCEL")) return isProviderConfigured("vercel");
    if (key.startsWith("RAILWAY")) return isProviderConfigured("railway");
    if (key.startsWith("CLOUDFLARE")) return isProviderConfigured("cloudflare");
    return Boolean(process.env[key]);
  });
  return { ...target, status: configured ? "ready" : target.status };
}

export function runDeployAgent(input: { message: string; actorId: string }): DeployAgentResult | null {
  if (!detectDeployIntent(input.message)) return null;

  const provider = inferDeployProvider(input.message);
  const appId = parseAppIdFromMessage(input.message);
  const manifest = appId ? readDeployManifest(appId) : null;
  const targets = (manifest?.targets ?? []).map(providerStatus);
  const executed: string[] = [];
  const suggestions: string[] = [];
  let reply = "";

  if (provider === "publish" || /\bpublish\b/i.test(input.message)) {
    reply =
      `**Publish flow**\n\n` +
      `1. Open **Change sets** in the admin panel\n` +
      `2. Approve the change set for ${appId ? `\`${appId}\`` : "your app"}\n` +
      `3. Confirm name → **Publish** → runtime bundles update\n\n` +
      (appId ? `App manifest: \`artifacts/${appId}/config/deploy.manifest.json\`` : "Scaffold an app first — deploy manifest is generated automatically.");
    suggestions.push("Open Change sets", "Approve then publish", appId ? `Say: deploy ${appId} to vercel` : "Say: create app \"My App\"");
    return {
      reply,
      executed,
      suggestions,
      deploy: {
        appId: appId ?? undefined,
        provider: "publish",
        targets,
        manifest: manifest ?? undefined,
        changeSetUrl: "/#/change-sets",
      },
    };
  }

  if (provider === "github" || /\b(push|github)\b/i.test(input.message)) {
    let pushOutput = "";
    try {
      execSync("pnpm run git:push", { cwd: repoPath(), stdio: "pipe", timeout: 120_000, encoding: "utf8" });
      pushOutput = "Git push succeeded.";
      executed.push("GitHub push via pnpm run git:push");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushOutput = msg.includes("Protected branch")
        ? "Main is protected — create a PR branch instead."
        : "Push needs GITHUB_TOKEN or gh auth — see scripts/github-push.sh";
      suggestions.push("export GITHUB_TOKEN=ghp_…", "pnpm run git:push", "gh pr create --fill");
    }
    reply =
      `**GitHub push**\n\n` +
      `${pushOutput}\n\n` +
      `Script: \`pnpm run git:push\` → \`scripts/github-push.sh\`\n` +
      (manifest
        ? `PR flow: \`${manifest.github.prFlow.replace("{appId}", appId ?? "app")}\``
        : "After push, open a PR — Vercel preview deploys on PR.");
    if (!executed.length) suggestions.push("pnpm run git:push", "gh pr create --fill");
    return { reply, executed, suggestions, deploy: { appId: appId ?? undefined, provider: "github", targets, manifest: manifest ?? undefined } };
  }

  if (provider === "vercel" || (provider === "deploy" && !provider)) {
    const hasVercel = isProviderConfigured("vercel");
    if (hasVercel && (provider === "vercel" || /\bdeploy\b/i.test(input.message))) {
      try {
        const prod = /\bprod(uction)?\b/i.test(input.message);
        execSync(`bash scripts/vercel-deploy.sh ${prod ? "--prod" : ""}`.trim(), {
          cwd: repoPath(),
          stdio: "pipe",
          timeout: 300_000,
          encoding: "utf8",
        });
        executed.push(`Vercel deploy${prod ? " production" : " preview"}`);
        reply = `✓ **Vercel deploy** started${prod ? " (production)" : " (preview)"}.\n\nCheck Vercel dashboard for URL.`;
      } catch {
        reply = `Vercel deploy failed — verify \`VERCEL_TOKEN\`, \`VERCEL_ORG_ID\`, \`VERCEL_PROJECT_ID\` in .env.local`;
        suggestions.push("Add VERCEL_TOKEN in Integrations", "bash scripts/vercel-deploy.sh --prod");
      }
    } else {
      reply =
        `**Deploy to Vercel**\n\n` +
        (hasVercel ? "Run: `bash scripts/vercel-deploy.sh --prod`" : "Connect Vercel in **Integrations** (VERCEL_TOKEN)") +
        `\n\nAuto-deploy: push to GitHub → merge PR → \`.github/workflows/auto-deploy.yml\``;
      suggestions.push("Integrations → Vercel", "pnpm run git:push", "bash scripts/vercel-deploy.sh");
    }
    return { reply, executed, suggestions, deploy: { appId: appId ?? undefined, provider: "vercel", targets, manifest: manifest ?? undefined } };
  }

  if (provider === "railway") {
    reply = isProviderConfigured("railway")
      ? `**Railway** — run \`railway up\`${appId ? ` from artifacts/${appId}` : ""} (RAILWAY_TOKEN configured)`
      : `**Railway** — add RAILWAY_TOKEN in Integrations, then \`railway up --service ${appId ?? "app"}\``;
    suggestions.push("Integrations → Railway", "railway login", appId ? `cd artifacts/${appId}` : "Scaffold app first");
    return { reply, executed, suggestions, deploy: { appId: appId ?? undefined, provider: "railway", targets, manifest: manifest ?? undefined } };
  }

  if (provider === "cloudflare") {
    reply =
      `**Cloudflare Pages/Workers**\n\n` +
      `\`npx wrangler pages deploy artifacts/${appId ?? "app"}/dist --project-name ${appId ?? "app"}\`\n\n` +
      `Needs CLOUDFLARE_API_TOKEN in Integrations.`;
    suggestions.push("Integrations → Cloudflare", "pnpm build", "wrangler pages deploy");
    return { reply, executed, suggestions, deploy: { appId: appId ?? undefined, provider: "cloudflare", targets, manifest: manifest ?? undefined } };
  }

  // General deploy overview
  reply =
    `**Deploy & ship**\n\n` +
    `| Step | Action |\n|------|--------|\n` +
    `| 1 | Build — typecheck + production build |\n` +
    `| 2 | **Push** — \`pnpm run git:push\` |\n` +
    `| 3 | **Publish** — Change sets → Approve → Publish |\n` +
    `| 4 | **Deploy** — Vercel / Railway / Cloudflare |\n\n` +
    (appId && manifest
      ? `App **${manifest.appName}** deploy manifest: \`artifacts/${appId}/config/deploy.manifest.json\`\n\n` +
        `Targets: ${manifest.targets.slice(0, 5).map((t) => t.id).join(", ")}`
      : "Say: `deploy app \"My App\" to vercel` or `push to github`");

  suggestions.push("pnpm run git:push", "Open Change sets → Publish", "bash scripts/vercel-deploy.sh --prod");
  return { reply, executed, suggestions, deploy: { appId: appId ?? undefined, provider: provider ?? "deploy", targets, manifest: manifest ?? undefined } };
}

export { detectDeployIntent };
