import { getProviderSecret } from "../providerSecretsService";
import { fetchRemoteAsBase64, providerFetchJson, sleep } from "../providerHttp";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

type RunwayTask = {
  id: string;
  status: string;
  output?: Array<{ url?: string }>;
  failure?: string;
  failureCode?: string;
};

function runwayHeaders(): Record<string, string> {
  const apiKey = getProviderSecret("runway", "apiKey");
  if (!apiKey) throw Object.assign(new Error("runway_not_configured"), { status: 503, code: "provider.runway.missing" });
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Runway-Version": RUNWAY_VERSION,
  };
}

async function createRunwayTask(endpoint: string, body: Record<string, unknown>): Promise<string> {
  const res = await providerFetchJson<{ id: string }>(`${RUNWAY_BASE}${endpoint}`, {
    method: "POST",
    headers: runwayHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.id) throw new Error("runway_task_missing_id");
  return res.id;
}

export async function pollRunwayTask(
  taskId: string,
  opts?: { maxAttempts?: number; intervalMs?: number },
): Promise<RunwayTask> {
  const maxAttempts = opts?.maxAttempts ?? 36;
  const intervalMs = opts?.intervalMs ?? 5000;
  for (let i = 0; i < maxAttempts; i++) {
    const task = await providerFetchJson<RunwayTask>(`${RUNWAY_BASE}/tasks/${encodeURIComponent(taskId)}`, {
      headers: runwayHeaders(),
    });
    if (task.status === "SUCCEEDED" || task.status === "FAILED" || task.status === "CANCELLED") {
      return task;
    }
    await sleep(intervalMs);
  }
  throw Object.assign(new Error("runway_task_timeout"), { status: 504, code: "provider.runway.timeout" });
}

export async function runwayTextToVideo(input: {
  prompt: string;
  duration?: number;
  ratio?: string;
  model?: string;
}): Promise<{ taskId: string; videoUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }> {
  const taskId = await createRunwayTask("/text_to_video", {
    model: input.model || "gen4_turbo",
    promptText: input.prompt.slice(0, 1000),
    duration: input.duration || 5,
    ratio: input.ratio || "1280:720",
  });
  const task = await pollRunwayTask(taskId);
  if (task.status !== "SUCCEEDED") {
    throw new Error(task.failure || task.failureCode || "runway_generation_failed");
  }
  const videoUrl = task.output?.[0]?.url;
  if (!videoUrl) throw new Error("runway_no_output_url");
  const asset = await fetchRemoteAsBase64(videoUrl);
  asset.fileName = `runway-${taskId.slice(0, 8)}.mp4`;
  return { taskId, videoUrl, asset };
}

export async function runwayImageToVideo(input: {
  prompt: string;
  imageUrl: string;
  duration?: number;
  ratio?: string;
  model?: string;
}): Promise<{ taskId: string; videoUrl: string; asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>> }> {
  const taskId = await createRunwayTask("/image_to_video", {
    model: input.model || "gen4_turbo",
    promptText: input.prompt.slice(0, 1000),
    promptImage: input.imageUrl,
    duration: input.duration || 5,
    ratio: input.ratio || "1280:720",
  });
  const task = await pollRunwayTask(taskId);
  if (task.status !== "SUCCEEDED") {
    throw new Error(task.failure || task.failureCode || "runway_generation_failed");
  }
  const videoUrl = task.output?.[0]?.url;
  if (!videoUrl) throw new Error("runway_no_output_url");
  const asset = await fetchRemoteAsBase64(videoUrl);
  asset.fileName = `runway-${taskId.slice(0, 8)}.mp4`;
  return { taskId, videoUrl, asset };
}

export async function runwayHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    runwayHeaders();
    return { ok: true, detail: "API key configured" };
  } catch {
    return { ok: false, detail: "Set RUNWAY_API_KEY in env" };
  }
}

export async function runwayGetTask(taskId: string): Promise<RunwayTask> {
  return providerFetchJson<RunwayTask>(`${RUNWAY_BASE}/tasks/${encodeURIComponent(taskId)}`, {
    headers: runwayHeaders(),
  });
}

export function runwayStartTextToVideo(input: {
  prompt: string;
  duration?: number;
  ratio?: string;
  model?: string;
}): Promise<string> {
  return createRunwayTask("/text_to_video", {
    model: input.model || "gen4_turbo",
    promptText: input.prompt.slice(0, 1000),
    duration: input.duration || 5,
    ratio: input.ratio || "1280:720",
  });
}

export async function runwayTaskToAsset(taskId: string): Promise<{
  taskId: string;
  videoUrl: string;
  asset: Awaited<ReturnType<typeof fetchRemoteAsBase64>>;
}> {
  const task = await pollRunwayTask(taskId, { maxAttempts: 1, intervalMs: 0 }).catch(async () => {
    return providerFetchJson<RunwayTask>(`${RUNWAY_BASE}/tasks/${encodeURIComponent(taskId)}`, {
      headers: runwayHeaders(),
    });
  });
  if (task.status !== "SUCCEEDED") {
    throw Object.assign(new Error(task.status), { status: 202, code: "provider.runway.pending", task });
  }
  const videoUrl = task.output?.[0]?.url;
  if (!videoUrl) throw new Error("runway_no_output_url");
  const asset = await fetchRemoteAsBase64(videoUrl);
  asset.fileName = `runway-${taskId.slice(0, 8)}.mp4`;
  return { taskId, videoUrl, asset };
}
