import { THIRD_PARTY_PRESETS, isDevWorkspaceEnabled } from "./workspaceConfigService";
import { isProviderConfigured, isProviderEnabled, providerSetupHint } from "./providerSecretsService";
import { createProviderJob, patchProviderJob, readProviderJob } from "./providerJobStore";
import { implementUniversalBatch } from "./universalImplementService";
import { importDesignAgent } from "./designAgentService";
import { runSuperhumanAgent } from "./agentSupervisorService";
import { runLocalProviderAction } from "./localWorkService";
import * as runway from "./providers/runwayProvider";
import * as meshy from "./providers/meshyProvider";
import * as figma from "./providers/figmaProvider";
import * as platform from "./providers/platformProviders";

export type ProviderActionDef = {
  id: string;
  label: string;
  description: string;
  requiresPrompt?: boolean;
  requiresFile?: boolean;
  async?: boolean;
  omniCapabilityIds?: string[];
};

export type ProviderDef = {
  id: string;
  label: string;
  description: string;
  category: "design" | "media" | "live" | "ai" | "deploy" | "data";
  replaces: string;
  actions: ProviderActionDef[];
};

export const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    id: "runway",
    label: "Runway",
    description: "AI video & image generation",
    category: "media",
    replaces: "Runway app, Pika",
    actions: [
      { id: "text-to-video", label: "Text → video", description: "Generate MP4 from prompt", requiresPrompt: true, async: true, omniCapabilityIds: ["media.video"] },
      { id: "image-to-video", label: "Image → video", description: "Animate a still image", requiresPrompt: true, requiresFile: true, async: true },
      { id: "poll-task", label: "Poll task", description: "Check Runway task status", async: true },
    ],
  },
  {
    id: "meshy",
    label: "Meshy",
    description: "Text/image → 3D models",
    category: "media",
    replaces: "Meshy app, manual 3D pipeline",
    actions: [
      { id: "text-to-3d", label: "Text → 3D", description: "Preview + refine GLB", requiresPrompt: true, async: true, omniCapabilityIds: ["media.meshy-3d"] },
      { id: "image-to-3d", label: "Image → 3D", description: "Single image to GLB", requiresFile: true, async: true },
    ],
  },
  {
    id: "figma",
    label: "Figma",
    description: "Design file import & export",
    category: "design",
    replaces: "Figma Dev Mode, manual handoff",
    actions: [
      { id: "export-frames", label: "Export frames", description: "PNG frames → Design Agent", async: true, omniCapabilityIds: ["design.figma"] },
      { id: "file-info", label: "File info", description: "List frames in connected file" },
    ],
  },
  {
    id: "tencent",
    label: "Tencent RTC",
    description: "TRTC UserSig & live streaming",
    category: "live",
    replaces: "Tencent RTC console",
    actions: [
      { id: "usersig", label: "UserSig", description: "Mint TRTC token for a user id" },
      { id: "health", label: "Health", description: "Verify SDK + secret" },
    ],
  },
  {
    id: "livekit",
    label: "LiveKit",
    description: "Realtime rooms & tokens",
    category: "live",
    replaces: "LiveKit dashboard",
    actions: [
      { id: "token", label: "Room token", description: "Create join token for a room" },
      { id: "health", label: "Health", description: "Ping LiveKit server" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Design + dev agents",
    category: "ai",
    replaces: "Google AI Studio",
    actions: [{ id: "health", label: "Health", description: "Verify API key" }],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Optional secondary models",
    category: "ai",
    replaces: "OpenAI Playground",
    actions: [{ id: "health", label: "Health", description: "Verify API key" }],
  },
  {
    id: "vercel",
    label: "Vercel",
    description: "Deploy previews & production",
    category: "deploy",
    replaces: "Vercel dashboard",
    actions: [{ id: "health", label: "Health", description: "Verify token" }],
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    description: "Workers, R2, DNS",
    category: "deploy",
    replaces: "Cloudflare dashboard",
    actions: [{ id: "health", label: "Health", description: "Verify API token" }],
  },
  {
    id: "railway",
    label: "Railway",
    description: "Backend services",
    category: "deploy",
    replaces: "Railway dashboard",
    actions: [{ id: "health", label: "Health", description: "Verify token" }],
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "Payments",
    category: "data",
    replaces: "Stripe dashboard",
    actions: [{ id: "health", label: "Health", description: "Verify secret key" }],
  },
  {
    id: "supabase",
    label: "Supabase",
    description: "Database & auth",
    category: "data",
    replaces: "Supabase dashboard",
    actions: [{ id: "health", label: "Health", description: "Verify project URL" }],
  },
  {
    id: "firebase",
    label: "Firebase",
    description: "Auth, Firestore, FCM",
    category: "data",
    replaces: "Firebase console",
    actions: [{ id: "health", label: "Health", description: "Verify project" }],
  },
  {
    id: "agora",
    label: "Agora",
    description: "Alternative RTC",
    category: "live",
    replaces: "Agora console",
    actions: [{ id: "health", label: "Health", description: "Verify app credentials" }],
  },
];

export type ProviderHealth = {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  ok: boolean;
  detail: string;
  replaces: string;
  category: string;
  actions: ProviderActionDef[];
};

export type ProviderRunInput = {
  providerId: string;
  actionId: string;
  prompt?: string;
  params?: Record<string, unknown>;
  files?: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
  context?: {
    projectId?: string | null;
    changeSetId?: string | null;
    pickLabel?: string | null;
    targetResourceId?: string | null;
    targetResourceType?: string | null;
    screenName?: string;
  };
  actorId: string;
};

export type ProviderRunResult = {
  providerId: string;
  actionId: string;
  status: "ready" | "partial" | "failed" | "pending";
  reply: string;
  jobId?: string;
  changeSetId?: string | null;
  externalTaskId?: string;
  outputs?: Array<{ url?: string; fileName?: string; previewUrl?: string; designJobId?: string }>;
  data?: Record<string, unknown>;
};

function enabled(): boolean {
  return isDevWorkspaceEnabled();
}

async function providerHealthCheck(providerId: string): Promise<{ ok: boolean; detail: string }> {
  switch (providerId) {
    case "runway":
      return runway.runwayHealth();
    case "meshy":
      return meshy.meshyHealth();
    case "figma":
      return figma.figmaHealth();
    case "tencent":
      return platform.tencentRtcHealth();
    case "livekit":
      return platform.livekitHealth();
    case "vercel":
      return platform.vercelHealth();
    case "stripe":
      return platform.stripeHealth();
    case "gemini":
      return platform.geminiHealth();
    case "openai":
      return platform.openaiHealth();
    case "cloudflare":
      return platform.cloudflareHealth();
    case "railway":
      return platform.railwayHealth();
    case "agora":
      return platform.agoraHealth();
    case "supabase":
      return platform.supabaseHealth();
    case "firebase":
      return platform.firebaseHealth();
    default:
      return { ok: false, detail: "unknown provider" };
  }
}

export async function listProviderHealth(): Promise<ProviderHealth[]> {
  if (!enabled()) return [];
  const results: ProviderHealth[] = [];
  for (const def of PROVIDER_REGISTRY) {
    const configured = isProviderConfigured(def.id);
    const health = configured
      ? await providerHealthCheck(def.id)
      : { ok: false, detail: providerSetupHint(def.id) };
    results.push({
      id: def.id,
      label: def.label,
      configured,
      enabled: isProviderEnabled(def.id),
      ok: configured && health.ok,
      detail: configured ? health.detail : providerSetupHint(def.id),
      replaces: def.replaces,
      category: def.category,
      actions: def.actions,
    });
  }
  return results;
}

function findAction(providerId: string, actionId: string): ProviderActionDef | null {
  return PROVIDER_REGISTRY.find((p) => p.id === providerId)?.actions.find((a) => a.id === actionId) || null;
}

function imageDataUrlFromFile(file: { mimeType: string; dataBase64: string }): string {
  return `data:${file.mimeType};base64,${file.dataBase64}`;
}

async function implementGeneratedAssets(
  input: ProviderRunInput,
  assets: Array<{ fileName: string; mimeType: string; dataBase64: string; screenName?: string }>,
): Promise<{ changeSetId: string | null; outputs: ProviderRunResult["outputs"] }> {
  const batch = await implementUniversalBatch(
    assets.map((a) => ({
      fileName: a.fileName,
      mimeType: a.mimeType,
      dataBase64: a.dataBase64,
      screenName: a.screenName,
      pickLabel: input.context?.pickLabel,
      targetResourceId: input.context?.targetResourceId,
      targetResourceType: input.context?.targetResourceType,
      projectId: input.context?.projectId,
      changeSetId: input.context?.changeSetId,
      actorId: input.actorId,
    })),
  );
  return {
    changeSetId: batch.changeSetId,
    outputs: batch.items.map((item) => ({
      fileName: item.fileName,
      previewUrl: item.previewUrl,
      designJobId: item.designJobId || undefined,
    })),
  };
}

function kickoffAsyncJob(jobId: string, runner: () => Promise<void>): void {
  void runner().catch((e) => {
    patchProviderJob(jobId, { status: "failed", error: String(e), progress: "failed" });
  });
}

async function pollRunwayJob(jobId: string, taskId: string, input: ProviderRunInput): Promise<void> {
  patchProviderJob(jobId, { status: "running", externalTaskId: taskId, progress: "Generating video…" });
  try {
    const result = await runway.runwayTaskToAsset(taskId);
    patchProviderJob(jobId, { progress: "Implementing gift pack…" });
    const implemented = await implementGeneratedAssets(input, [
      { fileName: result.asset.fileName, mimeType: result.asset.mimeType, dataBase64: result.asset.dataBase64 },
    ]);
    patchProviderJob(jobId, {
      status: "ready",
      progress: "done",
      changeSetId: implemented.changeSetId,
      result: { videoUrl: result.videoUrl, outputs: implemented.outputs },
    });
  } catch (e) {
    const err = e as Error & { code?: string; status?: number };
    if (err.code === "provider.runway.pending" || err.status === 202) {
      patchProviderJob(jobId, { progress: "Still generating… poll again" });
      return;
    }
    throw e;
  }
}

async function pollMeshyJobUntilDone(jobId: string, previewTaskId: string, input: ProviderRunInput): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const preview = await meshy.meshyGetTask("text-to-3d", previewTaskId);
    patchProviderJob(jobId, {
      status: "running",
      externalTaskId: previewTaskId,
      progress: `Meshy preview ${preview.status}${preview.progress != null ? ` ${preview.progress}%` : ""}`,
    });
    if (preview.status === "FAILED") {
      throw new Error(preview.task_error?.message || "meshy_preview_failed");
    }
    if (preview.status !== "SUCCEEDED") {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    patchProviderJob(jobId, { progress: "Refining textures…" });
    const refined = await meshy.meshyRefinePreview({ previewTaskId });
    const implemented = await implementGeneratedAssets(input, [
      {
        fileName: refined.asset.fileName,
        mimeType: refined.asset.mimeType,
        dataBase64: refined.asset.dataBase64,
      },
    ]);
    patchProviderJob(jobId, {
      status: "ready",
      progress: "done",
      changeSetId: implemented.changeSetId,
      result: { modelUrl: refined.modelUrl, outputs: implemented.outputs },
    });
    return;
  }
  patchProviderJob(jobId, { status: "failed", error: "meshy_timeout", progress: "timeout" });
}

async function agentFallbackForProvider(input: ProviderRunInput): Promise<ProviderRunResult> {
  return runLocalProviderAction(input);
}

export async function runProviderAction(input: ProviderRunInput): Promise<ProviderRunResult> {
  if (!enabled()) {
    throw Object.assign(new Error("providers local only"), { status: 404, code: "error.notFound" });
  }

  const action = findAction(input.providerId, input.actionId);
  if (!action) {
    throw Object.assign(new Error("unknown provider action"), { status: 400, code: "provider.unknownAction" });
  }

  if (!isProviderConfigured(input.providerId)) {
    if (input.actionId === "health") {
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "partial",
        reply: providerSetupHint(input.providerId),
        data: { ok: false, detail: providerSetupHint(input.providerId) },
      };
    }
    if (input.files?.length) {
      const batch = await implementUniversalBatch(
        input.files.map((f) => ({
          ...f,
          targetResourceId: input.context?.targetResourceId,
          targetResourceType: input.context?.targetResourceType,
          pickLabel: input.context?.pickLabel,
          projectId: input.context?.projectId,
          changeSetId: input.context?.changeSetId,
          actorId: input.actorId,
        })),
      );
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: batch.confidence === "verified" ? "ready" : "partial",
        reply: `Implemented via universal pipeline (${providerSetupHint(input.providerId)})`,
        changeSetId: batch.changeSetId,
      };
    }
    return agentFallbackForProvider(input);
  }

  const prompt = String(input.prompt || input.params?.prompt || "").trim();

  switch (`${input.providerId}:${input.actionId}`) {
    case "runway:text-to-video": {
      if (!prompt) throw Object.assign(new Error("prompt required"), { status: 400, code: "provider.promptRequired" });
      const taskId = await runway.runwayStartTextToVideo({
        prompt,
        duration: Number(input.params?.duration || 5),
        ratio: String(input.params?.ratio || "1280:720"),
        model: String(input.params?.model || "gen4_turbo"),
      });
      const job = createProviderJob({ providerId: "runway", actionId: "text-to-video", externalTaskId: taskId });
      kickoffAsyncJob(job.id, () => pollRunwayJobUntilDone(job.id, taskId, input));
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "pending",
        reply: `Runway generating video (task ${taskId.slice(0, 8)}…)`,
        jobId: job.id,
        externalTaskId: taskId,
      };
    }

    case "runway:image-to-video": {
      if (!prompt) throw Object.assign(new Error("prompt required"), { status: 400, code: "provider.promptRequired" });
      const file = input.files?.[0];
      if (!file) throw Object.assign(new Error("image file required"), { status: 400, code: "provider.fileRequired" });
      const imageUrl = imageDataUrlFromFile(file);
      const result = await runway.runwayImageToVideo({
        prompt,
        imageUrl,
        duration: Number(input.params?.duration || 5),
      });
      const implemented = await implementGeneratedAssets(input, [
        { fileName: result.asset.fileName, mimeType: result.asset.mimeType, dataBase64: result.asset.dataBase64 },
      ]);
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "ready",
        reply: `Runway video ready — staged in change set`,
        changeSetId: implemented.changeSetId,
        externalTaskId: result.taskId,
        outputs: [{ url: result.videoUrl, ...implemented.outputs?.[0] }],
      };
    }

    case "runway:poll-task": {
      const taskId = String(input.params?.taskId || input.params?.externalTaskId || "");
      if (!taskId) throw Object.assign(new Error("taskId required"), { status: 400, code: "provider.taskRequired" });
      const task = await runway.runwayGetTask(taskId);
      if (task.status !== "SUCCEEDED") {
        return {
          providerId: input.providerId,
          actionId: input.actionId,
          status: "pending",
          reply: `Runway task ${task.status}`,
          externalTaskId: taskId,
          data: task as unknown as Record<string, unknown>,
        };
      }
      const asset = await runway.runwayTaskToAsset(taskId);
      const implemented = await implementGeneratedAssets(input, [
        { fileName: asset.asset.fileName, mimeType: asset.asset.mimeType, dataBase64: asset.asset.dataBase64 },
      ]);
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "ready",
        reply: "Runway video implemented",
        changeSetId: implemented.changeSetId,
        outputs: [{ url: asset.videoUrl, ...implemented.outputs?.[0] }],
      };
    }

    case "meshy:text-to-3d": {
      if (!prompt) throw Object.assign(new Error("prompt required"), { status: 400, code: "provider.promptRequired" });
      const previewTaskId = await meshy.meshyStartTextTo3dPreview(prompt);
      const job = createProviderJob({ providerId: "meshy", actionId: "text-to-3d", externalTaskId: previewTaskId });
      kickoffAsyncJob(job.id, () => pollMeshyJobUntilDone(job.id, previewTaskId, input));
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "pending",
        reply: `Meshy building 3D model (preview ${previewTaskId.slice(0, 8)}…)`,
        jobId: job.id,
        externalTaskId: previewTaskId,
      };
    }

    case "meshy:image-to-3d": {
      const file = input.files?.[0];
      const imageUrl = file
        ? imageDataUrlFromFile(file)
        : String(input.params?.imageUrl || "");
      if (!imageUrl) throw Object.assign(new Error("image required"), { status: 400, code: "provider.fileRequired" });
      const result = await meshy.meshyImageTo3d({ imageUrl });
      const implemented = await implementGeneratedAssets(input, [
        { fileName: result.asset.fileName, mimeType: result.asset.mimeType, dataBase64: result.asset.dataBase64 },
      ]);
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "ready",
        reply: "Meshy 3D model staged",
        changeSetId: implemented.changeSetId,
        externalTaskId: result.taskId,
        outputs: [{ url: result.modelUrl, ...implemented.outputs?.[0] }],
      };
    }

    case "figma:export-frames": {
      const frames = await figma.figmaExportFrames({ maxFrames: Number(input.params?.maxFrames || 4) });
      const designJobs: ProviderRunResult["outputs"] = [];
      let changeSetId: string | null = input.context?.changeSetId || null;
      for (const frame of frames) {
        const job = await importDesignAgent({
          fileName: frame.asset.fileName,
          mimeType: frame.asset.mimeType,
          dataBase64: frame.asset.dataBase64,
          screenName: frame.name,
          targetResourceId: input.context?.targetResourceId,
          actorId: input.actorId,
        });
        changeSetId = job.changeSetId || changeSetId;
        designJobs.push({ fileName: frame.asset.fileName, previewUrl: job.designPreviewUrl, designJobId: job.id });
      }
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "ready",
        reply: `Figma → ${frames.length} screen(s) built via Design Agent`,
        changeSetId,
        outputs: designJobs,
        data: { frames: frames.map((f) => ({ id: f.nodeId, name: f.name })) },
      };
    }

    case "figma:file-info": {
      const file = await figma.figmaGetFile(String(input.params?.fileKey || ""));
      const frames = collectFrameNames(file.document).slice(0, 40);
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "ready",
        reply: `${file.name} — ${frames.length} frames`,
        data: { name: file.name, lastModified: file.lastModified, frames },
      };
    }

    case "tencent:usersig": {
      const userId = String(input.params?.userId || prompt || "studio-user");
      const sig = platform.tencentRtcUserSig(userId);
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "ready",
        reply: `UserSig for ${sig.userId}`,
        data: sig as unknown as Record<string, unknown>,
      };
    }

    case "tencent:health":
    case "livekit:health":
    case "vercel:health":
    case "stripe:health":
    case "gemini:health":
    case "openai:health":
    case "cloudflare:health":
    case "railway:health":
    case "agora:health":
    case "supabase:health":
    case "firebase:health": {
      const health = await providerHealthCheck(input.providerId);
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: health.ok ? "ready" : "failed",
        reply: health.detail,
        data: health,
      };
    }

    case "livekit:token": {
      const room = String(input.params?.room || prompt || "studio-room");
      const identity = String(input.params?.identity || input.actorId);
      const token = await platform.livekitCreateToken({
        room,
        identity,
        role: (input.params?.role as "host" | "viewer") || "host",
      });
      return {
        providerId: input.providerId,
        actionId: input.actionId,
        status: "ready",
        reply: `LiveKit token for ${room}`,
        data: token as unknown as Record<string, unknown>,
      };
    }

    default:
      throw Object.assign(new Error("action not implemented"), { status: 501, code: "provider.notImplemented" });
  }
}

function collectFrameNames(node: { id: string; name: string; type: string; children?: unknown[] }, depth = 0): Array<{ id: string; name: string; type: string }> {
  const out: Array<{ id: string; name: string; type: string }> = [];
  if (depth > 6) return out;
  if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "SECTION") {
    out.push({ id: node.id, name: node.name, type: node.type });
  }
  for (const child of (node.children || []) as Array<{ id: string; name: string; type: string; children?: unknown[] }>) {
    out.push(...collectFrameNames(child, depth + 1));
  }
  return out;
}

async function pollRunwayJobUntilDone(jobId: string, taskId: string, input: ProviderRunInput): Promise<void> {
  for (let i = 0; i < 48; i++) {
    const task = await runway.runwayGetTask(taskId);
    patchProviderJob(jobId, { progress: `Runway ${task.status}${i ? ` (${i * 5}s)` : ""}` });
    if (task.status === "SUCCEEDED") {
      await pollRunwayJob(jobId, taskId, input);
      return;
    }
    if (task.status === "FAILED" || task.status === "CANCELLED") {
      throw new Error(task.failure || task.failureCode || "runway_failed");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  patchProviderJob(jobId, { status: "failed", error: "runway_timeout", progress: "timeout" });
}

export function getProviderJob(id: string): ProviderJob | null {
  return readProviderJob(id);
}

export function canRunNativeProvider(
  capabilityId: string,
  input: { message?: string; files?: unknown[] },
): boolean {
  const native = resolveProviderActionForOmni(capabilityId);
  if (!native) return false;
  const action = findAction(native.providerId, native.actionId);
  if (!action) return false;
  if (action.requiresPrompt && !String(input.message || "").trim()) return false;
  if (action.requiresFile && !input.files?.length) return false;
  return true;
}

export function resolveProviderActionForOmni(capabilityId: string): { providerId: string; actionId: string } | null {
  for (const provider of PROVIDER_REGISTRY) {
    for (const action of provider.actions) {
      if (action.omniCapabilityIds?.includes(capabilityId)) {
        if (isProviderConfigured(provider.id)) {
          return { providerId: provider.id, actionId: action.id };
        }
      }
    }
  }
  return null;
}

export function providerPresets(): typeof THIRD_PARTY_PRESETS {
  return THIRD_PARTY_PRESETS;
}

// re-export type for routes
import type { ProviderJob } from "./providerJobStore";
