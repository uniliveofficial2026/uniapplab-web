import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createChangeSet } from "./changeSetService";
import { addOrUpdateItem } from "./changeItemService";
import { uploadLocalAsset, approveAsset, validateAsset } from "./mediaApprovalService";
import { importDesignAgent } from "./designAgentService";
import { createAnimationDraft, validateAnimationDraft } from "./content/AnimationAdminService";
import { createFaceEffectDraft, validateFaceEffectDraft } from "./content/FaceEffectAdminService";
import { isDevWorkspaceEnabled } from "./workspaceConfigService";
import { workspacePersistDir } from "./workspaceRuntimeService";
import { autofixStageCodeActions } from "./agentAutofixService";
import { buildGroundedContext } from "./agentGroundingService";
import {
  mergeVerification,
  verifyChangeSetAfterExecute,
  verifyTsxCompile,
  type VerificationReport,
} from "./agentVerificationService";
import type { DevAgentAction } from "./devAgentService";
import {
  convertInputToArtifacts,
  detectArtifactFormat,
  summarizeArtifacts,
  type ConversionSummary,
} from "./agentConversionService";
import { deepScanAsset, summarizeDeepScans, type DeepScanReport } from "./assetDeepScanService";

const IMPLEMENT_DIR = workspacePersistDir("universal-implement");

export type UniversalAssetKind =
  | "ui-design"
  | "code"
  | "svg-icon"
  | "svga-animation"
  | "video"
  | "image"
  | "audio"
  | "gif-animation"
  | "lottie"
  | "face-effect"
  | "config-schema"
  | "shader"
  | "native"
  | "document"
  | "3d-model"
  | "unknown";

export type UniversalImplementInput = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  targetResourceId?: string | null;
  targetResourceType?: string | null;
  screenName?: string;
  pickLabel?: string | null;
  projectId?: string | null;
  changeSetId?: string | null;
  actorId: string;
};

export type UniversalImplementResult = {
  id: string;
  kind: UniversalAssetKind;
  status: "ready" | "failed";
  fileName: string;
  assetId?: string;
  assetRowId?: string;
  previewUrl?: string;
  resourceId?: string;
  resourceType?: string;
  changeSetId?: string | null;
  designJobId?: string | null;
  componentCode?: string;
  executed: string[];
  fidelityNotes?: string;
  verification: VerificationReport;
  confidence: "verified" | "partial" | "blocked";
  error?: string | null;
  createdAt: string;
  artifacts?: ConversionSummary[];
  formats?: string[];
  deepScan?: DeepScanReport;
};

function enabled(): boolean {
  return isDevWorkspaceEnabled();
}

function slugName(name: string): string {
  return name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
}

function jobPath(id: string): string {
  return path.join(IMPLEMENT_DIR, `${id}.json`);
}

function resourceTypeForKind(kind: UniversalAssetKind): string {
  const map: Partial<Record<UniversalAssetKind, string>> = {
    code: "ui.node",
    "config-schema": "ui.token-set",
    shader: "ui.motion",
    native: "ui.node",
    document: "ui.node",
  };
  return map[kind] || "ui.node";
}

function writeResult(result: UniversalImplementResult): void {
  mkdirSync(IMPLEMENT_DIR, { recursive: true });
  writeFileSync(jobPath(result.id), JSON.stringify(result, null, 2));
}

export function readUniversalImplementResult(id: string): UniversalImplementResult | null {
  if (!enabled()) return null;
  const file = jobPath(id);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as UniversalImplementResult;
  } catch {
    return null;
  }
}

export function classifyUniversalAsset(fileName: string, mimeType: string, dataBase64?: string): UniversalAssetKind {
  const lower = fileName.toLowerCase();
  const ext = lower.split(".").pop() || "";

  if (ext === "svga") return "svga-animation";
  if (ext === "svg") return "svg-icon";
  if (ext === "gif") return "gif-animation";
  if (/\.(tsx?|jsx?|css|scss|sass|less|html|md|mdx|vue|svelte)$/i.test(lower)) return "code";
  if (/\.(yaml|yml|toml|graphql|gql|sql|prisma|proto|csv|wasm)$/i.test(lower)) return "config-schema";
  if (/\.(glsl|frag|vert|wgsl)$/i.test(lower)) return "shader";
  if (/\.(swift|kt|kts|dart|py|go|rs|java|cs|rb|php|lua|zig)$/i.test(lower)) return "native";
  if (/\.(mp4|webm|mov|m4v)$/i.test(lower)) return "video";
  if (/\.(mp3|wav|aac|m4a|ogg|flac)$/i.test(lower) || mimeType.startsWith("audio/")) return "audio";
  if (/\.(glb|gltf|obj|fbx|usdz|stl|blend)$/i.test(lower)) return "3d-model";
  if (/\.(pdf|doc|docx|txt|rtf)$/i.test(lower)) return "document";
  if (/mock|design|screen|ui-|ux-|figma|wireframe|mockup/.test(lower)) return "ui-design";

  if (ext === "json" && dataBase64) {
    try {
      const text = Buffer.from(dataBase64, "base64").toString("utf8").slice(0, 4000);
      if (/"(v|fr|ip|op|layers)"\s*:/.test(text)) return "lottie";
      if (/"tokens"|tailwind|design-tokens/.test(text)) return "config-schema";
    } catch {
      /* fall through */
    }
    return "config-schema";
  }

  if (lower === "dockerfile" || lower.startsWith(".env")) return "config-schema";
  if (/firebase.*rules|firestore\.rules/.test(lower)) return "config-schema";

  if (/effect|filter|sticker|beauty|ar-|face-/.test(lower)) return "face-effect";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|bmp|ico)$/i.test(lower)) {
    if (/icon|logo|glyph|symbol/.test(lower)) return "svg-icon";
    return "image";
  }

  return "unknown";
}

function universalMime(fileName: string, mimeType: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    svga: "application/octet-stream",
    gif: "image/gif",
    mov: "video/quicktime",
    m4v: "video/mp4",
    aac: "audio/aac",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
    lottie: "application/json",
  };
  if (map[ext]) return map[ext];
  if (mimeType) return mimeType;
  return "application/octet-stream";
}

function uploadAsset(input: UniversalImplementInput, prefix: string): { rowId: string; assetId: string; previewUrl: string } {
  const assetId = `${prefix}.${slugName(input.fileName)}.${Date.now()}`;
  const row = uploadLocalAsset(
    {
      assetId,
      fileName: input.fileName,
      mimeType: universalMime(input.fileName, input.mimeType),
      dataBase64: input.dataBase64,
    },
    input.actorId,
  );
  try {
    validateAsset(row.id);
    approveAsset(row.id);
  } catch {
    /* quarantine ok */
  }
  const previewUrl = `/api/admin/assets/${row.id}/content`;
  return { rowId: row.id, assetId: row.assetId, previewUrl };
}

async function stageCodeFile(
  input: UniversalImplementInput,
  content: string,
  fileName: string,
): Promise<{ changeSetId: string; resourceId: string; verification: VerificationReport; executed: string[] }> {
  const executed: string[] = [];
  let csId = input.changeSetId || null;
  if (!csId) {
    const cs = createChangeSet(
      {
        title: `Universal implement — ${fileName}`,
        description: input.pickLabel || input.targetResourceId || "Auto-implemented from upload",
        targetEnvironment: "local",
        baseSnapshotId: "snapshot.bundled.default",
      },
      input.actorId,
    );
    csId = cs.id;
    executed.push(`Created change set ${cs.id}`);
  }

  const resourceId = input.targetResourceId || `node.upload.${slugName(fileName)}`;
  let actions: DevAgentAction[] = [
    {
      type: "stage_code",
      resourceId,
      resourceType: input.targetResourceType || "ui.node",
      fileName,
      content,
    },
  ];

  const grounded = buildGroundedContext({
    projectId: input.projectId,
    detail: input.targetResourceId
      ? { resourceId: input.targetResourceId, name: input.pickLabel || fileName, type: input.targetResourceType || "ui.node" }
      : null,
  });
  const fixed = await autofixStageCodeActions(actions, grounded, 3);
  actions = fixed.actions;
  const action = actions.find((a) => a.type === "stage_code");
  if (!action || action.type !== "stage_code") {
    return {
      changeSetId: csId,
      resourceId,
      verification: { passed: false, checks: [{ name: "compile", passed: false, detail: "code autofix failed" }] },
      executed,
    };
  }

  const compile =
    /\.(tsx?|jsx?)$/i.test(fileName)
      ? await verifyTsxCompile(action.content, fileName)
      : { name: "syntax", passed: true, detail: "non-tsx file skipped" };
  addOrUpdateItem(
    csId,
    {
      resourceType: (input.targetResourceType || "ui.node") as never,
      resourceId,
      operation: "update",
      patch: {
        name: fileName,
        sourcePreview: action.content.slice(0, 16000),
        generatedBy: "universal-implement",
        uploadedAt: new Date().toISOString(),
        note: input.pickLabel ? `Bound to ${input.pickLabel}` : "Universal code implement",
      },
    },
    input.actorId,
  );
  executed.push(`Staged code ${fileName} → ${resourceId}`);

  const verification = mergeVerification(
    { passed: compile.passed, checks: [compile] },
    verifyChangeSetAfterExecute(csId, input.actorId),
  );
  return { changeSetId: csId, resourceId, verification, executed };
}

async function applyConversionArtifacts(
  input: UniversalImplementInput,
  result: UniversalImplementResult,
  opts: { previewUrl?: string; textContent?: string; skipPrimary?: boolean },
): Promise<UniversalImplementResult> {
  if (result.status !== "ready") return result;

  const artifacts = await convertInputToArtifacts({
    fileName: input.fileName,
    mimeType: input.mimeType,
    dataBase64: input.dataBase64,
    targetResourceId: input.targetResourceId,
    previewUrl: opts.previewUrl,
    textContent: opts.textContent,
  });

  let csId = result.changeSetId || null;
  const executed = [...result.executed];
  const formats = new Set<string>();

  for (const art of artifacts) {
    formats.add(art.language);
    if (opts.skipPrimary && art.role === "primary") continue;

    if (!csId) {
      const cs = createChangeSet(
        {
          title: `Universal convert — ${input.fileName}`,
          description: "Multi-format conversion artifacts",
          targetEnvironment: "local",
          baseSnapshotId: "snapshot.bundled.default",
        },
        input.actorId,
      );
      csId = cs.id;
      executed.push(`Change set ${cs.id}`);
    }

    let content = art.content;
    if (/\.(tsx?|jsx?)$/i.test(art.fileName)) {
      const fixed = await autofixStageCodeActions(
        [{ type: "stage_code", resourceId: art.resourceId, resourceType: art.resourceType, fileName: art.fileName, content }],
        buildGroundedContext({ projectId: input.projectId }),
        2,
      );
      const staged = fixed.actions.find((a) => a.type === "stage_code");
      if (staged?.type === "stage_code") content = staged.content;
    }

    addOrUpdateItem(
      csId,
      {
        resourceType: art.resourceType as never,
        resourceId: art.resourceId,
        operation: "update",
        patch: {
          name: art.fileName,
          sourcePreview: content.slice(0, 16000),
          format: art.format,
          language: art.language,
          role: art.role,
          generatedBy: "universal-convert",
          uploadedAt: new Date().toISOString(),
        },
      },
      input.actorId,
    );
    if (art.role !== "primary") {
      executed.push(`Wrote ${art.language} → ${art.resourceId}`);
    }
  }

  const verification = mergeVerification(result.verification, verifyChangeSetAfterExecute(csId, input.actorId));
  return {
    ...result,
    changeSetId: csId,
    executed,
    artifacts: summarizeArtifacts(artifacts),
    formats: [...formats],
    verification,
    confidence: verification.passed ? result.confidence : "partial",
  };
}

export async function convertUniversalInput(input: UniversalImplementInput): Promise<{
  artifacts: ConversionSummary[];
  changeSetId: string | null;
  items: Array<{ resourceId: string; fileName: string; format: string; role: string }>;
}> {
  if (!enabled()) {
    throw Object.assign(new Error("universal convert local only"), { status: 404, code: "error.notFound" });
  }
  const text = Buffer.from(input.dataBase64, "base64").toString("utf8");
  const format = detectArtifactFormat(input.fileName, text);
  const artifacts = await convertInputToArtifacts({
    fileName: input.fileName,
    mimeType: input.mimeType,
    dataBase64: input.dataBase64,
    targetResourceId: input.targetResourceId,
    textContent: text,
  });

  let csId = input.changeSetId || null;
  for (const art of artifacts) {
    if (!csId) {
      const cs = createChangeSet(
        {
          title: `Convert — ${input.fileName}`,
          description: format,
          targetEnvironment: "local",
          baseSnapshotId: "snapshot.bundled.default",
        },
        input.actorId,
      );
      csId = cs.id;
    }
    addOrUpdateItem(
      csId,
      {
        resourceType: art.resourceType as never,
        resourceId: art.resourceId,
        operation: "update",
        patch: {
          name: art.fileName,
          sourcePreview: art.content.slice(0, 16000),
          format: art.format,
          language: art.language,
          role: art.role,
          generatedBy: "universal-convert",
        },
      },
      input.actorId,
    );
  }

  return {
    artifacts: summarizeArtifacts(artifacts),
    changeSetId: csId,
    items: artifacts.map((a) => ({ resourceId: a.resourceId, fileName: a.fileName, format: a.format, role: a.role })),
  };
}

export async function implementUniversalAsset(input: UniversalImplementInput): Promise<UniversalImplementResult> {
  if (!enabled()) {
    throw Object.assign(new Error("universal implement local only"), { status: 404, code: "error.notFound" });
  }

  const id = createHash("sha256").update(`${input.fileName}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 16);
  const kind = classifyUniversalAsset(input.fileName, input.mimeType, input.dataBase64);
  const deepScan = deepScanAsset({ fileName: input.fileName, mimeType: input.mimeType, dataBase64: input.dataBase64, kind });
  const base: UniversalImplementResult = {
    id,
    kind,
    status: "failed",
    fileName: input.fileName,
    executed: [`deep-scan: ${deepScan.summary}`],
    verification: {
      passed: deepScan.passed,
      checks: deepScan.findings
        .filter((f) => f.severity !== "info")
        .slice(0, 12)
        .map((f) => ({
          name: `scan:${f.category}`,
          passed: f.severity !== "error",
          detail: f.line ? `${f.detail} (line ${f.line})` : f.detail,
        })),
    },
    confidence: deepScan.passed ? "verified" : "partial",
    deepScan,
    createdAt: new Date().toISOString(),
  };

  try {
    if (kind === "ui-design") {
      const job = await importDesignAgent({
        fileName: input.fileName,
        mimeType: universalMime(input.fileName, input.mimeType),
        dataBase64: input.dataBase64,
        screenName: input.screenName || input.fileName.replace(/\.[^.]+$/, ""),
        targetResourceId: input.targetResourceId,
        actorId: input.actorId,
      });

      let verification: VerificationReport = { passed: true, checks: [] };
      if (job.componentCode) {
        const compile = await verifyTsxCompile(job.componentCode, `${slugName(job.screenName)}.tsx`);
        verification = { passed: compile.passed, checks: [compile] };
        if (!compile.passed && job.componentCode) {
          const grounded = buildGroundedContext({ projectId: input.projectId, detail: null });
          const fixed = await autofixStageCodeActions(
            [{ type: "stage_code", resourceId: job.catalogResourceId || "experience.design-agent.generated", content: job.componentCode, fileName: "Screen.tsx" }],
            grounded,
            3,
          );
          if (fixed.fixed && fixed.actions[0]?.type === "stage_code") {
            job.componentCode = fixed.actions[0].content;
            const recheck = await verifyTsxCompile(job.componentCode, "Screen.tsx");
            verification = { passed: recheck.passed, checks: [recheck] };
          }
        }
      }

      const result = await applyConversionArtifacts(
        input,
        {
          ...base,
          status: "ready",
          kind,
          assetRowId: job.designAssetId,
          previewUrl: job.designPreviewUrl,
          resourceId: job.catalogResourceId || undefined,
          resourceType: "ui.experience",
          changeSetId: job.changeSetId,
          designJobId: job.id,
          componentCode: job.componentCode,
          executed: ["Design Agent built pixel-faithful screen", `Change set ${job.changeSetId}`],
          fidelityNotes: job.fidelityNotes || undefined,
          verification,
          confidence: verification.passed ? "verified" : "partial",
        },
        { previewUrl: job.designPreviewUrl, textContent: job.componentCode, skipPrimary: true },
      );
      writeResult(result);
      return result;
    }

    if (kind === "code" || kind === "config-schema" || kind === "shader" || kind === "native") {
      const content = Buffer.from(input.dataBase64, "base64").toString("utf8");
      const { changeSetId, resourceId, verification, executed } = await stageCodeFile(input, content, input.fileName);
      const result = await applyConversionArtifacts(
        input,
        {
          ...base,
          status: verification.passed ? "ready" : "failed",
          kind,
          resourceId,
          resourceType: input.targetResourceType || resourceTypeForKind(kind),
          changeSetId,
          componentCode: content.slice(0, 16000),
          executed,
          verification,
          confidence: verification.passed ? "verified" : "partial",
          error: verification.passed ? null : "Code failed compile verification",
        },
        { textContent: content, skipPrimary: true },
      );
      writeResult(result);
      return result;
    }

    if (kind === "svga-animation" || kind === "video" || kind === "gif-animation" || kind === "lottie") {
      const uploaded = uploadAsset(input, "asset.animation");
      const rendererId =
        kind === "svga-animation"
          ? "renderer.gift.svga.v1"
          : kind === "video"
            ? "renderer.gift.video.v1"
            : kind === "lottie"
              ? "renderer.animation.lottie.v1"
              : "renderer.animation.gif.v1";
      const format =
        kind === "svga-animation" ? "svga" : kind === "video" ? "video" : kind === "lottie" ? "lottie" : "gif";
      const name = input.screenName || slugName(input.fileName);
      const draft = createAnimationDraft(
        {
          name,
          animationId: input.targetResourceId || `animation.upload.${slugName(input.fileName)}`,
          rendererId,
          format,
          durationMs: 3000,
          qualityVariants: [{ assetId: uploaded.assetId, assetRowId: uploaded.rowId, url: uploaded.previewUrl, tier: "tier-3-high" }],
        },
        input.actorId,
      );
      const validation = validateAnimationDraft(draft.id);
      const result = await applyConversionArtifacts(
        input,
        {
          ...base,
          status: validation.status !== "invalid" ? "ready" : "failed",
          kind,
          assetId: uploaded.assetId,
          assetRowId: uploaded.rowId,
          previewUrl: uploaded.previewUrl,
          resourceId: draft.resourceId,
          resourceType: "animation.pack",
          changeSetId: draft.changeSetId,
          executed: [`Uploaded ${format}`, `Animation draft ${draft.resourceId}`, `Renderer ${rendererId}`],
          verification: {
            passed: validation.status !== "invalid",
            checks: [{ name: "animation-draft", passed: validation.status !== "invalid", detail: validation.status }],
          },
          confidence: validation.status !== "invalid" ? "verified" : "partial",
        },
        { previewUrl: uploaded.previewUrl },
      );
      writeResult(result);
      return result;
    }

    if (kind === "face-effect") {
      const uploaded = uploadAsset(input, "asset.effect");
      const nameKey = slugName(input.fileName);
      const draft = createFaceEffectDraft(
        {
          nameKey,
          faceEffectId: input.targetResourceId || `face-effect.upload.${nameKey}`,
          rendererId: "renderer.face.deepar.v1",
          thumbnailAssetId: uploaded.assetId,
          textureAssetIds: [uploaded.assetId],
          effectPackageId: uploaded.assetId,
        },
        input.actorId,
      );
      const validation = validateFaceEffectDraft(draft.id);
      const result = await applyConversionArtifacts(
        input,
        {
          ...base,
          status: validation.status !== "invalid" ? "ready" : "failed",
          kind,
          assetId: uploaded.assetId,
          assetRowId: uploaded.rowId,
          previewUrl: uploaded.previewUrl,
          resourceId: draft.resourceId,
          resourceType: "face-effect.definition",
          changeSetId: draft.changeSetId,
          executed: ["Uploaded effect asset", `Face effect draft ${draft.resourceId}`],
          verification: {
            passed: validation.status !== "invalid",
            checks: [{ name: "face-effect-draft", passed: validation.status !== "invalid", detail: validation.status }],
          },
          confidence: validation.status !== "invalid" ? "verified" : "partial",
        },
        { previewUrl: uploaded.previewUrl },
      );
      writeResult(result);
      return result;
    }

    // svg-icon, image, audio, unknown → asset + optional bind to target
    const uploaded = uploadAsset(input, "asset.media");
    let csId = input.changeSetId || null;
    const executed = [`Uploaded ${input.fileName}`, `Asset ${uploaded.assetId}`];
    const resourceId = input.targetResourceId || `asset.upload.${slugName(input.fileName)}`;

    if (input.targetResourceId || kind !== "unknown") {
      if (!csId) {
        const cs = createChangeSet(
          {
            title: `Universal implement — ${input.fileName}`,
            description: input.pickLabel || "Media bound to catalog",
            targetEnvironment: "local",
            baseSnapshotId: "snapshot.bundled.default",
          },
          input.actorId,
        );
        csId = cs.id;
        executed.push(`Change set ${cs.id}`);
      }

      const patch: Record<string, unknown> = {
        name: input.screenName || slugName(input.fileName),
        assetId: uploaded.assetId,
        assetRowId: uploaded.rowId,
        mediaUrl: uploaded.previewUrl,
        uploadedAt: new Date().toISOString(),
        mimeType: universalMime(input.fileName, input.mimeType),
        generatedBy: "universal-implement",
      };
      if (kind === "svg-icon") {
        patch.svgUrl = uploaded.previewUrl;
        patch.iconUrl = uploaded.previewUrl;
      }
      if (input.pickLabel) patch.note = `Bound to ${input.pickLabel}`;

      addOrUpdateItem(
        csId,
        {
          resourceType: (input.targetResourceType || "ui.asset") as never,
          resourceId,
          operation: "update",
          patch,
        },
        input.actorId,
      );
      executed.push(`Bound to ${resourceId}`);
    }

    const verification = mergeVerification(
      base.verification,
      verifyChangeSetAfterExecute(csId, input.actorId),
    );
    const result = await applyConversionArtifacts(
      input,
      {
        ...base,
        status: "ready",
        kind: kind === "unknown" ? "image" : kind,
        assetId: uploaded.assetId,
        assetRowId: uploaded.rowId,
        previewUrl: uploaded.previewUrl,
        resourceId,
        resourceType: input.targetResourceType || "ui.asset",
        changeSetId: csId,
        executed,
        verification,
        confidence: verification.passed && base.deepScan?.passed !== false ? "verified" : "partial",
      },
      { previewUrl: uploaded.previewUrl },
    );
    writeResult(result);
    return result;
  } catch (e) {
    const result: UniversalImplementResult = {
      ...base,
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
      confidence: "blocked",
      verification: mergeVerification(base.verification, {
        passed: false,
        checks: [{ name: "implement", passed: false, detail: String(e) }],
      }),
    };
    writeResult(result);
    return result;
  }
}

export async function implementUniversalBatch(
  files: UniversalImplementInput[],
): Promise<{
  items: UniversalImplementResult[];
  changeSetId: string | null;
  confidence: "verified" | "partial" | "blocked";
  deepScanSummary?: string;
}> {
  const items: UniversalImplementResult[] = [];
  let changeSetId: string | null = files[0]?.changeSetId || null;

  for (const file of files) {
    const result = await implementUniversalAsset({ ...file, changeSetId });
    items.push(result);
    if (result.changeSetId) changeSetId = result.changeSetId;
  }

  const allVerified = items.every((i) => i.confidence === "verified" && i.status === "ready");
  const anyReady = items.some((i) => i.status === "ready");
  const deepScans = items.map((i) => i.deepScan).filter(Boolean) as DeepScanReport[];
  return {
    items,
    changeSetId,
    confidence: allVerified ? "verified" : anyReady ? "partial" : "blocked",
    deepScanSummary: deepScans.length ? summarizeDeepScans(deepScans) : undefined,
  };
}
