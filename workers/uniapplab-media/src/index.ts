/**
 * Cloudflare Worker — product media on R2 (images/videos).
 * Architecture: R2 + Cloudflare CDN; Supabase stores URLs only.
 */
export interface Env {
  MEDIA: R2Bucket;
  PUBLIC_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  UPLOAD_SIGNING_SECRET: string;
}

const FOLDERS = new Set([
  "avatars",
  "posts",
  "chat",
  "gifts",
  "karaoke",
  "covers",
  "misc",
]);

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_BASE64_BYTES = 8 * 1024 * 1024;

function corsHeaders(req: Request, env: Env): HeadersInit {
  const origin = req.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allow =
    origin && allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS,HEAD",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(req, env),
    },
  });
}

function publicBase(env: Env, url: URL): string {
  const configured = String(env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  return url.origin;
}

function sanitizeFileName(name: string): string {
  const base = String(name || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 180) || "file.bin";
}

function buildKey(userId: string, folder: string, fileName: string, prefix?: string): string {
  const safeUser = String(userId || "anon").replace(/[^a-zA-Z0-9_-]/g, "_");
  const p = prefix ? `${sanitizeFileName(prefix)}/` : "";
  return `${folder}/${safeUser}/${p}${Date.now()}_${sanitizeFileName(fileName)}`;
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyUploadSig(
  env: Env,
  key: string,
  exp: string,
  sig: string,
): Promise<boolean> {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  const expected = await hmacSign(env.UPLOAD_SIGNING_SECRET, `${key}:${exp}`);
  return expected === sig;
}

async function requireUser(req: Request, env: Env): Promise<{ id: string } | Response> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return json(req, env, { error: "unauthorized" }, 401);
  }
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = String(env.SUPABASE_ANON_KEY || "");
  if (!supabaseUrl || !anon) {
    return json(req, env, { error: "auth not configured on media worker" }, 503);
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: auth,
      apikey: anon,
    },
  });
  if (!res.ok) {
    return json(req, env, { error: "unauthorized" }, 401);
  }
  const user = (await res.json()) as { id?: string };
  if (!user?.id) return json(req, env, { error: "unauthorized" }, 401);
  return { id: user.id };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    }

    if (req.method === "GET" && (path === "/" || path === "/health" || path === "/media/health")) {
      try {
        // Touch bucket listing to confirm binding.
        await env.MEDIA.list({ limit: 1 });
        return json(req, env, {
          status: "ok",
          r2Configured: true,
          reachable: true,
          provider: "cloudflare_r2",
          publicBaseUrl: publicBase(env, url),
        });
      } catch (err) {
        return json(
          req,
          env,
          {
            status: "degraded",
            r2Configured: true,
            reachable: false,
            error: err instanceof Error ? err.message : String(err),
          },
          200,
        );
      }
    }

    // Public object: /object/<key> or /media/object/<key>
    if (req.method === "GET" && (path.startsWith("/object/") || path.startsWith("/media/object/"))) {
      const key = path
        .replace(/^\/media\/object\//, "")
        .replace(/^\/object\//, "")
        .replace(/\.\./g, "");
      if (!key) return json(req, env, { error: "invalid object key" }, 400);
      const obj = await env.MEDIA.get(key);
      if (!obj) return json(req, env, { error: "not found" }, 404);
      const headers = new Headers(corsHeaders(req, env));
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      return new Response(obj.body, { headers });
    }

    if (req.method === "POST" && (path === "/presign" || path === "/media/presign")) {
      const userOrErr = await requireUser(req, env);
      if (userOrErr instanceof Response) return userOrErr;
      const body = (await req.json().catch(() => ({}))) as {
        folder?: string;
        fileName?: string;
        contentType?: string;
        size?: number;
        prefix?: string;
      };
      const folder = String(body.folder || "misc").toLowerCase();
      if (!FOLDERS.has(folder)) {
        return json(req, env, { error: `invalid media folder: ${folder}` }, 400);
      }
      const size = Number(body.size);
      if (Number.isFinite(size) && size > MAX_UPLOAD_BYTES) {
        return json(req, env, { error: `file too large (max ${MAX_UPLOAD_BYTES} bytes)` }, 400);
      }
      const key = buildKey(userOrErr.id, folder, String(body.fileName || "file.bin"), body.prefix);
      const expiresAt = Date.now() + 15 * 60 * 1000;
      const sig = await hmacSign(env.UPLOAD_SIGNING_SECRET, `${key}:${expiresAt}`);
      const uploadUrl = `${url.origin}/upload/${encodeURIComponent(key)}?exp=${expiresAt}&sig=${sig}`;
      const publicUrl = `${publicBase(env, url)}/${key}`;
      return json(req, env, {
        key,
        uploadUrl,
        publicUrl,
        expiresIn: 900,
        cacheControl: "public, max-age=31536000, immutable",
      });
    }

    if (req.method === "PUT" && (path.startsWith("/upload/") || path.startsWith("/media/upload/"))) {
      const rawKey = decodeURIComponent(
        path.replace(/^\/media\/upload\//, "").replace(/^\/upload\//, ""),
      );
      const exp = url.searchParams.get("exp") || "";
      const sig = url.searchParams.get("sig") || "";
      if (!(await verifyUploadSig(env, rawKey, exp, sig))) {
        return json(req, env, { error: "invalid or expired upload signature" }, 403);
      }
      const contentType = req.headers.get("content-type") || "application/octet-stream";
      const len = Number(req.headers.get("content-length") || 0);
      if (len > MAX_UPLOAD_BYTES) {
        return json(req, env, { error: "file too large" }, 400);
      }
      await env.MEDIA.put(rawKey, req.body, {
        httpMetadata: {
          contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return json(req, env, {
        ok: true,
        key: rawKey,
        publicUrl: `${publicBase(env, url)}/${rawKey}`,
      });
    }

    if (req.method === "POST" && (path === "/upload-base64" || path === "/media/upload-base64")) {
      const userOrErr = await requireUser(req, env);
      if (userOrErr instanceof Response) return userOrErr;
      const body = (await req.json().catch(() => ({}))) as {
        folder?: string;
        fileName?: string;
        contentType?: string;
        dataBase64?: string;
        prefix?: string;
      };
      const raw = String(body.dataBase64 || "");
      const b64 = raw.includes(",") ? raw.split(",").pop() || "" : raw;
      if (!b64) return json(req, env, { error: "dataBase64 required" }, 400);
      const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (!binary.byteLength || binary.byteLength > MAX_BASE64_BYTES) {
        return json(
          req,
          env,
          { error: `payload must be 1..${MAX_BASE64_BYTES} bytes — use /presign for larger files` },
          400,
        );
      }
      const folder = String(body.folder || "avatars").toLowerCase();
      if (!FOLDERS.has(folder)) {
        return json(req, env, { error: `invalid media folder: ${folder}` }, 400);
      }
      const key = buildKey(userOrErr.id, folder, String(body.fileName || "upload.bin"), body.prefix);
      const contentType = String(body.contentType || "application/octet-stream").slice(0, 200);
      await env.MEDIA.put(key, binary, {
        httpMetadata: {
          contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return json(req, env, {
        key,
        publicUrl: `${publicBase(env, url)}/${key}`,
      });
    }

    return json(req, env, { error: "not found" }, 404);
  },
};
