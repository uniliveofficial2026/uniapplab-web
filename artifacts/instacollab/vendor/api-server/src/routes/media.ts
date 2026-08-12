/**
 * Media uploads → Cloudflare R2 via Worker (preferred) or legacy S3 client.
 * Clients store only the public CDN URL in Supabase.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  assertMediaFolder,
  buildObjectKey,
  configureBrowserUploadCors,
  createPresignedGetUrl,
  createPresignedPutUrl,
  isR2Configured,
  pingR2,
  publicUrlForKey,
  putObjectBuffer,
  sanitizeFileName,
} from "../lib/r2";

const router: IRouter = Router();

const MAX_PRESIGN_BYTES = 200 * 1024 * 1024;
const MAX_PROXY_BYTES = 8 * 1024 * 1024;

function mediaWorkerBase(): string {
  return String(process.env.MEDIA_WORKER_URL || "").trim().replace(/\/$/, "");
}

async function proxyToMediaWorker(
  req: Request,
  res: Response,
  next: NextFunction,
  workerPath: string,
): Promise<boolean> {
  const worker = mediaWorkerBase();
  if (!worker) return false;
  try {
    const url = `${worker}${workerPath.startsWith("/") ? workerPath : `/${workerPath}`}`;
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    const authHeader = req.header("authorization");
    if (authHeader) headers.authorization = authHeader;
    const ct = req.header("content-type");
    if (ct) headers["content-type"] = ct;

    const init: RequestInit = {
      method: req.method,
      headers,
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = JSON.stringify(req.body ?? {});
      headers["content-type"] = headers["content-type"] || "application/json";
    }

    const upstream = await fetch(url, init);
    const text = await upstream.text();
    res.status(upstream.status);
    const upstreamCt = upstream.headers.get("content-type");
    if (upstreamCt) res.setHeader("content-type", upstreamCt);
    res.send(text);
    return true;
  } catch (err) {
    next(err);
    return true;
  }
}

router.get("/media/health", async (req, res, next) => {
  if (await proxyToMediaWorker(req, res, next, "/health")) return;

  const configured = isR2Configured();
  if (!configured) {
    res.json({ status: "ok", r2Configured: false });
    return;
  }
  const ping = await pingR2();
  res.json({
    status: ping.ok ? "ok" : "degraded",
    r2Configured: true,
    reachable: ping.ok,
    error: ping.error,
    provider: "s3_compatible",
  });
});

router.get("/media/object/*splat", async (req, res, next) => {
  try {
    const splat = (req.params as { splat?: string | string[] }).splat;
    const key = (Array.isArray(splat) ? splat.join("/") : String(splat || ""))
      .replace(/^\/+/, "")
      .replace(/\.\./g, "");
    if (!key || key.length > 1024) {
      res.status(400).json({ error: "invalid object key" });
      return;
    }

    const publicBase = String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    if (publicBase.includes("r2.dev") || publicBase.includes("cloudflare")) {
      res.setHeader("Cache-Control", "public, max-age=300");
      res.redirect(302, `${publicBase}/${key}`);
      return;
    }

    const worker = mediaWorkerBase();
    if (worker) {
      res.setHeader("Cache-Control", "public, max-age=300");
      res.redirect(302, `${worker}/object/${key}`);
      return;
    }

    if (!isR2Configured()) {
      res.status(503).json({ error: "object storage not configured" });
      return;
    }
    const url = await createPresignedGetUrl({ key });
    res.setHeader("Cache-Control", "public, max-age=300");
    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
});

router.post("/media/presign", auth, requireNotBanned, async (req, res, next) => {
  if (await proxyToMediaWorker(req, res, next, "/presign")) return;

  try {
    if (!isR2Configured()) {
      res.status(503).json({
        error: "Object storage is not configured. Set R2_* / MEDIA_WORKER_URL.",
      });
      return;
    }

    const body = req.body as {
      folder?: string;
      fileName?: string;
      contentType?: string;
      size?: number;
      prefix?: string;
    };

    let folder;
    try {
      folder = assertMediaFolder(String(body.folder || "misc"));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "invalid folder" });
      return;
    }

    const fileName = sanitizeFileName(String(body.fileName || "file.bin"));
    const contentType = String(body.contentType || "application/octet-stream").slice(0, 200);
    const size = Number(body.size);
    if (Number.isFinite(size) && size > MAX_PRESIGN_BYTES) {
      res.status(400).json({ error: `file too large (max ${MAX_PRESIGN_BYTES} bytes)` });
      return;
    }

    const userId = req.authUser!.id;
    const key = buildObjectKey({
      userId,
      folder,
      fileName,
      prefix: body.prefix ? String(body.prefix) : undefined,
    });
    const expiresIn = 900;
    const uploadUrl = await createPresignedPutUrl({ key, contentType, expiresInSec: expiresIn });
    const publicUrl = publicUrlForKey(key);

    res.json({
      key,
      uploadUrl,
      publicUrl,
      expiresIn,
      cacheControl: "public, max-age=31536000, immutable",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/media/upload-base64", auth, requireNotBanned, async (req, res, next) => {
  if (await proxyToMediaWorker(req, res, next, "/upload-base64")) return;

  try {
    if (!isR2Configured()) {
      res.status(503).json({ error: "object storage not configured" });
      return;
    }

    const body = req.body as {
      folder?: string;
      fileName?: string;
      contentType?: string;
      dataBase64?: string;
      prefix?: string;
    };

    const raw = String(body.dataBase64 || "");
    const b64 = raw.includes(",") ? raw.split(",").pop() || "" : raw;
    if (!b64) {
      res.status(400).json({ error: "dataBase64 required" });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(b64, "base64");
    } catch {
      res.status(400).json({ error: "invalid base64" });
      return;
    }
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_PROXY_BYTES) {
      res.status(400).json({
        error: `payload must be 1..${MAX_PROXY_BYTES} bytes — use /api/media/presign for larger files`,
      });
      return;
    }

    let folder;
    try {
      folder = assertMediaFolder(String(body.folder || "avatars"));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "invalid folder" });
      return;
    }

    const contentType = String(body.contentType || "application/octet-stream").slice(0, 200);
    const fileName = sanitizeFileName(String(body.fileName || "upload.bin"));
    const key = buildObjectKey({
      userId: req.authUser!.id,
      folder,
      fileName,
      prefix: body.prefix ? String(body.prefix) : undefined,
    });
    const publicUrl = await putObjectBuffer({ key, body: buffer, contentType });
    res.json({ key, publicUrl });
  } catch (err) {
    next(err);
  }
});

router.post("/media/configure-cors", auth, requireAdmin, async (req, res, next) => {
  try {
    if (!isR2Configured()) {
      res.status(503).json({ error: "object storage not configured (S3 API lane)" });
      return;
    }
    const body = req.body as { origins?: string[] };
    const origins = Array.isArray(body.origins)
      ? body.origins.map(String)
      : [
          "https://app.uniapplab.com",
          "https://uniapplab.com",
          "http://localhost:5173",
          "http://localhost:3000",
        ];
    await configureBrowserUploadCors(origins);
    res.json({ ok: true, origins });
  } catch (err) {
    next(err);
  }
});

export default router;
