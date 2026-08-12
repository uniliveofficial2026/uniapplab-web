/**
 * S3-compatible object storage for product media.
 * Target: Cloudflare R2 + Cloudflare CDN.
 * Supabase only stores public URLs / metadata — never binary bytes.
 * Interim: any S3-compatible bucket (e.g. Railway) via the same R2_* env shape.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type MediaFolder =
  | "avatars"
  | "posts"
  | "chat"
  | "gifts"
  | "karaoke"
  | "covers"
  | "misc";

const ALLOWED_FOLDERS = new Set<MediaFolder>([
  "avatars",
  "posts",
  "chat",
  "gifts",
  "karaoke",
  "covers",
  "misc",
]);

let cachedClient: S3Client | null = null;

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

export function isR2Configured(): boolean {
  const hasEndpoint = Boolean(env("R2_ENDPOINT") || env("R2_ACCOUNT_ID"));
  return Boolean(
    hasEndpoint &&
      env("R2_ACCESS_KEY_ID") &&
      env("R2_SECRET_ACCESS_KEY") &&
      env("R2_BUCKET") &&
      (env("R2_PUBLIC_BASE_URL") || env("R2_PUBLIC_URL")),
  );
}

export function getR2PublicBaseUrl(): string {
  return (env("R2_PUBLIC_BASE_URL") || env("R2_PUBLIC_URL")).replace(/\/$/, "");
}

export function getR2Bucket(): string {
  return env("R2_BUCKET");
}

function resolveEndpoint(): string {
  const explicit = env("R2_ENDPOINT");
  if (explicit) return explicit.replace(/\/$/, "");
  const accountId = env("R2_ACCOUNT_ID");
  if (accountId) return `https://${accountId}.r2.cloudflarestorage.com`;
  throw new Error("R2_ENDPOINT or R2_ACCOUNT_ID required");
}

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const forcePathStyle = env("R2_FORCE_PATH_STYLE") === "true";
  cachedClient = new S3Client({
    region: env("R2_REGION") || "auto",
    endpoint: resolveEndpoint(),
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle,
  });
  return cachedClient;
}

export function assertMediaFolder(raw: string): MediaFolder {
  const folder = String(raw || "").trim().toLowerCase() as MediaFolder;
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new Error(`invalid media folder: ${raw}`);
  }
  return folder;
}

export function sanitizeFileName(name: string): string {
  const base = String(name || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 180) || "file.bin";
}

export function buildObjectKey(opts: {
  userId: string;
  folder: MediaFolder;
  fileName: string;
  prefix?: string;
}): string {
  const safeUser = String(opts.userId || "anon").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeName = sanitizeFileName(opts.fileName);
  const prefix = opts.prefix ? `${sanitizeFileName(opts.prefix)}/` : "";
  return `${opts.folder}/${safeUser}/${prefix}${Date.now()}_${safeName}`;
}

export function publicUrlForKey(key: string): string {
  return `${getR2PublicBaseUrl()}/${key.replace(/^\//, "")}`;
}

export async function createPresignedPutUrl(opts: {
  key: string;
  contentType: string;
  expiresInSec?: number;
}): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: opts.key,
    ContentType: opts.contentType || "application/octet-stream",
    CacheControl: "public, max-age=31536000, immutable",
  });
  return getSignedUrl(client, command, {
    expiresIn: Math.min(3600, Math.max(60, opts.expiresInSec ?? 900)),
  });
}

export async function createPresignedGetUrl(opts: {
  key: string;
  expiresInSec?: number;
}): Promise<string> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: opts.key,
  });
  // Railway allows up to 90 days; keep 7 days for avatar/CDN-ish URLs.
  return getSignedUrl(client, command, {
    expiresIn: Math.min(7 * 24 * 3600, Math.max(60, opts.expiresInSec ?? 7 * 24 * 3600)),
  });
}

export async function putObjectBuffer(opts: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrlForKey(opts.key);
}

export async function deleteObjectKey(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }),
  );
}

export async function configureBrowserUploadCors(origins: string[]): Promise<void> {
  const client = getR2Client();
  const allowed = origins.map((o) => o.replace(/\/$/, "")).filter(Boolean);
  if (!allowed.length) {
    allowed.push("https://app.uniapplab.com", "http://localhost:5173", "http://localhost:3000");
  }
  await client.send(
    new PutBucketCorsCommand({
      Bucket: getR2Bucket(),
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
            AllowedOrigins: allowed,
            ExposeHeaders: ["ETag", "Content-Type", "Content-Length"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
}

export async function pingR2(): Promise<{ ok: boolean; error?: string }> {
  if (!isR2Configured()) return { ok: false, error: "object storage not configured" };
  try {
    await getR2Client().send(new HeadBucketCommand({ Bucket: getR2Bucket() }));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
