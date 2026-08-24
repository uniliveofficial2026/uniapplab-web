import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { runAutonomousDevAgent, type AutonomousAgentResult } from "./agentPipelineService";
import type { DevAgentContext, AgentMode } from "./devAgentService";
import { buildGroundedContext } from "./agentGroundingService";
import { recallMemory, rememberMemory, memoryContextBlock } from "./workspaceMemoryService";
import { scanProjectHealth, type ProactiveInsight } from "./agentProactiveService";

export type SuperhumanPhase = "recall" | "decompose" | "execute" | "critique" | "memorize" | "synthesize";

export type SuperhumanPhaseReport = {
  phase: SuperhumanPhase;
  status: "ok" | "warn" | "fail";
  detail: string;
  ms?: number;
};

export type SuperhumanReport = {
  phases: SuperhumanPhaseReport[];
  steps: string[];
  memoryUsed: string[];
  proactiveInsights: ProactiveInsight[];
  critiqueScore: number;
  superhuman: boolean;
};

export type SuperhumanAgentResult = AutonomousAgentResult & { supervisor: SuperhumanReport };

function geminiModel() {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  return createGoogleGenerativeAI({ apiKey })("gemini-2.5-flash");
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

function ruleDecompose(message: string): string[] {
  const lower = message.toLowerCase();
  if (message.length < 60 && !/(build|create|implement|convert|design|fix|add|make)/.test(lower)) {
    return [message];
  }
  const parts = message
    .split(/(?:\band\b|\bthen\b|;|\n|\.(?=\s+[A-Z]))/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  return parts.length > 1 ? parts.slice(0, 5) : [message];
}

async function aiDecompose(message: string, memory: string): Promise<string[]> {
  const model = geminiModel();
  if (!model) return ruleDecompose(message);
  const prompt = `Decompose this dev task into 1-5 ordered, verifiable steps. No vague steps.
Memory:\n${memory || "none"}
Task: ${message}
Return ONLY JSON: { "steps": ["step1", "step2"] }`;
  const result = await generateText({ model, maxOutputTokens: 1024, prompt }).catch(() => ({ text: "" }));
  const parsed = extractJson(result.text);
  if (parsed && Array.isArray(parsed.steps)) {
    return (parsed.steps as unknown[]).map(String).filter((s) => s.length > 4).slice(0, 5);
  }
  return ruleDecompose(message);
}

async function aiCritique(message: string, result: AutonomousAgentResult, grounded: string): Promise<{ score: number; issues: string[] }> {
  const model = geminiModel();
  const failed = result.verification.checks.filter((c) => !c.passed);
  if (failed.length) {
    return { score: Math.max(20, 60 - failed.length * 15), issues: failed.map((f) => f.detail) };
  }
  if (!model) {
    return { score: result.confidence === "verified" ? 92 : 70, issues: [] };
  }
  const prompt = `Adversarial critic — find ANY gap vs the user request. Score 0-100 (100 = perfect).
User: ${message}
Agent reply: ${result.reply.slice(0, 2000)}
Executed: ${result.executed.join("; ")}
Grounded:\n${grounded.slice(0, 3000)}
Return ONLY JSON: { "score": number, "issues": ["..."] }`;
  const res = await generateText({ model, maxOutputTokens: 1024, prompt }).catch(() => ({ text: "" }));
  const parsed = extractJson(res.text);
  if (parsed) {
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 75)),
      issues: Array.isArray(parsed.issues) ? (parsed.issues as unknown[]).map(String).slice(0, 5) : [],
    };
  }
  return { score: result.confidence === "verified" ? 88 : 72, issues: [] };
}

/**
 * Superhuman orchestrator — exceeds single-shot agents:
 * persistent memory + decomposition + autonomous execution + adversarial critique + learning.
 */
export async function runSuperhumanAgent(input: {
  message: string;
  context?: DevAgentContext;
  sessionId?: string;
  mode?: AgentMode;
  actorId: string;
}): Promise<SuperhumanAgentResult> {
  const phases: SuperhumanPhaseReport[] = [];
  const projectId = String(input.context?.projectId || "instacollab");
  const steps: string[] = [];
  let memoryUsed: string[] = [];

  const t0 = Date.now();
  const recalled = recallMemory(input.message, projectId, 10);
  memoryUsed = recalled.map((m) => m.summary);
  phases.push({
    phase: "recall",
    status: recalled.length ? "ok" : "warn",
    detail: recalled.length ? `Recalled ${recalled.length} workspace memories` : "No prior memory — building fresh",
    ms: Date.now() - t0,
  });

  const memoryBlock = memoryContextBlock(recalled);
  const proactiveInsights = await scanProjectHealth(projectId);

  const t1 = Date.now();
  const decomposed = await aiDecompose(input.message, memoryBlock);
  steps.push(...decomposed);
  phases.push({
    phase: "decompose",
    status: "ok",
    detail: `${decomposed.length} verified step(s)`,
    ms: Date.now() - t1,
  });

  const enrichedContext: DevAgentContext = {
    ...input.context,
    projectId,
  };

  const t2 = Date.now();
  let result: AutonomousAgentResult;
  if (decomposed.length <= 1) {
    result = await runAutonomousDevAgent({
      ...input,
      context: enrichedContext,
      message: memoryBlock ? `${input.message}\n\nWorkspace memory:\n${memoryBlock}` : input.message,
      mode: input.mode || "agent",
    });
  } else {
    let combinedReply = "";
    let last = await runAutonomousDevAgent({
      ...input,
      context: enrichedContext,
      message: `${decomposed[0]}\n\nWorkspace memory:\n${memoryBlock}`,
      mode: "agent",
    });
    combinedReply = last.reply;
    for (let i = 1; i < decomposed.length; i++) {
      last = await runAutonomousDevAgent({
        ...input,
        sessionId: last.sessionId,
        context: { ...enrichedContext, changeSetId: last.changeSetId },
        message: `Step ${i + 1}/${decomposed.length}: ${decomposed[i]}`,
        mode: "agent",
      });
      combinedReply = `${combinedReply}\n\n**Step ${i + 1}:** ${last.reply}`;
    }
    result = { ...last, reply: combinedReply, plan: decomposed };
  }
  phases.push({
    phase: "execute",
    status: result.confidence === "verified" ? "ok" : result.confidence === "partial" ? "warn" : "fail",
    detail: `${result.executed.length} action(s), confidence ${result.confidence}`,
    ms: Date.now() - t2,
  });

  const t3 = Date.now();
  const grounded = JSON.stringify(buildGroundedContext(enrichedContext), null, 2);
  const critique = await aiCritique(input.message, result, grounded);
  phases.push({
    phase: "critique",
    status: critique.score >= 85 ? "ok" : critique.score >= 65 ? "warn" : "fail",
    detail: `Adversarial score ${critique.score}/100${critique.issues.length ? ` — ${critique.issues[0]}` : ""}`,
    ms: Date.now() - t3,
  });

  const t4 = Date.now();
  if (result.confidence === "verified" && critique.score >= 80) {
    rememberMemory({
      kind: "implementation",
      projectId,
      summary: input.message.slice(0, 160),
      detail: result.reply.slice(0, 400),
      resourceId: input.context?.detail?.resourceId || input.context?.pick?.nodeId || null,
      changeSetId: result.changeSetId || null,
      tags: ["superhuman", "verified", ...decomposed.map((s) => s.split(" ")[0].toLowerCase())],
      confidence: critique.score / 100,
    });
  } else if (result.confidence === "blocked" || critique.score < 50) {
    rememberMemory({
      kind: "failure",
      projectId,
      summary: input.message.slice(0, 160),
      detail: critique.issues.join("; ") || result.blockedReason || "blocked",
      tags: ["superhuman", "failure"],
      confidence: 0.95,
    });
  }
  phases.push({
    phase: "memorize",
    status: "ok",
    detail: "Workspace memory updated for future recall",
    ms: Date.now() - t4,
  });

  const superhuman = result.confidence === "verified" && critique.score >= 85 && phases.every((p) => p.status !== "fail");
  const synthesizeDetail = superhuman
    ? "Superhuman pass — memory + multi-step + critique verified"
    : "Partial — see critique or verification";
  phases.push({ phase: "synthesize", status: superhuman ? "ok" : "warn", detail: synthesizeDetail });

  let reply = result.reply;
  if (critique.issues.length && critique.score < 85) {
    reply = `${reply}\n\n**Critique (${critique.score}/100):** ${critique.issues.slice(0, 3).join("; ")}`;
  }
  if (proactiveInsights.length) {
    reply = `${reply}\n\n**Proactive scan:** ${proactiveInsights.slice(0, 2).map((i) => i.message).join(" · ")}`;
  }

  return {
    ...result,
    reply,
    plan: steps,
    supervisor: {
      phases,
      steps,
      memoryUsed,
      proactiveInsights,
      critiqueScore: critique.score,
      superhuman,
    },
  };
}
