import { runSuperhumanAgent, type SuperhumanAgentResult } from "./agentSupervisorService";
import { devAgentChat, type DevAgentContext, type AgentMode } from "./devAgentService";
import { implementUniversalBatch, type UniversalImplementResult } from "./universalImplementService";
import { readWorkspaceConfig, THIRD_PARTY_PRESETS, isDevWorkspaceEnabled } from "./workspaceConfigService";
import { scanProjectHealth, type ProactiveInsight } from "./agentProactiveService";
import { resolveProviderActionForOmni, runProviderAction, canRunNativeProvider } from "./providerIntegrationService";
import { listEnvConnectedProviderIds, isEnvProviderConfigured } from "./envProviderCatalog";
import { runLocalOmniCapability } from "./localWorkService";

export type OmniCategory =
  | "build"
  | "design"
  | "media"
  | "live"
  | "ai"
  | "deploy"
  | "integrate";

export type OmniCapability = {
  id: string;
  category: OmniCategory;
  label: string;
  icon: string;
  /** Tools this replaces — shown in UI */
  replaces: string;
  description: string;
  uiAction: "agent" | "design" | "media" | "code" | "debug" | "integrations" | "page" | "live-tab";
  page?: string;
  liveTab?: string;
  defaultPrompt?: string;
  agentMode?: AgentMode;
  providers?: string[];
};

export const OMNI_CAPABILITIES: OmniCapability[] = [
  {
    id: "build.superhuman",
    category: "build",
    label: "Superhuman Agent",
    icon: "✦",
    replaces: "Cursor, GitHub Copilot, Cody",
    description: "Memory, multi-step build, self-fix, adversarial critique — full app changes",
    uiAction: "agent",
    defaultPrompt: "Build and verify the feature I describe — no guessing",
    agentMode: "agent",
    providers: ["gemini"],
  },
  {
    id: "build.code",
    category: "build",
    label: "Code IDE",
    icon: "</>",
    replaces: "VS Code, Cursor editor",
    description: "Drop any language — TS, Swift, Python, Go, Rust, SQL, GraphQL, shaders",
    uiAction: "code",
  },
  {
    id: "build.plan",
    category: "build",
    label: "Architecture plan",
    icon: "◫",
    replaces: "Cursor Plan, ChatGPT planning",
    description: "Grounded multi-app architecture from your real monorepo",
    uiAction: "agent",
    agentMode: "plan",
    defaultPrompt: "Plan architecture for:",
  },
  {
    id: "build.debug",
    category: "build",
    label: "Debug console",
    icon: "⎈",
    replaces: "VS Code debugger, Cursor Debug",
    description: "Live iframe console + source-grounded fixes",
    uiAction: "debug",
  },
  {
    id: "design.figma",
    category: "design",
    label: "UI/UX → App",
    icon: "🎨",
    replaces: "Figma, v0, Galileo AI",
    description: "Upload mockups — pixel-faithful working screens in the live app",
    uiAction: "design",
    providers: ["gemini", "figma"],
  },
  {
    id: "design.pick",
    category: "design",
    label: "Pick & edit live",
    icon: "◎",
    replaces: "Figma inspect, Chrome DevTools",
    description: "Click any element in the real app — micro-detail control",
    uiAction: "live-tab",
    liveTab: "home",
  },
  {
    id: "media.universal",
    category: "media",
    label: "Drop anything",
    icon: "✨",
    replaces: "Runway assets, Meshy exports, manual imports",
    description: "SVG, SVGA, Lottie, video, GIF, icons, audio, 3D textures — auto-implement",
    uiAction: "media",
  },
  {
    id: "media.meshy-3d",
    category: "media",
    label: "3D models (Meshy)",
    icon: "🧊",
    replaces: "Meshy app, Blender handoff",
    description: "Text → textured GLB for AR, gifts, and characters — auto-staged",
    uiAction: "media",
    defaultPrompt: "A stylized live gift character, game-ready",
    providers: ["meshy"],
  },
  {
    id: "media.video",
    category: "media",
    label: "Video & motion",
    icon: "🎬",
    replaces: "Runway, Mashy, Pika",
    description: "Stage video gifts & animations — MP4/WebM/SVGA with renderer packs",
    uiAction: "media",
    defaultPrompt: "Implement this video as a live gift animation pack",
    providers: ["runway"],
  },
  {
    id: "media.effects",
    category: "media",
    label: "AR & face effects",
    icon: "💫",
    replaces: "Snap AR, Effect House",
    description: "Face filters, stickers, beauty — DeepAR renderer drafts",
    uiAction: "page",
    page: "face-effects",
  },
  {
    id: "live.rtc",
    category: "live",
    label: "Live & RTC",
    icon: "📺",
    replaces: "Tencent RTC console, LiveKit dashboard, Agora",
    description: "TRTC/LiveKit rooms, streaming, calls — wired to your app",
    uiAction: "page",
    page: "live-experiences",
    providers: ["tencent", "livekit"],
  },
  {
    id: "live.gifts",
    category: "live",
    label: "Live gifts",
    icon: "🎁",
    replaces: "Custom gift pipelines",
    description: "SVGA/video gift packs, thumbnails, publish to live rooms",
    uiAction: "page",
    page: "gifts",
  },
  {
    id: "ai.gemini",
    category: "ai",
    label: "AI Studio",
    icon: "🧠",
    replaces: "Google AI Studio, OpenAI Playground",
    description: "Gemini vision + codegen for design, agents, conversion",
    uiAction: "agent",
    providers: ["gemini"],
    defaultPrompt: "Analyze and implement using grounded project context only",
  },
  {
    id: "ai.ask",
    category: "ai",
    label: "Ask (read-only)",
    icon: "?",
    replaces: "ChatGPT, Claude for code Q&A",
    description: "Answers cite catalog, memory, and real source files",
    uiAction: "agent",
    agentMode: "ask",
  },
  {
    id: "deploy.publish",
    category: "deploy",
    label: "Publish",
    icon: "🚀",
    replaces: "Vercel dashboard, manual deploys",
    description: "Change sets → runtime bundles → production",
    uiAction: "page",
    page: "runtime-bundles",
    providers: ["vercel", "cloudflare", "railway"],
  },
  {
    id: "deploy.changesets",
    category: "deploy",
    label: "Change sets",
    icon: "📋",
    replaces: "Git PR workflow for UI",
    description: "Review and publish staged workspace changes",
    uiAction: "page",
    page: "change-sets",
  },
  {
    id: "integrate.all",
    category: "integrate",
    label: "All integrations",
    icon: "🔌",
    replaces: "Scattered API consoles",
    description: "Supabase, Firebase, Stripe, Figma, Runway, Meshy, Tencent, MCP",
    uiAction: "integrations",
  },
  {
    id: "integrate.mcp",
    category: "integrate",
    label: "MCP hub",
    icon: "⬡",
    replaces: "Cursor MCP, separate MCP configs",
    description: "Chrome DevTools, Supabase, Firebase, Figma, Tencent — one config",
    uiAction: "integrations",
  },
];

export type OmniCatalog = {
  categories: Array<{ id: OmniCategory; label: string }>;
  capabilities: OmniCapability[];
  connectedProviders: string[];
  tagline: string;
};

export type OmniRunResult = {
  capabilityId: string;
  status: "ready" | "partial" | "failed" | "pending";
  reply?: string;
  changeSetId?: string | null;
  agent?: SuperhumanAgentResult;
  designJobId?: string;
  implement?: UniversalImplementResult[];
  insights?: ProactiveInsight[];
  uiHint?: { action: OmniCapability["uiAction"]; page?: string; liveTab?: string };
  providerJobId?: string;
  externalTaskId?: string;
  outputs?: Array<{ url?: string; fileName?: string; previewUrl?: string; designJobId?: string }>;
};

function enabled(): boolean {
  return isDevWorkspaceEnabled();
}

export function getOmniCatalog(): OmniCatalog {
  const connected = [...new Set(listEnvConnectedProviderIds())];
  const cfg = readWorkspaceConfig();
  for (const [id, row] of Object.entries(cfg.thirdParty)) {
    if (row.enabled && !connected.includes(id)) connected.push(id);
  }
  return {
    tagline: "Self-driving — local engine does real work always; .env keys add native APIs when you want them",
    categories: [
      { id: "build", label: "Build & code" },
      { id: "design", label: "Design & UI" },
      { id: "media", label: "Media & video" },
      { id: "live", label: "Live & RTC" },
      { id: "ai", label: "AI lab" },
      { id: "deploy", label: "Deploy" },
      { id: "integrate", label: "Integrate" },
    ],
    capabilities: OMNI_CAPABILITIES,
    connectedProviders: [...new Set(connected)],
  };
}

function cap(id: string): OmniCapability | null {
  return OMNI_CAPABILITIES.find((c) => c.id === id) || null;
}

export async function runOmniCapability(input: {
  capabilityId: string;
  message?: string;
  files?: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
  context?: DevAgentContext;
  sessionId?: string;
  actorId: string;
}): Promise<OmniRunResult> {
  if (!enabled()) {
    throw Object.assign(new Error("omni studio local only"), { status: 404, code: "error.notFound" });
  }

  const capability = cap(input.capabilityId);
  if (!capability) {
    throw Object.assign(new Error("unknown capability"), { status: 400, code: "omni.unknown" });
  }

  const insights = await scanProjectHealth(String(input.context?.projectId || "instacollab"));
  const uiHint = {
    action: capability.uiAction,
    page: capability.page,
    liveTab: capability.liveTab,
  };

  const prompt =
    input.message?.trim() ||
    capability.defaultPrompt ||
    `Execute ${capability.label} using grounded sources only`;

  if (canRunNativeProvider(input.capabilityId, { message: prompt, files: input.files })) {
    const nativeAction = resolveProviderActionForOmni(input.capabilityId)!;
    try {
      const providerResult = await runProviderAction({
        providerId: nativeAction.providerId,
        actionId: nativeAction.actionId,
        prompt,
        files: input.files,
        context: {
          projectId: input.context?.projectId ?? undefined,
          changeSetId: input.context?.changeSetId,
          pickLabel: input.context?.pick?.label,
          targetResourceId: input.context?.detail?.resourceId,
          targetResourceType: input.context?.detail?.type,
          screenName: input.context?.detail?.name,
        },
        actorId: input.actorId,
      });
      return {
        capabilityId: input.capabilityId,
        status: providerResult.status,
        reply: providerResult.reply,
        changeSetId: providerResult.changeSetId,
        providerJobId: providerResult.jobId,
        externalTaskId: providerResult.externalTaskId,
        outputs: providerResult.outputs,
        insights,
        uiHint,
      };
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code !== "provider.notConfigured") {
        return {
          capabilityId: input.capabilityId,
          status: "failed",
          reply: `Provider ${nativeAction.providerId}: ${err.message}`,
          insights,
          uiHint,
        };
      }
    }
  }

  if (capability.uiAction !== "agent" && capability.uiAction !== "debug" && !input.message && !input.files?.length) {
    return {
      capabilityId: input.capabilityId,
      status: "ready",
      reply: `Opened ${capability.label} — ${capability.description}`,
      insights,
      uiHint,
    };
  }

  if (input.files?.length && (capability.id.startsWith("design") || capability.id.startsWith("media"))) {
    const batch = await implementUniversalBatch(
      input.files.map((f) => ({
        ...f,
        targetResourceId: input.context?.detail?.resourceId || input.context?.pick?.nodeId,
        targetResourceType: input.context?.detail?.type,
        pickLabel: input.context?.pick?.label,
        projectId: input.context?.projectId,
        changeSetId: input.context?.changeSetId,
        actorId: input.actorId,
      })),
    );
    return {
      capabilityId: input.capabilityId,
      status: batch.confidence === "verified" ? "ready" : batch.confidence === "partial" ? "partial" : "failed",
      reply: `Implemented ${batch.items.length} file(s) via ${capability.label}`,
      changeSetId: batch.changeSetId,
      implement: batch.items,
      insights,
      uiHint,
    };
  }

  const mode: AgentMode =
    capability.agentMode ||
    (capability.uiAction === "debug" ? "debug" : "agent");

  const geminiAvailable = isEnvProviderConfigured("gemini");

  if (!geminiAvailable && (mode === "agent" || mode === "debug" || input.files?.length)) {
    const local = await runLocalOmniCapability({
      capabilityId: input.capabilityId,
      message: prompt,
      files: input.files,
      context: input.context,
      actorId: input.actorId,
    });
    if (local && local.status !== "failed") {
      return { ...local, insights, uiHint };
    }
  }

  if (mode === "ask" || mode === "plan") {
    const result = await devAgentChat({
      message: prompt,
      context: input.context,
      sessionId: input.sessionId,
      mode,
      actorId: input.actorId,
    });
    return {
      capabilityId: input.capabilityId,
      status: result.confidence === "verified" ? "ready" : "partial",
      reply: result.reply,
      changeSetId: result.changeSetId,
      insights,
      uiHint,
    };
  }

  const agent = await runSuperhumanAgent({
    message:
      capability.id === "live.rtc"
        ? `${prompt}\n\nFocus: Tencent TRTC / LiveKit integration, live rooms, streaming. Cite TRTC docs patterns.`
        : capability.id === "media.video"
          ? `${prompt}\n\nFocus: video gift animation packs, MP4/WebM/SVGA renderers.`
          : prompt,
    context: input.context,
    sessionId: input.sessionId,
    mode,
    actorId: input.actorId,
  });

  if (agent.confidence !== "verified" && !agent.executed.length && agent.confidence !== "blocked") {
    const local = await runLocalOmniCapability({
      capabilityId: input.capabilityId,
      message: prompt,
      files: input.files,
      context: input.context,
      actorId: input.actorId,
    });
    if (local && local.status !== "failed") {
      return { ...local, insights, uiHint };
    }
  }

  return {
    capabilityId: input.capabilityId,
    status: agent.supervisor?.superhuman ? "ready" : agent.confidence === "verified" ? "ready" : "partial",
    reply: agent.reply,
    changeSetId: agent.changeSetId,
    agent,
    insights,
    uiHint,
  };
}

export function omniProviderPresets(): typeof THIRD_PARTY_PRESETS {
  return THIRD_PARTY_PRESETS;
}
