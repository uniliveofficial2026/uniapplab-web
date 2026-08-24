import { createTencentRtcUserSig, isTencentRtcConfigured } from "../../../lib/tencentRtc";
import { getProviderField, getProviderSecret, isProviderConfigured } from "../providerSecretsService";
import { pingLiveKit, createLiveKitToken, isLiveKitConfigured } from "@workspace/livekit";
import { providerFetchJson } from "../providerHttp";

export async function tencentRtcHealth(): Promise<{ ok: boolean; detail: string }> {
  const sdkAppId = getProviderField("tencent", "sdkAppId") || process.env.VITE_TENCENT_RTC_SDK_APP_ID || "";
  const secret = getProviderSecret("tencent", "secretKey");
  if (!sdkAppId || !secret) {
    return { ok: false, detail: "Set sdkAppId + TENCENT_RTC_SECRET_KEY" };
  }
  try {
    createTencentRtcUserSig("health-check", 120);
    return { ok: true, detail: `SDK App ${sdkAppId} — UserSig ready` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "tencent_error" };
  }
}

export function tencentRtcUserSig(userId: string): ReturnType<typeof createTencentRtcUserSig> {
  if (!isTencentRtcConfigured() && !isProviderConfigured("tencent")) {
    throw Object.assign(new Error("tencent_rtc_not_configured"), { status: 503, code: "provider.tencent.missing" });
  }
  return createTencentRtcUserSig(userId);
}

export async function livekitHealth(): Promise<{ ok: boolean; detail: string }> {
  if (!isLiveKitConfigured()) {
    return { ok: false, detail: "Set LIVEKIT_URL + LIVEKIT_API_KEY + LIVEKIT_API_SECRET" };
  }
  const ping = await pingLiveKit();
  return { ok: ping.ok, detail: ping.ok ? `LiveKit ${ping.url}` : ping.reason || "livekit_unreachable" };
}

export async function livekitCreateToken(input: {
  identity: string;
  room: string;
  role?: "host" | "viewer";
}): Promise<{ token: string; room: string }> {
  if (!isLiveKitConfigured()) {
    throw Object.assign(new Error("livekit_not_configured"), { status: 503, code: "provider.livekit.missing" });
  }
  const token = await createLiveKitToken({
    identity: input.identity,
    room: input.room,
    role: input.role || "host",
    canPublish: input.role !== "viewer",
  });
  return { token, room: input.room };
}

export async function vercelHealth(): Promise<{ ok: boolean; detail: string }> {
  const token = getProviderSecret("vercel", "token");
  if (!token) return { ok: false, detail: "Set VERCEL_TOKEN" };
  try {
    const user = await providerFetchJson<{ user?: { username?: string } }>("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: true, detail: user.user?.username ? `@${user.user.username}` : "Vercel connected" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "vercel_error" };
  }
}

export async function stripeHealth(): Promise<{ ok: boolean; detail: string }> {
  const key = getProviderSecret("stripe", "secretKey");
  if (!key) return { ok: false, detail: "Set STRIPE_SECRET_KEY" };
  return { ok: true, detail: "Stripe secret configured" };
}

export async function geminiHealth(): Promise<{ ok: boolean; detail: string }> {
  const key = getProviderSecret("gemini", "apiKey") || process.env.VITE_GEMINI_API_KEY;
  if (!key) return { ok: false, detail: "Set GEMINI_API_KEY" };
  return { ok: true, detail: "Gemini ready for agents + design" };
}

export async function supabaseHealth(): Promise<{ ok: boolean; detail: string }> {
  const url = getProviderField("supabase", "url") || process.env.VITE_SUPABASE_URL;
  if (!url) return { ok: false, detail: "Set Supabase URL" };
  return { ok: true, detail: url.replace(/^https?:\/\//, "").slice(0, 40) };
}

export async function openaiHealth(): Promise<{ ok: boolean; detail: string }> {
  const key = getProviderSecret("openai", "apiKey");
  if (!key) return { ok: false, detail: "Set OPENAI_API_KEY (optional)" };
  return { ok: true, detail: "OpenAI configured" };
}

export async function cloudflareHealth(): Promise<{ ok: boolean; detail: string }> {
  const token = getProviderSecret("cloudflare", "apiToken");
  if (!token) return { ok: false, detail: "Set CLOUDFLARE_API_TOKEN" };
  return { ok: true, detail: "Cloudflare token configured" };
}

export async function railwayHealth(): Promise<{ ok: boolean; detail: string }> {
  const token = getProviderSecret("railway", "token");
  if (!token) return { ok: false, detail: "Set RAILWAY_TOKEN" };
  return { ok: true, detail: "Railway token configured" };
}

export async function agoraHealth(): Promise<{ ok: boolean; detail: string }> {
  const appId = getProviderField("agora", "appId");
  const cert = getProviderSecret("agora", "appCertificate");
  if (!appId || !cert) return { ok: false, detail: "Set Agora appId + certificate" };
  return { ok: true, detail: `Agora App ${appId.slice(0, 8)}…` };
}

export async function firebaseHealth(): Promise<{ ok: boolean; detail: string }> {
  const projectId = getProviderField("firebase", "projectId");
  if (!projectId) return { ok: false, detail: "Set Firebase projectId" };
  return { ok: true, detail: projectId };
}
