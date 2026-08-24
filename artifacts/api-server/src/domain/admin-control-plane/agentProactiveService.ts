import { existsSync } from "node:fs";
import { repoPath } from "../../lib/repoRoot";
import { getProjectApp } from "./projectRegistryService";
import { runProjectTypecheck } from "./agentVerificationService";
import { getMemoryStats } from "./workspaceMemoryService";

export type ProactiveInsight = {
  id: string;
  severity: "info" | "warn" | "error";
  message: string;
  action?: string;
};

export async function scanProjectHealth(projectId = "instacollab"): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = [];
  const app = getProjectApp(projectId);
  const memory = getMemoryStats(projectId);

  if (memory.failures > 0) {
    insights.push({
      id: "memory-failures",
      severity: "warn",
      message: `${memory.failures} past failure(s) in workspace memory — agent will avoid repeating them`,
      action: "Review agent memory",
    });
  }

  if (memory.implementations >= 3) {
    insights.push({
      id: "memory-rich",
      severity: "info",
      message: `${memory.implementations} verified implementations remembered — superhuman recall active`,
    });
  }

  if (!app) {
    insights.push({ id: "no-project", severity: "warn", message: `Project ${projectId} not in registry` });
    return insights;
  }

  const cwd = repoPath(app.path);
  if (!existsSync(cwd)) {
    insights.push({ id: "missing-path", severity: "error", message: `Project path missing: ${app.path}` });
    return insights;
  }

  if (app.kind === "react-vite") {
    const tc = await runProjectTypecheck(projectId);
    if (!tc.passed) {
      insights.push({
        id: "typecheck",
        severity: "error",
        message: "Project typecheck failing — agent will prioritize fixes",
        action: tc.detail.slice(0, 120),
      });
    } else {
      insights.push({ id: "typecheck-ok", severity: "info", message: "Project typecheck passing" });
    }
  }

  return insights.slice(0, 6);
}

export function proactiveSummary(insights: ProactiveInsight[]): string {
  return insights.map((i) => `[${i.severity}] ${i.message}`).join("\n");
}
