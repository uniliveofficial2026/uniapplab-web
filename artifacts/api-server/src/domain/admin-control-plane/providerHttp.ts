export class ProviderHttpError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "ProviderHttpError";
    this.status = status;
    this.body = body;
  }
}

export async function providerFetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = init.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new ProviderHttpError(`${res.status} ${res.statusText}`, res.status, text.slice(0, 4000));
    }
    if (!text.trim()) return {} as T;
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRemoteAsBase64(
  url: string,
): Promise<{ dataBase64: string; mimeType: string; fileName: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download_failed_${res.status}`);
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  const ext =
    mimeType.includes("mp4") ? "mp4" :
    mimeType.includes("webm") ? "webm" :
    mimeType.includes("png") ? "png" :
    mimeType.includes("jpeg") ? "jpg" :
    mimeType.includes("gif") ? "gif" :
    mimeType.includes("glb") ? "glb" :
    mimeType.includes("gltf") ? "gltf" :
    "bin";
  return {
    dataBase64: buf.toString("base64"),
    mimeType,
    fileName: `provider-asset.${ext}`,
  };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
