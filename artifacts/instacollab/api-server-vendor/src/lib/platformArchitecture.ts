/**
 * Authoritative platform architecture for the API server.
 * Mirrors artifacts/instacollab/src/lib/platformArchitecture.ts
 */
export const PLATFORM_ARCHITECTURE = {
  authentication: "Supabase",
  database: "Supabase Postgres",
  realtime: "Supabase Realtime",
  images: "Cloudflare R2",
  videos: "Cloudflare R2",
  livestream: "LiveKit or Tencent TRTC",
  aiBeauty: "Third-party AI SDK",
  voiceChanger: "Dedicated voice SDK",
  cdn: "Cloudflare",
  frontend: "Vercel",
  backendApis: "Supabase Edge Functions (or Cloudflare Workers for heavier workloads)",
} as const;

export const PLATFORM_NON_GOALS = [
  "MongoDB Atlas is not an app data store",
  "Amazon Aurora is not an app data store",
  "Supabase Storage is not for product media bytes",
] as const;

export function mediaRuntimeProvider(): string {
  if (String(process.env.MEDIA_WORKER_URL || "").trim()) return "cloudflare_r2_worker";
  const endpoint = String(process.env.R2_ENDPOINT || "").trim();
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  if (accountId || endpoint.includes("r2.cloudflarestorage.com")) return "cloudflare_r2";
  if (endpoint.includes("storageapi.dev") || endpoint.includes("railway")) {
    return "s3_compatible_interim";
  }
  return endpoint ? "s3_compatible" : "none";
}
