import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { DevAgentAction } from "./devAgentService";
import type { GroundedContext } from "./agentGroundingService";
import { mergeVerification, runProjectTypecheck, verifyTsxCompile, type VerificationReport } from "./agentVerificationService";

export type AutofixReport = {
  attempts: number;
  fixed: boolean;
  log: string[];
  rounds: number;
};

function geminiModel() {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  return google("gemini-2.5-flash");
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function fixTsxContent(input: {
  content: string;
  fileName: string;
  error: string;
  grounded: GroundedContext;
}): Promise<string | null> {
  const model = geminiModel();
  if (!model) return null;

  const excerpt = input.grounded.sourceFiles.find((f) => f.exists)?.excerpt?.slice(0, 3000) || "";
  const prompt = `Fix ONLY this TSX compile error. Return JSON: { "content": "<full fixed file>" }
Rules: no guessing — preserve structure, fix only what the error requires.
Error: ${input.error}
File: ${input.fileName}
Current:
${input.content.slice(0, 12000)}
Reference excerpt:
${excerpt}`;

  const result = await generateText({ model, maxOutputTokens: 8192, prompt }).catch(() => ({ text: "" }));
  const parsed = extractJson(result.text);
  const content = parsed?.content;
  return typeof content === "string" && content.trim().length > 20 ? content : null;
}

/** Compile-check staged TSX and self-fix up to maxAttempts (no guessing — esbuild + cited context only). */
export async function autofixStageCodeActions(
  actions: DevAgentAction[],
  grounded: GroundedContext,
  maxAttempts = 3,
): Promise<{ actions: DevAgentAction[]; log: string[]; fixed: boolean }> {
  const log: string[] = [];
  const next = actions.map((a) => ({ ...a }));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let failed = false;
    for (const action of next) {
      if (action.type !== "stage_code") continue;
      const fileName = action.fileName || `${action.resourceId}.tsx`;
      const check = await verifyTsxCompile(action.content, fileName);
      if (check.passed) {
        log.push(`attempt ${attempt}: ${action.resourceId} compiles`);
        continue;
      }
      failed = true;
      const fixed = await fixTsxContent({ content: action.content, fileName, error: check.detail, grounded });
      if (!fixed) {
        log.push(`attempt ${attempt}: could not fix ${action.resourceId} — ${check.detail.slice(0, 120)}`);
        return { actions: next, log, fixed: false };
      }
      action.content = fixed;
      log.push(`attempt ${attempt}: repaired ${action.resourceId}`);
    }
    if (!failed) return { actions: next, log, fixed: true };
  }

  return { actions: next, log, fixed: false };
}

/** After apply — re-run typecheck; returns merged verification (informational + blocking for partial). */
export async function verifyProjectBuild(projectId: string, prior: VerificationReport): Promise<VerificationReport> {
  const tc = await runProjectTypecheck(projectId);
  return mergeVerification(prior, { passed: tc.passed, checks: [tc] });
}

export function emptyAutofixReport(): AutofixReport {
  return { attempts: 0, fixed: true, log: [], rounds: 0 };
}
