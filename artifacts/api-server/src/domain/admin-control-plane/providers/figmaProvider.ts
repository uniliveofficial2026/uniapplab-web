import { getProviderField, getProviderSecret } from "../providerSecretsService";
import { fetchRemoteAsBase64, providerFetchJson } from "../providerHttp";

type FigmaFile = {
  name: string;
  lastModified: string;
  document: FigmaNode;
};

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
};

type FigmaImages = {
  images: Record<string, string | null>;
};

function figmaHeaders(): Record<string, string> {
  const token = getProviderSecret("figma", "accessToken");
  if (!token) throw Object.assign(new Error("figma_not_configured"), { status: 503, code: "provider.figma.missing" });
  return { "X-Figma-Token": token };
}

function collectFrames(node: FigmaNode, depth = 0): FigmaNode[] {
  const out: FigmaNode[] = [];
  if (depth > 6) return out;
  if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "SECTION") {
    out.push(node);
  }
  for (const child of node.children || []) {
    out.push(...collectFrames(child, depth + 1));
  }
  return out;
}

export async function figmaGetFile(fileKey?: string): Promise<FigmaFile> {
  const key = fileKey || getProviderField("figma", "fileKey");
  if (!key) throw Object.assign(new Error("figma_file_key_required"), { status: 400, code: "provider.figma.noFileKey" });
  return providerFetchJson<FigmaFile>(`https://api.figma.com/v1/files/${encodeURIComponent(key)}`, {
    headers: figmaHeaders(),
    timeoutMs: 60_000,
  });
}

export async function figmaExportFrames(input?: {
  fileKey?: string;
  maxFrames?: number;
  scale?: number;
}): Promise<Array<{ nodeId: string; name: string; imageUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }>> {
  const fileKey = input?.fileKey || getProviderField("figma", "fileKey");
  if (!fileKey) throw Object.assign(new Error("figma_file_key_required"), { status: 400, code: "provider.figma.noFileKey" });

  const file = await figmaGetFile(fileKey);
  const frames = collectFrames(file.document).slice(0, input?.maxFrames || 6);
  if (!frames.length) throw new Error("figma_no_exportable_frames");

  const ids = frames.map((f) => f.id).join(",");
  const images = await providerFetchJson<FigmaImages>(
    `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(ids)}&format=png&scale=${input?.scale || 2}`,
    { headers: figmaHeaders(), timeoutMs: 120_000 },
  );

  const exported: Array<{ nodeId: string; name: string; imageUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }> = [];
  for (const frame of frames) {
    const imageUrl = images.images[frame.id];
    if (!imageUrl) continue;
    const asset = await fetchRemoteAsBase64(imageUrl);
    asset.fileName = `figma-${frame.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    exported.push({ nodeId: frame.id, name: frame.name, imageUrl, asset });
  }
  if (!exported.length) throw new Error("figma_export_failed");
  return exported;
}

export async function figmaHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    figmaHeaders();
    const fileKey = getProviderField("figma", "fileKey");
    if (!fileKey) return { ok: true, detail: "Token set — add fileKey in Config" };
    const file = await figmaGetFile(fileKey);
    return { ok: true, detail: `Connected to "${file.name}"` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "figma_error" };
  }
}

export async function figmaExportNode(input: {
  fileKey?: string;
  nodeId: string;
}): Promise<{ nodeId: string; imageUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }> {
  const fileKey = input.fileKey || getProviderField("figma", "fileKey");
  if (!fileKey) throw Object.assign(new Error("figma_file_key_required"), { status: 400, code: "provider.figma.noFileKey" });
  const images = await providerFetchJson<FigmaImages>(
    `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(input.nodeId)}&format=png&scale=2`,
    { headers: figmaHeaders(), timeoutMs: 120_000 },
  );
  const imageUrl = images.images[input.nodeId];
  if (!imageUrl) throw new Error("figma_node_export_failed");
  const asset = await fetchRemoteAsBase64(imageUrl);
  asset.fileName = `figma-node-${input.nodeId.replace(/:/g, "-")}.png`;
  return { nodeId: input.nodeId, imageUrl, asset };
}
