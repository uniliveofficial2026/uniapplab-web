/**
 * Supabase Edge Function — platform brand (Supabase lane)
 * Migrated from artifacts/api-server/src/routes/platformBrand.ts
 * Firebase/Firestore + brand-icon binary stay on Express fallback.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { getSupabaseAnon, getSupabaseService } from "../_shared/supabase.ts";

const ROW_ID = "default";

type PlatformBrand = {
  logoUrl: string | null;
  mediaType: "image" | "video";
  updatedAt: string;
};

function normalizeBrand(row: {
  logo_url?: string | null;
  logo_media_type?: string | null;
  updated_at?: string | null;
} | null): PlatformBrand | null {
  if (!row) return null;
  const logoUrl =
    typeof row.logo_url === "string" && row.logo_url.trim() ? row.logo_url.trim() : null;
  return {
    logoUrl,
    mediaType: row.logo_media_type === "video" ? "video" : "image",
    updatedAt: String(row.updated_at ?? ""),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const seg = subPath(new URL(req.url), "platform");
  const path = seg.join("/");

  if (req.method === "GET" && path === "brand") {
    try {
      const { data, error } = await getSupabaseAnon()
        .from("platform_app_brand")
        .select("logo_url, logo_media_type, updated_at")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error) throw error;
      const brand = normalizeBrand(data) ?? { logoUrl: null, mediaType: "image" as const, updatedAt: "" };
      const hasIcon = Boolean(brand.logoUrl && brand.mediaType !== "video");
      return json({
        logoUrl: brand.logoUrl,
        mediaType: brand.mediaType,
        updatedAt: brand.updatedAt,
        iconUrl: hasIcon ? "/api/platform/brand-icon" : null,
        manifestUrl: "/api/platform/manifest.webmanifest",
      });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  if (req.method === "POST" && path === "brand") {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    const adminErr = requireAdmin(ctx);
    if (adminErr) return adminErr;

    const body = (await req.json().catch(() => ({}))) as { logoUrl?: string | null; mediaType?: string };
    const logoUrl =
      typeof body.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null;
    const mediaType = body.mediaType === "video" ? "video" : "image";
    const updatedAt = new Date().toISOString();

    const { error } = await getSupabaseService().from("platform_app_brand").upsert(
      {
        id: ROW_ID,
        logo_url: logoUrl,
        logo_media_type: mediaType,
        updated_at: updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) return json({ error: error.message }, 400);

    return json({
      logoUrl,
      mediaType,
      updatedAt,
      iconUrl: logoUrl && mediaType !== "video" ? "/api/platform/brand-icon" : null,
      manifestUrl: "/api/platform/manifest.webmanifest",
    });
  }

  // brand-icon / manifest stay on Express (binary + PWA).
  return json({ error: "not_found", hint: "Use Express for brand-icon / manifest" }, 404);
});
