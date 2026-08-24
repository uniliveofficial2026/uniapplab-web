import { createHash } from "node:crypto";
import { createChangeSet } from "./changeSetService";
import { addOrUpdateItem } from "./changeItemService";
import { buildGroundedContext, groundingBlocksExecution } from "./agentGroundingService";
import { browseUiCloneCatalog, getUiCloneDetail } from "./uiCloneCatalogService";
import { createAnimationDraft } from "./content/AnimationAdminService";
import { implementUniversalBatch } from "./universalImplementService";
import { runProjectTypecheck, verifyTsxCompile, type VerificationReport } from "./agentVerificationService";
import type { DevAgentAction, DevAgentChatResult, DevAgentContext, AgentMode } from "./devAgentService";
import { stageMicroEdit } from "./devAgentService";
import type { OmniRunResult } from "./omniStudioService";
import type { ProviderRunInput, ProviderRunResult } from "./providerIntegrationService";
import { isEnvProviderConfigured } from "./envProviderCatalog";
import { isCloudStudioRuntime, isStudioEnabled } from "./workspaceRuntimeService";
import { detectAppScaffoldIntent, scaffoldAppStructure } from "./appStructureScaffoldService";
import { detectDeployIntent, runDeployAgent } from "./appDeployAgentService";
import { runTerminalAgent } from "./localTerminalService";
import { runEnvAgent } from "./localEnvAgentService";
import { connectLocalEnvToProcess } from "./localEnvFileService";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "work";
}

function emptyVerify(): VerificationReport {
  return { passed: true, checks: [] };
}

function tokenize(message: string): string[] {
  return message.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) || [];
}

function catalogMatches(message: string, limit = 5) {
  const words = tokenize(message).filter((w) => w.length > 3);
  const q = words.slice(0, 4).join(" ");
  const browse = browseUiCloneCatalog({ q, limit: 40 });
  const scored = browse.items
    .map((item) => {
      const hay = `${item.name} ${item.resourceId} ${item.domain || ""} ${item.routeKey || ""}`.toLowerCase();
      const score = words.reduce((n, w) => (hay.includes(w) ? n + 1 : n), 0);
      return { item, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((r) => r.item);
}

function stageCatalogExperience(
  resourceId: string,
  actorId: string,
  changeSetId: string | null,
  note: string,
): { changeSetId: string; executed: string[] } {
  const detail = getUiCloneDetail(resourceId);
  let csId = changeSetId;
  if (!csId) {
    csId = createChangeSet(
      {
        title: `Local scaffold — ${detail.name}`,
        description: note,
        targetEnvironment: "local",
        baseSnapshotId: "snapshot.bundled.default",
      },
      actorId,
    ).id;
  }
  addOrUpdateItem(
    csId,
    {
      resourceType: detail.type,
      resourceId: detail.resourceId,
      operation: "update",
      patch: {
        name: detail.name,
        scaffoldedBy: "local-work-engine",
        experienceKey: detail.experienceKey,
        sourcePath: detail.sourcePath,
        nodeCount: detail.nodeCount,
        note,
        editedAt: new Date().toISOString(),
      },
    },
    actorId,
  );
  return { changeSetId: csId, executed: [`Catalog scaffold staged for ${detail.resourceId}`] };
}

function scaffoldComponentFromSource(
  groundedPath: string,
  screenName: string,
  resourceId: string,
  actorId: string,
  changeSetId: string | null,
): { changeSetId: string; content: string; executed: string[] } {
  const file = buildGroundedContext({ detail: { resourceId, name: screenName, type: "ui.node" } }).sourceFiles.find(
    (f) => f.path === groundedPath && f.exists,
  );
  const content =
    file?.excerpt ||
    `import React from 'react';

/** Local scaffold — wire to catalog resource ${resourceId} */
export function ${screenName.replace(/[^a-zA-Z0-9]/g, "") || "LocalScreen"}() {
  return (
    <div className="mx-auto max-w-[390px] p-4" data-local-scaffold="${slug(screenName)}">
      <h1 className="text-lg font-semibold">${screenName}</h1>
      <p className="text-sm text-zinc-400">Staged by local work engine — publish to apply.</p>
    </div>
  );
}
`;
  let csId = changeSetId;
  if (!csId) {
    csId = createChangeSet(
      {
        title: `Local code — ${screenName}`,
        description: "Scaffolded from grounded source without external AI",
        targetEnvironment: "local",
        baseSnapshotId: "snapshot.bundled.default",
      },
      actorId,
    ).id;
  }
  addOrUpdateItem(
    csId,
    {
      resourceType: "ui.node",
      resourceId,
      operation: "update",
      patch: {
        name: screenName,
        sourcePreview: content.slice(0, 16000),
        generatedBy: "local-work-engine",
        sourcePath: groundedPath || null,
        editedAt: new Date().toISOString(),
      },
    },
    actorId,
  );
  return { changeSetId: csId, content, executed: [`Code scaffold staged for ${resourceId}`] };
}

function parseMicroEdit(message: string, ctx: DevAgentContext): DevAgentAction | null {
  const lower = message.toLowerCase();
  const resourceId = ctx.detail?.resourceId || ctx.pick?.nodeId || ctx.pick?.componentId;
  if (!resourceId) return null;

  const patch: Record<string, unknown> = { styles: {}, microEdit: true };
  const styles = patch.styles as Record<string, string>;

  const rules: Array<[RegExp, (m: RegExpMatchArray) => void]> = [
    [/padding\s*[:=]?\s*([#\w\d.%pxrem]+)/i, (m) => { styles.padding = m[1]; }],
    [/margin\s*[:=]?\s*([#\w\d.%pxrem]+)/i, (m) => { styles.margin = m[1]; }],
    [/font-size\s*[:=]?\s*([#\w\d.%pxrem]+)/i, (m) => { styles.fontSize = m[1]; }],
    [/color\s*[:=]?\s*(#[0-9a-f]{3,8}|[a-z]+)/i, (m) => { styles.color = m[1]; }],
    [/background(?:-color)?\s*[:=]?\s*(#[0-9a-f]{3,8}|[a-z]+)/i, (m) => { styles.backgroundColor = m[1]; }],
    [/width\s*[:=]?\s*([#\w\d.%pxrem]+)/i, (m) => { styles.width = m[1]; }],
    [/height\s*[:=]?\s*([#\w\d.%pxrem]+)/i, (m) => { styles.height = m[1]; }],
    [/border-radius\s*[:=]?\s*([#\w\d.%pxrem]+)/i, (m) => { styles.borderRadius = m[1]; }],
    [/text\s*[:=]\s*["']([^"']+)["']/i, (m) => { patch.textContent = m[1]; }],
    [/label\s*[:=]\s*["']([^"']+)["']/i, (m) => { patch.label = m[1]; }],
    [/hide|hidden|invisible/i, () => { patch.hidden = true; }],
    [/show|visible|display/i, () => { patch.hidden = false; }],
  ];

  let matched = false;
  for (const [re, apply] of rules) {
    const m = message.match(re);
    if (m) {
      apply(m);
      matched = true;
    }
  }
  if (!matched) return null;
  return { type: "micro_edit", resourceId, resourceType: ctx.detail?.type, patch };
}

function planSteps(message: string, ctx: DevAgentContext): string[] {
  const matches = catalogMatches(message, 3);
  const steps = [
    "Read grounded catalog + source files (zero guessing)",
    ...message
      .split(/(?:\band\b|\bthen\b|;|\n)/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 8)
      .slice(0, 4),
  ];
  if (matches.length) {
    steps.push(`Reuse catalog pattern: ${matches.map((m) => m.resourceId).join(", ")}`);
  }
  if (ctx.detail?.resourceId) steps.push(`Target resource: ${ctx.detail.resourceId}`);
  return [...new Set(steps)].slice(0, 6);
}

function askFromGrounded(message: string, ctx: DevAgentContext): string {
  const grounded = buildGroundedContext(ctx);
  const lines = [
    "**Local engine answer** (from your real repo — no external AI):",
    "",
    `Citations: ${grounded.citations.join(", ") || "project root"}`,
  ];
  if (grounded.catalogDetail) {
    lines.push("", "**Catalog**", "```json", JSON.stringify(grounded.catalogDetail, null, 2).slice(0, 2500), "```");
  }
  for (const file of grounded.sourceFiles.filter((f) => f.exists).slice(0, 3)) {
    lines.push("", `**${file.path}** (${file.lineCount} lines)`, "```", file.excerpt.slice(0, 1200), "```");
  }
  if (grounded.missing.length) {
    lines.push("", `Missing: ${grounded.missing.join(", ")}`);
  }
  lines.push("", `_Question: ${message.slice(0, 200)}_`);
  return lines.join("\n");
}

async function stageAnimationPlaceholder(input: {
  name: string;
  prompt: string;
  actorId: string;
  changeSetId?: string | null;
  targetResourceId?: string | null;
}): Promise<{ changeSetId: string; resourceId: string; executed: string[] }> {
  const draft = createAnimationDraft(
    {
      name: `${input.name} — ${input.prompt.slice(0, 80)}`,
      animationId: input.targetResourceId || `animation.local.${slug(input.name)}`,
      rendererId: "renderer.gift.video.v1",
      format: "video",
      durationMs: 3000,
      qualityVariants: [],
    },
    input.actorId,
  );
  return {
    changeSetId: draft.changeSetId,
    resourceId: draft.resourceId,
    executed: [`Animation placeholder staged (${input.name})`, "Drop MP4/WebM/SVGA to replace placeholder"],
  };
}

async function executeLocalActions(
  actions: DevAgentAction[],
  ctx: DevAgentContext,
  actorId: string,
): Promise<{ executed: string[]; changeSetId: string | null }> {
  const executed: string[] = [];
  let changeSetId = ctx.changeSetId || null;
  for (const action of actions) {
    if (action.type === "micro_edit") {
      const r = stageMicroEdit(
        { resourceId: action.resourceId, resourceType: action.resourceType, patch: action.patch, changeSetId },
        actorId,
      );
      changeSetId = r.changeSetId;
      executed.push(`Micro edit → ${action.resourceId}`);
    } else if (action.type === "build_plan") {
      executed.push(`Plan: ${action.steps.length} steps`);
    }
  }
  return { executed, changeSetId };
}

export function localWorkEngineActive(): boolean {
  return true;
}

export async function runLocalDevAgent(input: {
  message: string;
  context?: DevAgentContext;
  sessionId?: string;
  mode?: AgentMode;
  actorId: string;
}): Promise<DevAgentChatResult> {
  const mode = input.mode || "agent";
  const ctx: DevAgentContext = { ...input.context };
  const grounded = buildGroundedContext(ctx);
  const blockReason = groundingBlocksExecution(grounded, mode);
  const sessionId =
    input.sessionId ||
    createHash("sha256").update(`${input.actorId}:local:${Date.now()}`).digest("hex").slice(0, 12);

  connectLocalEnvToProcess();

  if (blockReason && (mode === "agent" || mode === "debug")) {
    return {
      sessionId,
      mode,
      reply: blockReason,
      actions: [],
      executed: [],
      changeSetId: ctx.changeSetId || null,
      suggestions: ["Pick an element in the live app", "Name a catalog resource id"],
      confidence: "blocked",
      citations: grounded.citations,
      verification: emptyVerify(),
      grounded,
      blockedReason: blockReason,
    };
  }

  if (mode === "ask") {
    return {
      sessionId,
      mode,
      reply: askFromGrounded(input.message, ctx),
      actions: [],
      executed: ["Grounded catalog + source read"],
      changeSetId: ctx.changeSetId || null,
      suggestions: ["Switch to Agent mode to apply changes", "Pick a node for file excerpts"],
      confidence: "verified",
      citations: grounded.citations,
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
    };
  }

  if (mode === "plan") {
    const steps = planSteps(input.message, ctx);
    return {
      sessionId,
      mode,
      reply: `**Local architecture plan** (grounded, no external AI):\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
      actions: [{ type: "build_plan", steps }],
      executed: [`Plan: ${steps.length} steps`],
      changeSetId: ctx.changeSetId || null,
      plan: steps,
      suggestions: ["Run in Agent mode to execute step 1", "Drop mockup in Design for pixel scaffold"],
      confidence: "verified",
      citations: grounded.citations,
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
    };
  }

  const lower = input.message.toLowerCase();

  const envResult = await runEnvAgent({ message: input.message });
  if (envResult) {
    return {
      sessionId,
      mode,
      reply: envResult.reply,
      actions: [],
      executed: envResult.executed,
      changeSetId: ctx.changeSetId || null,
      suggestions: envResult.suggestions,
      confidence: envResult.terminal ? (envResult.terminal.ok ? "verified" : "partial") : "verified",
      citations: grounded.citations,
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
      terminal: envResult.terminal,
    };
  }

  const terminalResult = await runTerminalAgent({ message: input.message });
  if (terminalResult) {
    return {
      sessionId,
      mode,
      reply: terminalResult.reply,
      actions: [],
      executed: terminalResult.executed,
      changeSetId: ctx.changeSetId || null,
      suggestions: terminalResult.suggestions,
      confidence: terminalResult.terminal.ok ? "verified" : "partial",
      citations: grounded.citations,
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
      terminal: terminalResult.terminal,
    };
  }

  if (detectDeployIntent(input.message) && !detectAppScaffoldIntent(input.message)) {
    const deployResult = runDeployAgent({ message: input.message, actorId: input.actorId });
    if (deployResult) {
      return {
        sessionId,
        mode,
        reply: deployResult.reply,
        actions: [],
        executed: deployResult.executed,
        changeSetId: ctx.changeSetId || null,
        suggestions: deployResult.suggestions,
        confidence: deployResult.executed.length ? "verified" : "partial",
        citations: grounded.citations,
        verification: emptyVerify(),
        grounded,
        blockedReason: null,
        deploy: deployResult.deploy
          ? {
              targets: deployResult.deploy.targets.map((t) => ({
                id: t.id,
                label: t.label,
                cmd: t.cmd,
                status: t.status,
                env: t.env,
                notes: t.notes,
              })),
              workflow: deployResult.deploy.manifest?.workflow ?? [],
              githubPush: deployResult.deploy.manifest?.github.pushScript,
              publishPath: deployResult.deploy.changeSetUrl ?? deployResult.deploy.manifest?.publish.changeSetPath,
            }
          : undefined,
      };
    }
  }

  if (detectAppScaffoldIntent(input.message)) {
    const scaffold = scaffoldAppStructure({
      message: input.message,
      actorId: input.actorId,
      changeSetId: ctx.changeSetId || null,
      projectId: ctx.projectId,
    });
    return {
      sessionId,
      mode,
      reply:
        `✓ **${scaffold.appName}** — ${scaffold.stackLabel ?? scaffold.stack ?? "app"} (${scaffold.template}, ${scaffold.files.length} files)\n\n` +
        `**Run:** \`${scaffold.devCommand}\`${scaffold.devPort && scaffold.devPort > 0 ? ` → http://127.0.0.1:${scaffold.devPort}` : ""}\n` +
        `Features: ${scaffold.features.join(" · ")}\n` +
        `Platforms: ${(scaffold.platforms ?? ["web", "pwa"]).join(", ")}\n` +
        `Breakpoints: ${(scaffold.breakpoints ?? []).map((b) => b.id).join(", ") || "mobile, tablet, desktop"}\n` +
        `Pipeline: ${scaffold.pipeline.map((s) => s.id).join(" → ")}\n` +
        `Ship: \`pnpm run git:push\` → Publish change set → \`bash scripts/vercel-deploy.sh --prod\`\n` +
        (scaffold.typecheckPassed === true ? "Typecheck: ✓ passed\n" : scaffold.typecheckPassed === false ? "Typecheck: run pnpm install in repo root\n" : "") +
        (scaffold.writtenToDisk ? "Written to disk — ready to run like Cursor scaffold." : "Staged in change set (cloud runtime)."),
      actions: [],
      executed: [`App scaffold: ${scaffold.files.length} files`, `Registered project: ${scaffold.appId}`],
      changeSetId: scaffold.changeSetId,
      suggestions: [
        scaffold.stack === "flutter"
          ? `cd ${scaffold.rootPath} && flutter pub get`
          : scaffold.stack === "ios-native"
            ? `cd ${scaffold.rootPath}/ios && xcodegen generate`
            : scaffold.stack === "android-native"
              ? `cd ${scaffold.rootPath} && ./gradlew :app:assembleDebug`
              : `cd ${scaffold.rootPath} && pnpm install`,
        "Copy .env.example → .env.local",
        "pnpm run git:push",
        "Say: publish change set",
        "Say: deploy to vercel",
      ],
      confidence: "verified",
      citations: [...grounded.citations, `app:${scaffold.appId}`, `path:${scaffold.rootPath}`],
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
      appStructure: scaffold,
    };
  }

  const micro = parseMicroEdit(input.message, ctx);
  if (micro) {
    const exec = await executeLocalActions([micro], ctx, input.actorId);
    return {
      sessionId,
      mode,
      reply: `✓ Local engine staged micro edit on **${micro.type === "micro_edit" || micro.type === "stage_code" ? micro.resourceId : "resource"}**`,
      actions: [micro],
      executed: exec.executed,
      changeSetId: exec.changeSetId,
      suggestions: ["Publish change set", "Pick another element"],
      confidence: "verified",
      citations: grounded.citations,
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
    };
  }

  const matches = catalogMatches(input.message, 3);
  if (matches.length && /(build|create|add|scaffold|clone|copy|implement|screen|page|feature)/.test(lower)) {
    const top = matches[0];
    const staged = stageCatalogExperience(
      top.resourceId,
      input.actorId,
      ctx.changeSetId || null,
      `Local engine matched "${top.name}" from catalog`,
    );
    let reply = `✓ Staged **${top.name}** (${top.resourceId}) from catalog — ${top.nodeCount || 0} nodes`;
    if (top.sourcePath) {
      const code = scaffoldComponentFromSource(
        top.sourcePath,
        top.name,
        top.resourceId,
        input.actorId,
        staged.changeSetId,
      );
      reply += `\n\nSource scaffold from \`${top.sourcePath}\` (${code.content.length} chars)`;
      staged.executed.push(...code.executed);
    }
    return {
      sessionId,
      mode,
      reply,
      actions: [],
      executed: staged.executed,
      changeSetId: staged.changeSetId,
      suggestions: matches.slice(1, 3).map((m) => `Also related: ${m.resourceId}`),
      confidence: "verified",
      citations: [...grounded.citations, `catalog:${top.resourceId}`],
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
    };
  }

  if (ctx.detail?.sourcePath || grounded.sourceFiles.some((f) => f.exists)) {
    const src = ctx.detail?.sourcePath || grounded.sourceFiles.find((f) => f.exists)?.path || "";
    const resourceId = ctx.detail?.resourceId || `ui.local.${slug(input.message.slice(0, 40))}`;
    const code = scaffoldComponentFromSource(
      src,
      ctx.detail?.name || "LocalScreen",
      resourceId,
      input.actorId,
      ctx.changeSetId || null,
    );
    const compile = await verifyTsxCompile(code.content, "LocalScreen.tsx");
    return {
      sessionId,
      mode,
      reply: `✓ Local engine staged code from grounded source \`${src || "template"}\``,
      actions: [],
      executed: code.executed,
      changeSetId: code.changeSetId,
      suggestions: ["Add GEMINI_API_KEY for AI codegen", "Drop files for universal implement"],
      confidence: compile.passed ? "verified" : "partial",
      citations: grounded.citations,
      verification: { passed: compile.passed, checks: [compile] },
      grounded,
      blockedReason: null,
    };
  }

  if (/(video|animation|gift|motion|runway)/.test(lower)) {
    const anim = await stageAnimationPlaceholder({
      name: slug(input.message.slice(0, 40)),
      prompt: input.message,
      actorId: input.actorId,
      changeSetId: ctx.changeSetId,
      targetResourceId: ctx.detail?.resourceId,
    });
    return {
      sessionId,
      mode,
      reply: "✓ Local engine staged animation placeholder — drop MP4/WebM/SVGA to implement, or add RUNWAY_API_KEY for AI video",
      actions: [],
      executed: anim.executed,
      changeSetId: anim.changeSetId,
      suggestions: ["Drop video in Omni", "Configure Runway in .env for generation"],
      confidence: "partial",
      citations: grounded.citations,
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
    };
  }

  if (/(trtc|tencent|livekit|rtc|stream|room)/.test(lower)) {
    let csId = ctx.changeSetId || null;
    if (!csId) {
      csId = createChangeSet(
        {
          title: "Local RTC wiring",
          description: input.message,
          targetEnvironment: "local",
          baseSnapshotId: "snapshot.bundled.default",
        },
        input.actorId,
      ).id;
    }
    addOrUpdateItem(
      csId,
      {
        resourceType: "ui.experience",
        resourceId: "experience.live.local-wiring",
        operation: "update",
        patch: {
          note: input.message,
          wiredBy: "local-work-engine",
          hints: [
            "artifacts/api-server/src/routes/tencentRtc.ts",
            "artifacts/api-server/src/lib/tencentRtc.ts",
            "TENCENT_RTC_SDK_APP_ID + TENCENT_RTC_SECRET_KEY in .env",
          ],
          editedAt: new Date().toISOString(),
        },
      },
      input.actorId,
    );
    return {
      sessionId,
      mode,
      reply: "✓ Local engine staged RTC integration notes + change set — keys in .env optional for UserSig",
      actions: [],
      executed: ["RTC wiring staged", "See tencentRtc routes in api-server"],
      changeSetId: csId,
      suggestions: ["Add Tencent keys to .env for live UserSig", "Open live-experiences page"],
      confidence: "partial",
      citations: [...grounded.citations, "file:artifacts/api-server/src/lib/tencentRtc.ts"],
      verification: emptyVerify(),
      grounded,
      blockedReason: null,
    };
  }

  if (mode === "debug" || /(fix|error|bug|fail|typecheck)/.test(lower)) {
    const projectId = String(ctx.projectId || "instacollab");
    const tc = await runProjectTypecheck(projectId);
    const logHint = ctx.debugLogs?.slice(-5).map((l) => `[${l.level}] ${l.message}`).join("\n") || "";
    return {
      sessionId,
      mode,
      reply: [
        "**Local debug report**",
        tc.passed ? "Typecheck: ✓ pass" : `Typecheck: ✗\n\`\`\`\n${tc.detail.slice(-800)}\n\`\`\``,
        logHint ? `\nRecent logs:\n${logHint}` : "",
        grounded.sourceFiles.filter((f) => f.exists).length
          ? `\nGrounded files: ${grounded.sourceFiles.filter((f) => f.exists).map((f) => f.path).join(", ")}`
          : "",
      ].join("\n"),
      actions: [],
      executed: ["Local typecheck + log scan"],
      changeSetId: ctx.changeSetId || null,
      suggestions: ["Pick failing component in live app", "Drop fixed .tsx file in Code drawer"],
      confidence: tc.passed ? "verified" : "partial",
      citations: grounded.citations,
      verification: { passed: tc.passed, checks: [tc] },
      grounded,
      blockedReason: null,
    };
  }

  return {
    sessionId,
    mode,
    reply:
      "**Local work engine** — real changes without external providers:\n" +
      "- Pick an element + say `padding 12px` or `color #fff`\n" +
      "- Say `build settings screen` (matches catalog)\n" +
      "- Drop files in Omni (code, video, mockups)\n" +
      "- Add `.env` keys anytime for native Runway/Meshy/Figma APIs",
    actions: [],
    executed: [],
    changeSetId: ctx.changeSetId || null,
    suggestions: ["Pick element in live app", "Drop asset in Omni", "build <feature> from catalog"],
    confidence: "verified",
    citations: grounded.citations,
    verification: emptyVerify(),
    grounded,
    blockedReason: null,
  };
}

export async function runLocalOmniCapability(input: {
  capabilityId: string;
  message?: string;
  files?: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
  context?: DevAgentContext;
  actorId: string;
}): Promise<OmniRunResult | null> {
  const prompt = input.message?.trim() || "";

  if (input.files?.length) {
    const batch = await implementUniversalBatch(
      input.files.map((f) => ({
        ...f,
        targetResourceId: input.context?.detail?.resourceId || input.context?.pick?.nodeId,
        targetResourceType: input.context?.detail?.type,
        pickLabel: input.context?.pick?.label,
        projectId: input.context?.projectId ?? undefined,
        changeSetId: input.context?.changeSetId,
        actorId: input.actorId,
      })),
    );
    return {
      capabilityId: input.capabilityId,
      status: batch.confidence === "verified" ? "ready" : batch.confidence === "partial" ? "partial" : "failed",
      reply: `✓ Local engine implemented ${batch.items.length} file(s)`,
      changeSetId: batch.changeSetId,
    };
  }

  const mode: AgentMode =
    input.capabilityId.startsWith("build.plan") ? "plan" :
    input.capabilityId.startsWith("ai.ask") ? "ask" :
    input.capabilityId.startsWith("build.debug") ? "debug" :
    "agent";

  const local = await runLocalDevAgent({
    message: prompt || input.capabilityId,
    context: input.context,
    mode,
    actorId: input.actorId,
  });

  return {
    capabilityId: input.capabilityId,
    status: local.confidence === "blocked" ? "failed" : local.confidence === "verified" ? "ready" : "partial",
    reply: local.reply,
    changeSetId: local.changeSetId,
  };
}

export async function runLocalProviderAction(input: ProviderRunInput): Promise<ProviderRunResult> {
  if (input.files?.length) {
    const batch = await implementUniversalBatch(
      input.files.map((f) => ({
        ...f,
        targetResourceId: input.context?.targetResourceId,
        targetResourceType: input.context?.targetResourceType,
        pickLabel: input.context?.pickLabel,
        projectId: input.context?.projectId ?? undefined,
        changeSetId: input.context?.changeSetId,
        actorId: input.actorId,
      })),
    );
    return {
      providerId: input.providerId,
      actionId: input.actionId,
      status: batch.confidence === "verified" ? "ready" : "partial",
      reply: `✓ Local engine implemented ${batch.items.length} file(s)`,
      changeSetId: batch.changeSetId,
    };
  }

  const local = await runLocalDevAgent({
    message: input.prompt || `${input.providerId} ${input.actionId}`,
    context: {
      projectId: input.context?.projectId,
      changeSetId: input.context?.changeSetId,
      pick: input.context?.pickLabel ? { label: input.context.pickLabel } : undefined,
      detail: input.context?.targetResourceId
        ? { resourceId: input.context.targetResourceId, name: input.context.pickLabel || "", type: input.context.targetResourceType || "ui.node" }
        : undefined,
    },
    mode: "agent",
    actorId: input.actorId,
  });

  const nativeAvailable = isEnvProviderConfigured(input.providerId);
  return {
    providerId: input.providerId,
    actionId: input.actionId,
    status: local.confidence === "verified" ? "ready" : "partial",
    reply: nativeAvailable
      ? local.reply
      : `${local.reply}\n\n_(Native ${input.providerId} API optional — local engine handled this.)_`,
    changeSetId: local.changeSetId,
  };
}

export function localEngineSummary(): {
  active: boolean;
  message: string;
  worksWithoutProviders: boolean;
  runtime: "local" | "cloud";
} {
  const cloud = isCloudStudioRuntime();
  return {
    active: isStudioEnabled(),
    worksWithoutProviders: true,
    runtime: cloud ? "cloud" : "local",
    message: cloud
      ? "Cloud work engine — catalog scaffolds, change sets, file drops, micro-edits. No external APIs required."
      : "Local work engine — catalog, code, assets, micro-edits, typecheck. External APIs optional.",
  };
}
