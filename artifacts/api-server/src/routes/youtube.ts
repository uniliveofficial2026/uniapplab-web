import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";

const router: IRouter = Router();

function youtubeApiKey(): string | null {
  const key =
    process.env.YOUTUBE_API_KEY?.trim() ||
    process.env.VITE_YOUTUBE_API_KEY?.trim() ||
    "";
  return key || null;
}

type YoutubeApiSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
    };
  };
};

router.get("/youtube/health", (_req, res) => {
  const configured = Boolean(youtubeApiKey());
  res.status(configured ? 200 : 503).json({ ok: configured, configured });
});

router.get("/youtube/search", auth, requireNotBanned, async (req, res, next) => {
  try {
    const apiKey = youtubeApiKey();
    if (!apiKey) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const q = String(req.query.q ?? "").trim().slice(0, 120);
    if (!q) {
      res.status(400).json({ error: "q required" });
      return;
    }

    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      25,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q,
      maxResults: String(maxResults),
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const upstream = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    );
    const body = (await upstream.json()) as {
      items?: YoutubeApiSearchItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: "youtube_search_failed",
        message: body.error?.message ?? upstream.statusText,
      });
      return;
    }

    const items = (body.items ?? [])
      .map((item) => {
        const videoId = item.id?.videoId?.trim();
        if (!videoId) return null;
        const thumbs = item.snippet?.thumbnails;
        const thumbnailUrl =
          thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? "";
        return {
          videoId,
          title: item.snippet?.title?.trim() || "Untitled",
          channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
          thumbnailUrl,
          publishedAt: item.snippet?.publishedAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    res.json({ items, nextPageToken: body.nextPageToken ?? null });
  } catch (error) {
    next(error);
  }
});

export default router;
