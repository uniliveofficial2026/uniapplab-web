import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSupabaseAnon, getSupabaseService } from "../lib/supabase";
import { fetchFirestoreDocument, isFirestoreAdminAvailable, upsertFirestoreDocument } from "../lib/firestoreAdmin";

const router: IRouter = Router();
const ROW_ID = "default";

type PlatformBrand = {
  logoUrl: string | null;
  mediaType: "image" | "video";
  updatedAt: string;
};

const APP_NAME = "UniLive’s";
const APP_SHORT = "UniLive’s";
const THEME = "#020617";

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

async function readSupabaseBrand(): Promise<PlatformBrand | null> {
  try {
    const { data, error } = await getSupabaseAnon()
      .from("platform_app_brand")
      .select("logo_url, logo_media_type, updated_at")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) throw error;
    return normalizeBrand(data);
  } catch {
    return null;
  }
}

async function readFirebaseBrand(): Promise<PlatformBrand | null> {
  if (!isFirestoreAdminAvailable()) return null;
  const data = await fetchFirestoreDocument("platform_app_brand", ROW_ID);
  if (!data) return null;
  const logoUrl =
    typeof data.logo_url === "string" && data.logo_url.trim() ? data.logo_url.trim() : null;
  return {
    logoUrl,
    mediaType: data.logo_media_type === "video" ? "video" : "image",
    updatedAt: String(data.updated_at ?? ""),
  };
}

function mergeBrands(...items: Array<PlatformBrand | null>): PlatformBrand {
  const ranked = items
    .filter((item): item is PlatformBrand => Boolean(item))
    .sort((a, b) => {
      const aTs = Date.parse(a.updatedAt) || 0;
      const bTs = Date.parse(b.updatedAt) || 0;
      if (bTs !== aTs) return bTs - aTs;
      if (Boolean(a.logoUrl) !== Boolean(b.logoUrl)) return a.logoUrl ? -1 : 1;
      return 0;
    });
  return ranked[0] ?? { logoUrl: null, mediaType: "image", updatedAt: "" };
}

export async function resolvePlatformBrand(): Promise<PlatformBrand> {
  const [supabase, firebase] = await Promise.all([readSupabaseBrand(), readFirebaseBrand()]);
  return mergeBrands(supabase, firebase);
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

function guessMimeFromUrl(url: string): string {
  if (url.startsWith("data:")) return parseDataUrl(url)?.mime ?? "image/png";
  if (url.endsWith(".svg")) return "image/svg+xml";
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  if (url.endsWith(".gif")) return "image/gif";
  return "image/png";
}

router.get("/platform/brand", async (_req, res) => {
  const brand = await resolvePlatformBrand();
  const hasIcon = Boolean(brand.logoUrl && brand.mediaType !== "video");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json({
    logoUrl: brand.logoUrl,
    mediaType: brand.mediaType,
    updatedAt: brand.updatedAt,
    iconUrl: hasIcon ? "/api/platform/brand-icon" : null,
    manifestUrl: "/api/platform/manifest.webmanifest",
  });
});

router.get("/platform/brand-icon", async (_req, res) => {
  const brand = await resolvePlatformBrand();
  const logoUrl = brand.logoUrl;
  if (!logoUrl || brand.mediaType === "video") {
    res.redirect(302, "/brand/app-logo.png");
    return;
  }

  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    res.redirect(302, logoUrl);
    return;
  }

  const parsed = parseDataUrl(logoUrl);
  if (parsed) {
    res.setHeader("Content-Type", parsed.mime);
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.send(parsed.buffer);
    return;
  }

  res.redirect(302, "/brand/app-logo.png");
});

router.get("/platform/manifest.webmanifest", async (_req, res) => {
  const brand = await resolvePlatformBrand();
  const iconSrc =
    brand.logoUrl && brand.mediaType !== "video"
      ? "/api/platform/brand-icon"
      : "/brand/app-logo.png";
  const iconType = guessMimeFromUrl(brand.logoUrl ?? iconSrc);

  const manifest = {
    id: "/",
    name: APP_NAME,
    short_name: APP_SHORT,
    description: "Create, connect, and collaborate in real time.",
    theme_color: THEME,
    background_color: THEME,
    display: "standalone",
    orientation: "portrait-primary",
    scope: "/",
    start_url: "/",
    icons: [
      { src: iconSrc, sizes: "512x512", type: iconType, purpose: "any" },
      { src: iconSrc, sizes: "512x512", type: iconType, purpose: "maskable" },
      { src: "/brand/app-logo.png", sizes: "1254x1254", type: "image/png", purpose: "any" },
    ],
  };

  res.setHeader("Content-Type", "application/manifest+json");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(manifest);
});

router.post("/platform/brand", auth, requireAdmin, async (req, res) => {
  const body = req.body as { logoUrl?: string | null; mediaType?: string };
  const logoUrl =
    typeof body.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null;
  const mediaType = body.mediaType === "video" ? "video" : "image";
  const updatedAt = new Date().toISOString();

  const tasks: Promise<void>[] = [];

  tasks.push(
    (async () => {
      const { error } = await getSupabaseService().from("platform_app_brand").upsert(
        {
          id: ROW_ID,
          logo_url: logoUrl,
          logo_media_type: mediaType,
          updated_at: updatedAt,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    })().catch((err) => {
      console.warn("[platform-brand] supabase publish failed:", err);
    }),
  );

  if (isFirestoreAdminAvailable()) {
    tasks.push(
      upsertFirestoreDocument("platform_app_brand", ROW_ID, {
        logo_url: logoUrl,
        logo_media_type: mediaType,
        updated_at: updatedAt,
      }).then((ok) => {
        if (!ok) console.warn("[platform-brand] firebase publish failed");
      }),
    );
  }

  await Promise.all(tasks);

  res.json({
    logoUrl,
    mediaType,
    updatedAt,
    iconUrl: logoUrl && mediaType !== "video" ? "/api/platform/brand-icon" : null,
    manifestUrl: "/api/platform/manifest.webmanifest",
  });
});

export default router;
