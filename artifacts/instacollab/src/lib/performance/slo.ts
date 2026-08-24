import { countLongTasksOver, readLongTasks } from "./renderDiagnostics";
import type { ActionTrace } from "./actionTrace";

export type ActionSloResult =
  | "PASS"
  | "SLOW_FEEDBACK"
  | "SLOW_USABLE"
  | "SLOW_AUTHORITY"
  | "BLOCKED"
  | "UNMEASURED";

export type ActionPerformanceResult = {
  actionId: string;
  inputToFeedbackMs: number;
  inputToUsableMs: number;
  inputToAuthoritativeMs: number;
  longestMainThreadTaskMs: number;
  reactCommitMs: number;
  networkMs: number;
  serverMs: number;
  databaseMs: number;
  result: ActionSloResult;
};

export const SLO = {
  feedbackP75Ms: 100,
  feedbackP95Ms: 200,
  localUsableP75Ms: 500,
  usableP75Ms: 1000,
  mainThreadAvoidableMs: 50,
  mainThreadCriticalFailMs: 100,
} as const;

export type ActionClass = "local" | "server-read" | "server-mutation" | "external";

export function classifySloResult(input: {
  actionClass: ActionClass;
  inputToFeedbackMs: number | null;
  inputToUsableMs: number | null;
  inputToAuthoritativeMs: number | null;
  longestMainThreadTaskMs: number;
  authorityBudgetMs?: number;
}): ActionSloResult {
  if (input.inputToFeedbackMs == null || input.inputToUsableMs == null) return "UNMEASURED";
  if (input.longestMainThreadTaskMs > SLO.mainThreadCriticalFailMs) return "BLOCKED";
  if (input.inputToFeedbackMs > SLO.feedbackP75Ms) return "SLOW_FEEDBACK";
  const usableBudget = input.actionClass === "local" ? SLO.localUsableP75Ms : SLO.usableP75Ms;
  if (input.inputToUsableMs > usableBudget) return "SLOW_USABLE";
  if (
    input.inputToAuthoritativeMs != null &&
    input.authorityBudgetMs != null &&
    input.inputToAuthoritativeMs > input.authorityBudgetMs
  ) {
    return "SLOW_AUTHORITY";
  }
  return "PASS";
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

export function resultFromTrace(
  trace: ActionTrace,
  actionClass: ActionClass,
  extras?: {
    networkMs?: number;
    serverMs?: number;
    databaseMs?: number;
    authorityBudgetMs?: number;
  },
): ActionPerformanceResult {
  const feedback = trace.phases["first-visible"] ?? null;
  const usable = trace.phases.usable ?? trace.phases.commit ?? null;
  const authority = trace.phases.response ?? null;
  const longest = readLongTasks().reduce((max, t) => Math.max(max, t.duration), 0);
  const result = classifySloResult({
    actionClass,
    inputToFeedbackMs: feedback,
    inputToUsableMs: usable,
    inputToAuthoritativeMs: authority,
    longestMainThreadTaskMs: longest,
    authorityBudgetMs: extras?.authorityBudgetMs,
  });
  return {
    actionId: trace.actionId,
    inputToFeedbackMs: feedback ?? -1,
    inputToUsableMs: usable ?? -1,
    inputToAuthoritativeMs: authority ?? -1,
    longestMainThreadTaskMs: longest,
    reactCommitMs: trace.phases.commit ?? -1,
    networkMs: extras?.networkMs ?? -1,
    serverMs: extras?.serverMs ?? -1,
    databaseMs: extras?.databaseMs ?? -1,
    result,
  };
}

export function longTasksOverCritical(): number {
  return countLongTasksOver(SLO.mainThreadCriticalFailMs);
}
