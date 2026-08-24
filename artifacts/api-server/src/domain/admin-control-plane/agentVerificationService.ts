import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { repoPath } from "../../lib/repoRoot";
import { validateAdminPatch } from "./validators/forbiddenPayload";
import { validateChangeSet } from "./validationService";
import { getAdminResource } from "./access/AdminAccessService";
import { getProjectApp } from "./projectRegistryService";
import { hasRepoFilesystem } from "./workspaceRuntimeService";
import type { DevAgentAction, DevAgentContext } from "./devAgentService";

export type VerificationCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type VerificationReport = {
  passed: boolean;
  checks: VerificationCheck[];
};

function check(name: string, passed: boolean, detail: string): VerificationCheck {
  return { name, passed, detail };
}

function basicTsxSanity(content: string, fileName?: string): VerificationCheck {
  const isTsx = (fileName || "").endsWith(".tsx") || (fileName || "").endsWith(".ts");
  if (!isTsx) return check("syntax", true, "non-ts file — skipped");
  const open = (content.match(/{/g) || []).length;
  const close = (content.match(/}/g) || []).length;
  if (open !== close) {
    return check("syntax", false, `unbalanced braces (${open} open, ${close} close)`);
  }
  if (content.includes("export default") || content.includes("export function") || content.includes("export const")) {
    return check("syntax", true, "tsx structure ok");
  }
  return check("syntax", true, "tsx export check skipped");
}

export function verifyActionsBeforeExecute(actions: DevAgentAction[], ctx: DevAgentContext): VerificationReport {
  const checks: VerificationCheck[] = [];

  for (const action of actions) {
    if (action.type === "micro_edit" || action.type === "stage_code") {
      try {
        getAdminResource(action.resourceId);
        checks.push(check("catalog", true, `${action.resourceId} exists`));
      } catch {
        if (/^(experience\.design-agent\.|node\.upload\.)/.test(action.resourceId)) {
          checks.push(check("catalog", true, `new resource ${action.resourceId}`));
        } else {
          checks.push(check("catalog", false, `unknown resource ${action.resourceId}`));
        }
      }
      const patchIssues = validateAdminPatch(action.type === "micro_edit" ? action.patch : { sourcePreview: action.content });
      if (patchIssues.length) {
        checks.push(check("patch", false, patchIssues.map((i) => i.message).join("; ")));
      } else {
        checks.push(check("patch", true, "patch schema ok"));
      }
    }
    if (action.type === "stage_code") {
      checks.push(basicTsxSanity(action.content, action.fileName));
    }
  }

  if (!actions.length) {
    checks.push(check("actions", true, "no mutating actions"));
  }

  return { passed: checks.every((c) => c.passed), checks };
}

export function verifyChangeSetAfterExecute(changeSetId: string | null | undefined, actorId: string): VerificationReport {
  if (!changeSetId) {
    return { passed: true, checks: [check("change-set", true, "no change set")] };
  }
  try {
    const report = validateChangeSet(changeSetId, actorId);
    return {
      passed: report.ok,
      checks: [
        check("change-set", report.ok, report.ok ? "change set valid" : report.issues.map((i) => i.message).join("; ")),
      ],
    };
  } catch (e) {
    return {
      passed: false,
      checks: [check("change-set", false, e instanceof Error ? e.message : String(e))],
    };
  }
}

export function mergeVerification(...reports: VerificationReport[]): VerificationReport {
  const checks = reports.flatMap((r) => r.checks);
  return { passed: checks.every((c) => c.passed), checks };
}

export async function verifyTsxCompile(content: string, fileName = "stage.tsx"): Promise<VerificationCheck> {
  try {
    const { transform } = await import("esbuild");
    const loader = fileName.endsWith(".ts") && !fileName.endsWith(".tsx") ? "ts" : "tsx";
    await transform(content, { loader, target: "es2020", jsx: "automatic" });
    return check("tsx-compile", true, "esbuild compile ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return check("tsx-compile", false, msg.slice(0, 600));
  }
}

export async function runProjectTypecheck(projectId: string): Promise<VerificationCheck> {
  const app = getProjectApp(projectId);
  if (!app || app.kind !== "react-vite") {
    return check("typecheck", true, "skipped for non-vite project");
  }
  if (!hasRepoFilesystem()) {
    return check("typecheck", true, "skipped — cloud runtime uses catalog scaffolds without repo typecheck");
  }
  const cwd = repoPath(app.path);
  if (!existsSync(cwd)) {
    return check("typecheck", true, "skipped — project path unavailable in this runtime");
  }

  return new Promise((resolve) => {
    const child = spawn("pnpm", ["run", "typecheck"], {
      cwd,
      env: process.env,
      shell: false,
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve(check("typecheck", false, "typecheck timed out (>45s)"));
    }, 45_000);
    child.stdout?.on("data", (d) => {
      out += String(d);
    });
    child.stderr?.on("data", (d) => {
      out += String(d);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(check("typecheck", true, "typecheck passed"));
      else resolve(check("typecheck", false, out.slice(-800) || `exit ${code}`));
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(check("typecheck", false, err.message));
    });
  });
}
