import { devAgentChat, type DevAgentChatResult, type AgentMode } from "./devAgentService";
import type { DevAgentContext } from "./devAgentService";
import { autofixStageCodeActions, emptyAutofixReport, verifyProjectBuild, type AutofixReport } from "./agentAutofixService";
import { buildGroundedContext } from "./agentGroundingService";

export type AutonomousAgentResult = DevAgentChatResult & { autofix: AutofixReport };

/**
 * Start-to-finish agent run: chat → autofix staged code → verify build → auto-retry on failures.
 * Used by background tasks so work completes without manual intervention.
 */
export async function runAutonomousDevAgent(input: {
  message: string;
  context?: DevAgentContext;
  sessionId?: string;
  mode?: AgentMode;
  actorId: string;
  maxRounds?: number;
}): Promise<AutonomousAgentResult> {
  const maxRounds = input.maxRounds ?? 3;
  const autofixLog: string[] = [];
  let rounds = 0;
  let result = await devAgentChat({ ...input, mode: input.mode || "agent" });

  while (rounds < maxRounds && result.mode === "agent" && result.confidence !== "verified") {
    if (result.blockedReason) break;

    const failed = result.verification.checks.filter((c) => !c.passed);
    const stageActions = result.actions.filter((a) => a.type === "stage_code");
    const needsFix = failed.length > 0 || stageActions.length > 0;
    if (!needsFix) break;

    rounds++;
    autofixLog.push(`round ${rounds}: auto-fix started`);

    if (stageActions.length) {
      const grounded = buildGroundedContext(input.context || {});
      const fixed = await autofixStageCodeActions(result.actions, grounded, 3);
      autofixLog.push(...fixed.log);
      if (!fixed.fixed && failed.some((f) => f.name === "tsx-compile" || f.name === "syntax")) {
        return {
          ...result,
          confidence: "partial",
          reply: `${result.reply}\n\n**Auto-fix stopped** — could not compile staged code after ${rounds} round(s).`,
          autofix: { attempts: fixed.log.length, fixed: false, log: autofixLog, rounds },
        };
      }
    }

    const failDetail = failed.map((c) => `${c.name}: ${c.detail}`).join("; ");
    result = await devAgentChat({
      ...input,
      sessionId: result.sessionId,
      mode: "debug",
      message: `AUTO-FIX round ${rounds}. Resolve these verified failures using grounded sources only — no guesses:\n${failDetail || "Re-verify staged code and project typecheck."}`,
      context: { ...input.context, changeSetId: result.changeSetId },
    });

    const projectId = String(input.context?.projectId || "instacollab");
    result = {
      ...result,
      verification: await verifyProjectBuild(projectId, result.verification),
    };

    if (result.verification.passed) {
      result = { ...result, confidence: "verified" };
      autofixLog.push(`round ${rounds}: verified`);
      break;
    }
  }

  return {
    ...result,
    autofix: {
      attempts: autofixLog.length,
      fixed: result.confidence === "verified",
      log: autofixLog,
      rounds,
    },
  };
}

export { emptyAutofixReport };
