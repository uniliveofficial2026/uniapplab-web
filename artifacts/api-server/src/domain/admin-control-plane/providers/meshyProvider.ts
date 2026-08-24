import { getProviderSecret } from "../providerSecretsService";
import { fetchRemoteAsBase64, providerFetchJson, sleep } from "../providerHttp";

const MESHY_BASE = "https://api.meshy.ai/openapi";

type MeshyTask = {
  id: string;
  status: string;
  progress?: number;
  model_urls?: Record<string, string>;
  thumbnail_url?: string;
  task_error?: { message?: string };
};

function meshyHeaders(): Record<string, string> {
  const apiKey = getProviderSecret("meshy", "apiKey");
  if (!apiKey) throw Object.assign(new Error("meshy_not_configured"), { status: 503, code: "provider.meshy.missing" });
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function pollMeshyTask(path: string, taskId: string): Promise<MeshyTask> {
  for (let i = 0; i < 60; i++) {
    const task = await providerFetchJson<MeshyTask>(`${MESHY_BASE}${path}/${encodeURIComponent(taskId)}`, {
      headers: meshyHeaders(),
    });
    if (task.status === "SUCCEEDED" || task.status === "FAILED") return task;
    await sleep(5000);
  }
  throw Object.assign(new Error("meshy_task_timeout"), { status: 504, code: "provider.meshy.timeout" });
}

export async function meshyRefinePreview(input: {
  previewTaskId: string;
  enablePbr?: boolean;
}): Promise<{ refineTaskId: string; modelUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }> {
  const refineRes = await providerFetchJson<{ result: string }>(`${MESHY_BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: meshyHeaders(),
    body: JSON.stringify({
      mode: "refine",
      preview_task_id: input.previewTaskId,
      enable_pbr: input.enablePbr ?? true,
    }),
  });
  const refineTaskId = refineRes.result;
  const refined = await pollMeshyTask("/v2/text-to-3d", refineTaskId);
  if (refined.status !== "SUCCEEDED") {
    throw new Error(refined.task_error?.message || "meshy_refine_failed");
  }
  const modelUrl = refined.model_urls?.glb || refined.model_urls?.fbx || Object.values(refined.model_urls || {})[0];
  if (!modelUrl) throw new Error("meshy_no_model_url");
  const asset = await fetchRemoteAsBase64(modelUrl);
  asset.fileName = `meshy-${refineTaskId.slice(0, 8)}.glb`;
  return { refineTaskId, modelUrl, asset };
}

export async function meshyTextTo3d(input: {
  prompt: string;
  enablePbr?: boolean;
}): Promise<{ previewTaskId: string; refineTaskId: string; modelUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }> {
  const previewRes = await providerFetchJson<{ result: string }>(`${MESHY_BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: meshyHeaders(),
    body: JSON.stringify({
      mode: "preview",
      prompt: input.prompt.slice(0, 600),
      ai_model: "latest",
      should_remesh: true,
    }),
  });
  const previewTaskId = previewRes.result;
  const preview = await pollMeshyTask("/v2/text-to-3d", previewTaskId);
  if (preview.status !== "SUCCEEDED") {
    throw new Error(preview.task_error?.message || "meshy_preview_failed");
  }

  const refineRes = await providerFetchJson<{ result: string }>(`${MESHY_BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: meshyHeaders(),
    body: JSON.stringify({
      mode: "refine",
      preview_task_id: previewTaskId,
      enable_pbr: input.enablePbr ?? true,
    }),
  });
  const refineTaskId = refineRes.result;
  const refined = await pollMeshyTask("/v2/text-to-3d", refineTaskId);
  if (refined.status !== "SUCCEEDED") {
    throw new Error(refined.task_error?.message || "meshy_refine_failed");
  }

  const modelUrl = refined.model_urls?.glb || refined.model_urls?.fbx || Object.values(refined.model_urls || {})[0];
  if (!modelUrl) throw new Error("meshy_no_model_url");
  const asset = await fetchRemoteAsBase64(modelUrl);
  asset.fileName = `meshy-${refineTaskId.slice(0, 8)}.glb`;
  return { previewTaskId, refineTaskId, modelUrl, asset };
}

export async function meshyImageTo3d(input: {
  imageUrl: string;
}): Promise<{ taskId: string; modelUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }> {
  const createRes = await providerFetchJson<{ result: string }>(`${MESHY_BASE}/v1/image-to-3d`, {
    method: "POST",
    headers: meshyHeaders(),
    body: JSON.stringify({ image_url: input.imageUrl, enable_pbr: true }),
  });
  const taskId = createRes.result;
  const task = await pollMeshyTask("/v1/image-to-3d", taskId);
  if (task.status !== "SUCCEEDED") {
    throw new Error(task.task_error?.message || "meshy_image_to_3d_failed");
  }
  const modelUrl = task.model_urls?.glb || Object.values(task.model_urls || {})[0];
  if (!modelUrl) throw new Error("meshy_no_model_url");
  const asset = await fetchRemoteAsBase64(modelUrl);
  asset.fileName = `meshy-${taskId.slice(0, 8)}.glb`;
  return { taskId, modelUrl, asset };
}

export async function meshyHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    meshyHeaders();
    return { ok: true, detail: "API key configured" };
  } catch {
    return { ok: false, detail: "Set MESHY_API_KEY in env" };
  }
}

export async function meshyGetTask(kind: "text-to-3d" | "image-to-3d", taskId: string): Promise<MeshyTask> {
  const path = kind === "text-to-3d" ? "/v2/text-to-3d" : "/v1/image-to-3d";
  return providerFetchJson<MeshyTask>(`${MESHY_BASE}${path}/${encodeURIComponent(taskId)}`, {
    headers: meshyHeaders(),
  });
}

export async function meshyStartTextTo3dPreview(prompt: string): Promise<string> {
  const res = await providerFetchJson<{ result: string }>(`${MESHY_BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: meshyHeaders(),
    body: JSON.stringify({ mode: "preview", prompt: prompt.slice(0, 600), ai_model: "latest", should_remesh: true }),
  });
  return res.result;
}
