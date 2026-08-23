import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { isDevWorkspaceEnabled } from "./workspaceConfigService";
import { workspacePersistDir } from "./workspaceRuntimeService";
import { createChangeSet } from "./changeSetService";
import { addOrUpdateItem } from "./changeItemService";
import { upsertMcpServer, type McpServerConfig } from "./mcpConfigService";
import { projectContextForAgent } from "./projectRegistryService";
import { buildGroundedContext, groundingBlocksExecution, type GroundedContext } from "./agentGroundingService";
import {
  mergeVerification,
  runProjectTypecheck,
  verifyActionsBeforeExecute,
  verifyChangeSetAfterExecute,
  verifyTsxCompile,
  type VerificationReport,
} from "./agentVerificationService";
import { autofixStageCodeActions, emptyAutofixReport, type AutofixReport } from "./agentAutofixService";
import { runLocalDevAgent } from "./localWorkService";
import type { AppStructureResult } from "./appStructureScaffoldService";
import { detectAppScaffoldIntent } from "./appStructureScaffoldService";

export type AgentMode = "agent" | "plan" | "ask" | "debug";

const AGENT_DIR = workspacePersistDir("dev-agent");

export type DevAgentPickContext = {
  resourceId?: string | null;
  nodeId?: string | null;
  componentId?: string | null;
  tagName?: string;
  label?: string;
  className?: string;
  domPath?: string;
};

export type DevAgentDetailContext = {
  resourceId: string;
  name: string;
  type: string;
  sourcePath?: string | null;
};

export type DevAgentDebugLog = { level: string; message: string; at: string; source?: string };

export type DevAgentContext = {
  pick?: DevAgentPickContext | null;
  detail?: DevAgentDetailContext | null;
  screenTab?: string;
  changeSetId?: string | null;
  projectId?: string | null;
  debugLogs?: DevAgentDebugLog[];
};

export type DevAgentAction =
  | { type: "micro_edit"; resourceId: string; resourceType?: string; patch: Record<string, unknown> }
  | { type: "stage_code"; resourceId: string; resourceType?: string; fileName?: string; content: string }
  | { type: "mcp_upsert"; serverId: string; config: McpServerConfig; applyToCursor?: boolean }
  | { type: "build_plan"; steps: string[] };

export type DevAgentMessage = { role: "user" | "assistant"; content: string; at?: string };

export type DevAgentChatResult = {
  sessionId: string;
  reply: string;
  mode: AgentMode;
  actions: DevAgentAction[];
  executed: string[];
  changeSetId?: string | null;
  suggestions?: string[];
  plan?: string[];
  confidence: "verified" | "partial" | "blocked";
  citations: string[];
  verification: VerificationReport;
  grounded: GroundedContext;
  blockedReason?: string | null;
  autofix?: AutofixReport;
  appStructure?: AppStructureResult;
  deploy?: AppStructureResult["deploy"];
  terminal?: TerminalRunResult;
};

export type TerminalRunResult = {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  ok: boolean;
  truncated?: boolean;
};

function agentEnabled(): boolean {
  return isDevWorkspaceEnabled();
}

function geminiModel() {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  return google("gemini-2.5-flash");
}

function sessionPath(id: string): string {
  return path.join(AGENT_DIR, "sessions", `${id}.json`);
}

function readSession(id: string): DevAgentMessage[] {
  const file = sessionPath(id);
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { messages?: DevAgentMessage[] };
    return data.messages || [];
  } catch {
    return [];
  }
}

function writeSession(id: string, messages: DevAgentMessage[]): void {
  mkdirSync(path.join(AGENT_DIR, "sessions"), { recursive: true });
  writeFileSync(sessionPath(id), JSON.stringify({ id, messages, updatedAt: new Date().toISOString() }, null, 2));
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

function parseActions(raw: unknown): DevAgentAction[] {
  if (!Array.isArray(raw)) return [];
  const out: DevAgentAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = String(row.type || "");
    if (type === "micro_edit" && row.resourceId && row.patch) {
      out.push({
        type: "micro_edit",
        resourceId: String(row.resourceId),
        resourceType: row.resourceType ? String(row.resourceType) : undefined,
        patch: row.patch as Record<string, unknown>,
      });
    } else if (type === "stage_code" && row.resourceId && row.content) {
      out.push({
        type: "stage_code",
        resourceId: String(row.resourceId),
        resourceType: row.resourceType ? String(row.resourceType) : undefined,
        fileName: row.fileName ? String(row.fileName) : undefined,
        content: String(row.content),
      });
    } else if (type === "mcp_upsert" && row.serverId && row.config) {
      out.push({
        type: "mcp_upsert",
        serverId: String(row.serverId),
        config: row.config as McpServerConfig,
        applyToCursor: Boolean(row.applyToCursor),
      });
    } else if (type === "build_plan" && Array.isArray(row.steps)) {
      out.push({ type: "build_plan", steps: row.steps.map(String) });
    }
  }
  return out;
}

export function stageMicroEdit(
  input: {
    resourceId: string;
    resourceType?: string;
    patch: Record<string, unknown>;
    changeSetId?: string | null;
    title?: string;
    note?: string;
  },
  actorId: string,
): { changeSetId: string } {
  if (!agentEnabled()) {
    throw Object.assign(new Error("dev agent local only"), { status: 404, code: "error.notFound" });
  }

  let changeSetId = input.changeSetId || null;
  if (!changeSetId) {
    const cs = createChangeSet(
      {
        title: input.title || `Micro edit — ${input.resourceId}`,
        description: input.note || "Edited from Dev Agent workspace",
        targetEnvironment: "local",
        baseSnapshotId: "snapshot.bundled.default",
      },
      actorId,
    );
    changeSetId = cs.id;
  }

  addOrUpdateItem(
    changeSetId,
    {
      resourceType: input.resourceType || "ui.node",
      resourceId: input.resourceId,
      operation: "update",
      patch: {
        ...input.patch,
        microEdit: true,
        editedAt: new Date().toISOString(),
        note: input.note || "Micro detail edit",
      },
    },
    actorId,
  );

  return { changeSetId };
}

function executeActions(
  actions: DevAgentAction[],
  ctx: DevAgentContext,
  actorId: string,
  changeSetId?: string | null,
): { executed: string[]; changeSetId: string | null } {
  let csId = changeSetId || ctx.changeSetId || null;
  const executed: string[] = [];

  for (const action of actions) {
    if (action.type === "micro_edit") {
      const result = stageMicroEdit(
        {
          resourceId: action.resourceId,
          resourceType: action.resourceType || ctx.detail?.type,
          patch: action.patch,
          changeSetId: csId,
          note: `Agent micro edit on ${action.resourceId}`,
        },
        actorId,
      );
      csId = result.changeSetId;
      executed.push(`Micro edit staged for ${action.resourceId}`);
    } else if (action.type === "stage_code") {
      if (!csId) {
        const cs = createChangeSet(
          {
            title: `Agent code — ${action.fileName || action.resourceId}`,
            description: "Generated by Dev Agent",
            targetEnvironment: "local",
            baseSnapshotId: "snapshot.bundled.default",
          },
          actorId,
        );
        csId = cs.id;
      }
      addOrUpdateItem(
        csId,
        {
          resourceType: action.resourceType || "ui.node",
          resourceId: action.resourceId,
          operation: "update",
          patch: {
            name: action.fileName || action.resourceId,
            sourcePreview: action.content.slice(0, 16000),
            generatedBy: "dev-agent",
            editedAt: new Date().toISOString(),
          },
        },
        actorId,
      );
      executed.push(`Code staged for ${action.resourceId}`);
    } else if (action.type === "mcp_upsert") {
      upsertMcpServer(action.serverId, action.config, action.applyToCursor);
      executed.push(`MCP server "${action.serverId}" configured`);
    } else if (action.type === "build_plan") {
      executed.push(`Build plan: ${action.steps.length} steps outlined`);
    }
  }

  return { executed, changeSetId: csId };
}

function emptyRuleGrounded(): GroundedContext {
  return { citations: [], missing: [], sourceFiles: [], project: {} };
}

function emptyRuleVerification(): VerificationReport {
  return { passed: true, checks: [] };
}

function ruleBasedReply(message: string, ctx: DevAgentContext): DevAgentChatResult | null {
  const lower = message.toLowerCase();
  const resourceId = ctx.detail?.resourceId || ctx.pick?.nodeId || ctx.pick?.componentId;
  const base = {
    sessionId: "",
    executed: [] as string[],
    confidence: "partial" as const,
    citations: [] as string[],
    verification: emptyRuleVerification(),
    grounded: emptyRuleGrounded(),
    blockedReason: null as string | null,
  };

  if (lower.includes("padding") || lower.includes("margin") || lower.includes("font") || lower.includes("color")) {
    const match = message.match(/(?:padding|margin|font-size|color)\s*[:=]?\s*([#\w\d.%pxrem]+)/i);
    const value = match?.[1];
    if (resourceId && value) {
      const patch: Record<string, unknown> = { styles: {} };
      if (lower.includes("padding")) (patch.styles as Record<string, string>).padding = value;
      if (lower.includes("margin")) (patch.styles as Record<string, string>).margin = value;
      if (lower.includes("font")) (patch.styles as Record<string, string>).fontSize = value;
      if (lower.includes("color")) (patch.styles as Record<string, string>).color = value;
      return {
        ...base,
        mode: "agent" as const,
        reply: `Staged micro edit on **${resourceId}** with your style change.`,
        actions: [{ type: "micro_edit", resourceId, resourceType: ctx.detail?.type, patch }],
        suggestions: ["Publish change set when ready", "Pick another element to keep editing"],
      };
    }
  }

  if (lower.includes("build") && lower.includes("app") && !detectAppScaffoldIntent(message)) {
    return {
      ...base,
      mode: "agent" as const,
      reply:
        "To build a complete app screen: open **Design** and drop your UI/UX mockup, or describe the screen here and I'll stage components + layout into a change set. Pick elements in the live app for micro edits.",
      actions: [],
      suggestions: ["Upload a Figma export in Design tab", "Pick a button and say: set padding 12px", "Configure Supabase MCP"],
    };
  }

  if (lower.includes("mcp") || lower.includes("supabase") || lower.includes("firebase")) {
    return {
      ...base,
      mode: "agent" as const,
      reply: "Open the **MCP** tab to add or edit MCP servers (Supabase, Chrome DevTools, Firebase, Vercel). Changes save to `.local-dev/workspace-mcp.json` and can sync to Cursor.",
      actions: [],
      suggestions: ["Add Supabase preset", "Apply MCP config to Cursor"],
    };
  }

  return null;
}

export async function devAgentChat(input: {
  message: string;
  context?: DevAgentContext;
  sessionId?: string;
  mode?: AgentMode;
  actorId: string;
}): Promise<DevAgentChatResult> {
  if (!agentEnabled()) {
    throw Object.assign(new Error("dev agent local only"), { status: 404, code: "error.notFound" });
  }

  const mode: AgentMode = input.mode || "agent";
  const sessionId =
    input.sessionId ||
    createHash("sha256").update(`${input.actorId}:${Date.now()}`).digest("hex").slice(0, 12);
  const ctx: DevAgentContext = {
    ...input.context,
    ...(input.context?.projectId ? projectContextForAgent(String(input.context.projectId)) : {}),
  };
  const history = readSession(sessionId);
  const userMsg: DevAgentMessage = { role: "user", content: input.message.trim(), at: new Date().toISOString() };
  const grounded = buildGroundedContext(ctx);
  const blockReason = groundingBlocksExecution(grounded, mode);

  if (detectAppScaffoldIntent(input.message) && mode === "agent" && !blockReason) {
    const local = await runLocalDevAgent({
      message: input.message,
      context: ctx,
      sessionId,
      mode,
      actorId: input.actorId,
    });
    writeSession(sessionId, [...history, userMsg, { role: "assistant", content: local.reply, at: new Date().toISOString() }]);
    return { ...local, grounded };
  }

  const ruleHit = ruleBasedReply(input.message, ctx);
  if (ruleHit && !geminiModel()) {
    const emptyVerify: VerificationReport = { passed: true, checks: [] };
    if (blockReason) {
      const assistantMsg: DevAgentMessage = { role: "assistant", content: blockReason, at: new Date().toISOString() };
      writeSession(sessionId, [...history, userMsg, assistantMsg]);
      return {
        sessionId,
        mode,
        reply: blockReason,
        actions: [],
        executed: [],
        changeSetId: ctx.changeSetId || null,
        suggestions: ["Pick an element in the live app", "Select a catalog resource"],
        confidence: "blocked",
        citations: grounded.citations,
        verification: emptyVerify,
        grounded,
        blockedReason: blockReason,
      };
    }
    const pre = verifyActionsBeforeExecute(ruleHit.actions, ctx);
    const exec =
      mode === "agent" && pre.passed
        ? executeActions(ruleHit.actions, ctx, input.actorId, ctx.changeSetId)
        : { executed: [] as string[], changeSetId: ctx.changeSetId || null };
    const verification = mergeVerification(pre, verifyChangeSetAfterExecute(exec.changeSetId, input.actorId));
    writeSession(sessionId, [...history, userMsg, { role: "assistant", content: ruleHit.reply, at: new Date().toISOString() }]);
    return {
      ...ruleHit,
      sessionId,
      mode,
      executed: exec.executed,
      changeSetId: exec.changeSetId,
      confidence: verification.passed ? "verified" : "partial",
      citations: grounded.citations,
      verification,
      grounded,
      blockedReason: null,
    };
  }

  const precisionRules = `PRECISION MODE: NEVER guess. Use ONLY groundedContext. Cite [catalog:id] or [file:path]. Empty actions if uncertain.`;
  const modeInstructions: Record<AgentMode, string> = {
    agent: "AGENT — verified changes only.",
    plan: "PLAN — plan only, build_plan action allowed.",
    ask: "ASK — read-only from grounded sources.",
    debug: "DEBUG — diagnose from debugSummary and files.",
  };
  const debugSection = ctx.debugLogs?.length
    ? `\nLogs:\n${ctx.debugLogs.slice(-20).map((l) => `[${l.level}] ${l.message}`).join("\n")}\n`
    : "";

  const model = geminiModel();
  let reply = "";
  let actions: DevAgentAction[] = [];
  let suggestions = ["Edit picked component using its real source file", "Plan screen from catalog patterns", "Debug last error with citations"];
  let plan: string[] | undefined;

  if (blockReason && (mode === "agent" || mode === "debug")) {
    reply = blockReason;
    actions = [];
    suggestions = ["Pick an element in the live app", "Select a catalog resource"];
  } else if (model) {
    const prompt = `UniLive's Precision Dev Agent (zero guessing, beyond Cursor).
${precisionRules}
${modeInstructions[mode]}
${debugSection}
groundedContext:
${JSON.stringify(grounded, null, 2)}
Chat: ${history.slice(-8).map((m) => `${m.role}: ${m.content}`).join("\n")}
User: ${input.message}
Return ONLY JSON: { "reply": "", "actions": [], "suggestions": [], "plan": [] }`;
    const result = await generateText({ model, maxOutputTokens: 4096, prompt }).catch(() => ({ text: "" }));
    const parsed = extractJson(result.text);
    if (parsed) {
      reply = String(parsed.reply || "Done.");
      if (mode === "agent" || mode === "debug") actions = parseActions(parsed.actions);
      else if (mode === "plan") {
        actions = parseActions(parsed.actions).filter((a) => a.type === "build_plan");
        if (Array.isArray(parsed.plan)) plan = parsed.plan.map(String);
      }
      if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions.map(String).slice(0, 4);
    }
  }

  if (!reply && ruleHit) {
    reply = ruleHit.reply;
    actions = ruleHit.actions;
  }
  if (!reply || (!actions.length && mode === "agent" && !model)) {
    const local = await runLocalDevAgent({
      message: input.message,
      context: ctx,
      sessionId,
      mode,
      actorId: input.actorId,
    });
    if (!reply || local.executed.length) {
      writeSession(sessionId, [...history, userMsg, { role: "assistant", content: local.reply, at: new Date().toISOString() }]);
      return local;
    }
  }
  if (!reply) {
    reply = "Precision Agent — I only act on verified catalog entries and real source files. Pick an element or name a resource.";
  }

  let autofixReport = emptyAutofixReport();
  if (actions.some((a) => a.type === "stage_code") && (mode === "agent" || mode === "debug")) {
    const fixed = await autofixStageCodeActions(actions, grounded, 3);
    actions = fixed.actions;
    autofixReport = { attempts: fixed.log.length, fixed: fixed.fixed, log: fixed.log, rounds: 1 };
    for (const action of actions) {
      if (action.type !== "stage_code") continue;
      const compile = await verifyTsxCompile(action.content, action.fileName || `${action.resourceId}.tsx`);
      if (!compile.passed) {
        reply = `${reply}\n\n**Compile check failed** — ${compile.detail}`;
        actions = actions.filter((a) => a !== action);
      }
    }
  }

  let preVerify = verifyActionsBeforeExecute(actions, ctx);
  if (!preVerify.passed && actions.length && (mode === "agent" || mode === "debug")) {
    reply = `${reply}\n\n**Not applied** — ${preVerify.checks.filter((c) => !c.passed).map((c) => c.detail).join("; ")}`;
    actions = [];
  }

  const exec =
    mode === "agent" || (mode === "debug" && actions.length)
      ? executeActions(actions, ctx, input.actorId, ctx.changeSetId)
      : { executed: [] as string[], changeSetId: ctx.changeSetId || null };

  let verification = mergeVerification(preVerify, verifyChangeSetAfterExecute(exec.changeSetId, input.actorId));
  if ((mode === "agent" || mode === "debug") && actions.some((a) => a.type === "stage_code")) {
    const tc = await runProjectTypecheck(String(ctx.projectId || "instacollab"));
    verification = mergeVerification(verification, { passed: tc.passed, checks: [tc] });
    if (!tc.passed) reply = `${reply}\n\n**Typecheck failed:**\n\`\`\`\n${tc.detail.slice(-500)}\n\`\`\``;
  }
  if (mode === "plan" && actions.some((a) => a.type === "build_plan")) {
    const bp = actions.find((a) => a.type === "build_plan");
    if (bp && bp.type === "build_plan") plan = bp.steps;
  }

  const confidence: DevAgentChatResult["confidence"] = blockReason
    ? "blocked"
    : verification.passed
      ? "verified"
      : exec.executed.length
        ? "partial"
        : "verified";

  writeSession(sessionId, [...history, userMsg, { role: "assistant", content: reply, at: new Date().toISOString() }]);
  return {
    sessionId,
    reply,
    mode,
    actions,
    executed: exec.executed,
    changeSetId: exec.changeSetId,
    suggestions,
    plan,
    confidence,
    citations: grounded.citations,
    verification,
    grounded,
    blockedReason: blockReason,
    autofix: autofixReport,
  };
}

export function listDevAgentSessions(): Array<{ id: string; updatedAt: string; preview: string }> {
  if (!agentEnabled()) return [];
  const dir = path.join(AGENT_DIR, "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const data = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as {
          id?: string;
          updatedAt?: string;
          messages?: DevAgentMessage[];
        };
        const last = data.messages?.filter((m) => m.role === "user").at(-1);
        return {
          id: data.id || f.replace(/\.json$/, ""),
          updatedAt: data.updatedAt || "",
          preview: last?.content?.slice(0, 80) || "",
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b!.updatedAt).localeCompare(String(a!.updatedAt))) as Array<{ id: string; updatedAt: string; preview: string }>;
}

export function readDevAgentSession(id: string): DevAgentMessage[] {
  return readSession(id);
}
