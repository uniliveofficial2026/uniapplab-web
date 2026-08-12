import { Router, type IRouter } from "express";
import {
  getYoutubeCache,
  isYoutubeQuotaError,
  LIVE_SEED_VIDEO_IDS,
  parseIsoDurationSeconds,
  setYoutubeCache,
  youtubeApiKey,
  youtubeFetchJson,
  youtubeThumbnailUrl,
} from "../lib/youtubeQuota";

const router: IRouter = Router();

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
      maxres?: { url?: string };
    };
  };
};

type VideoListItem = {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    description?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
      maxres?: { url?: string };
    };
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string };
  liveStreamingDetails?: {
    concurrentViewers?: string;
    activeLiveChatId?: string;
    scheduledStartTime?: string;
    actualStartTime?: string;
  };
};

type FeedItem = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt?: string;
  isShort?: boolean;
  isLive?: boolean;
  liveBroadcastContent?: string;
  concurrentViewers?: number;
  activeLiveChatId?: string;
  durationSeconds?: number;
};

const BROWSE_QUERIES = new Set([
  "",
  "live",
  "trending",
  "trending music news gaming",
  "music",
  "news",
  "gaming",
  "#shorts",
  "shorts",
]);

function isBrowseQuery(q: string): boolean {
  return BROWSE_QUERIES.has(q.trim().toLowerCase());
}

function mapVideoListItem(item: VideoListItem, opts?: { preferShort?: boolean }): FeedItem | null {
  const videoId = item.id?.trim();
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  const durationSeconds = parseIsoDurationSeconds(item.contentDetails?.duration) ?? undefined;
  const broadcast = item.snippet?.liveBroadcastContent;
  const viewers = item.liveStreamingDetails?.concurrentViewers;
  return {
    videoId,
    title: item.snippet?.title?.trim() || "Untitled",
    channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
    thumbnailUrl: youtubeThumbnailUrl(videoId, item.snippet?.thumbnails),
    publishedAt: item.snippet?.publishedAt,
    durationSeconds,
    isShort: opts?.preferShort
      ? durationSeconds == null || durationSeconds <= 60
      : durationSeconds != null && durationSeconds <= 60,
    isLive: broadcast === "live",
    liveBroadcastContent: broadcast ?? "none",
    concurrentViewers: viewers ? Number.parseInt(viewers, 10) || undefined : undefined,
    activeLiveChatId: item.liveStreamingDetails?.activeLiveChatId?.trim() || undefined,
  };
}

async function fetchMostPopular(maxResults: number, pageToken?: string): Promise<{
  items: FeedItem[];
  nextPageToken: string | null;
  ok: boolean;
  status: number;
  message?: string;
  quotaExceeded?: boolean;
}> {
  const result = await youtubeFetchJson((key) => {
    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      chart: "mostPopular",
      maxResults: String(maxResults),
      regionCode: "US",
      key,
    });
    if (pageToken) params.set("pageToken", pageToken);
    return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  });

  const body = result.body as {
    items?: VideoListItem[];
    nextPageToken?: string;
    error?: { message?: string };
  };

  if (!result.ok) {
    return {
      items: [],
      nextPageToken: null,
      ok: false,
      status: result.status,
      message: body.error?.message,
      quotaExceeded: isYoutubeQuotaError(result.status, body),
    };
  }

  const items = (body.items ?? [])
    .map((item) => mapVideoListItem(item))
    .filter((item): item is FeedItem => Boolean(item));

  return {
    items,
    nextPageToken: body.nextPageToken ?? null,
    ok: true,
    status: 200,
  };
}

async function fetchVideosByIds(
  ids: string[],
  parts = "snippet,contentDetails,statistics,liveStreamingDetails",
): Promise<{
  items: FeedItem[];
  ok: boolean;
  status: number;
  message?: string;
  quotaExceeded?: boolean;
}> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter((id) => /^[a-zA-Z0-9_-]{11}$/.test(id)))].slice(
    0,
    50,
  );
  if (unique.length === 0) {
    return { items: [], ok: true, status: 200 };
  }

  const result = await youtubeFetchJson((key) => {
    const params = new URLSearchParams({
      part: parts,
      id: unique.join(","),
      key,
    });
    return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  });

  const body = result.body as {
    items?: VideoListItem[];
    error?: { message?: string };
  };

  if (!result.ok) {
    return {
      items: [],
      ok: false,
      status: result.status,
      message: body.error?.message,
      quotaExceeded: isYoutubeQuotaError(result.status, body),
    };
  }

  const byId = new Map(
    (body.items ?? [])
      .map((item) => mapVideoListItem(item))
      .filter((item): item is FeedItem => Boolean(item))
      .map((item) => [item.videoId, item]),
  );
  const items = unique.map((id) => byId.get(id)).filter((item): item is FeedItem => Boolean(item));
  return { items, ok: true, status: 200 };
}

router.get("/youtube/health", (_req, res) => {
  const configured = Boolean(youtubeApiKey());
  res.status(configured ? 200 : 503).json({ ok: configured, configured });
});

/** Home / browse — uses videos.list chart=mostPopular (1 unit) instead of search.list (100). */
router.get("/youtube/popular", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      25,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );
    const cacheKey = `popular:${maxResults}:${pageToken || "first"}`;

    const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);
    const popular = await fetchMostPopular(maxResults, pageToken || undefined);
    if (popular.ok) {
      await setYoutubeCache(cacheKey, { items: popular.items, nextPageToken: popular.nextPageToken }, 1800);
      res.json({
        items: popular.items,
        nextPageToken: popular.nextPageToken,
        source: "videos.list",
      });
      return;
    }

    if (cached) {
      res.json({
        ...cached,
        source: "cache",
        quotaExceeded: popular.quotaExceeded,
        message: popular.message,
      });
      return;
    }

    res.status(popular.status || 502).json({
      error: "youtube_popular_failed",
      message: popular.message ?? "Popular feed failed",
      quotaExceeded: popular.quotaExceeded,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/search", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const q = String(req.query.q ?? "").trim();
    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      25,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );

    // Browse queries → cheap popular chart (avoids Search Queries quota).
    if (!q || isBrowseQuery(q)) {
      const cacheKey = `search-browse:${q || "home"}:${maxResults}:${pageToken || "first"}`;
      const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);
      const popular = await fetchMostPopular(maxResults, pageToken || undefined);
      if (popular.ok) {
        await setYoutubeCache(cacheKey, { items: popular.items, nextPageToken: popular.nextPageToken }, 1800);
        res.json({
          items: popular.items,
          nextPageToken: popular.nextPageToken,
          source: "videos.list",
        });
        return;
      }
      if (cached) {
        res.json({ ...cached, source: "cache", quotaExceeded: true, message: popular.message });
        return;
      }
      res.status(popular.status || 429).json({
        error: "youtube_search_failed",
        message: popular.message ?? "Quota exceeded",
        quotaExceeded: true,
      });
      return;
    }

    const cacheKey = `search:${q}:${maxResults}:${pageToken || "first"}`;
    const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);

    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        q,
        maxResults: String(maxResults),
        key,
      });
      if (pageToken) params.set("pageToken", pageToken);
      return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    });

    const body = result.body as {
      items?: YoutubeApiSearchItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (result.ok) {
      const items = (body.items ?? [])
        .map((item) => {
          const videoId = item.id?.videoId?.trim();
          if (!videoId) return null;
          return {
            videoId,
            title: item.snippet?.title?.trim() || "Untitled",
            channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
            thumbnailUrl: youtubeThumbnailUrl(videoId, item.snippet?.thumbnails),
            publishedAt: item.snippet?.publishedAt,
          } satisfies FeedItem;
        })
        .filter((item): item is FeedItem => Boolean(item));

      const payload = { items, nextPageToken: body.nextPageToken ?? null };
      await setYoutubeCache(cacheKey, payload, 3600);
      res.json({ ...payload, source: "search.list" });
      return;
    }

    if (cached) {
      res.json({
        ...cached,
        source: "cache",
        quotaExceeded: isYoutubeQuotaError(result.status, body),
        message: body.error?.message,
      });
      return;
    }

    // Last resort: popular chart so Home never fully breaks.
    if (isYoutubeQuotaError(result.status, body)) {
      const popular = await fetchMostPopular(maxResults);
      if (popular.ok) {
        res.json({
          items: popular.items,
          nextPageToken: popular.nextPageToken,
          source: "videos.list",
          quotaExceeded: true,
          message: body.error?.message,
        });
        return;
      }
    }

    res.status(result.status).json({
      error: "youtube_search_failed",
      message: body.error?.message ?? "Search failed",
      quotaExceeded: isYoutubeQuotaError(result.status, body),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/shorts", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const q = String(req.query.q ?? "").trim();
    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      25,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );

    const respondShortsFromPopular = async (quotaExceeded = false, message?: string) => {
      const cacheKey = `shorts-popular:${maxResults}:${pageToken || "first"}`;
      const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);
      const popular = await fetchMostPopular(Math.min(50, maxResults * 2), pageToken || undefined);
      if (popular.ok) {
        const shortsOnly = popular.items
          .filter((item) => item.durationSeconds != null && item.durationSeconds <= 60)
          .map((item) => ({
            ...item,
            isShort: true as const,
          }))
          .slice(0, maxResults);
        // If this page has no ≤60s clips, advance with whatever short-ish rows we can;
        // never relabel long videos as Shorts.
        const payload = {
          items: shortsOnly,
          nextPageToken: popular.nextPageToken,
        };
        await setYoutubeCache(cacheKey, payload, 1800);
        res.json({ ...payload, source: "videos.list", quotaExceeded, message });
        return true;
      }
      if (cached) {
        res.json({ ...cached, source: "cache", quotaExceeded: true, message: message || popular.message });
        return true;
      }
      return false;
    };

    // Default Shorts rail — no search.list (saves 100 units / call).
    if (!q || isBrowseQuery(q)) {
      const ok = await respondShortsFromPopular();
      if (ok) return;
      res.status(429).json({
        error: "youtube_shorts_failed",
        message: "Shorts feed unavailable",
        quotaExceeded: true,
      });
      return;
    }

    const cacheKey = `shorts:${q}:${maxResults}:${pageToken || "first"}`;
    const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);

    const searchRes = await youtubeFetchJson((key) => {
      const searchParams = new URLSearchParams({
        part: "snippet",
        type: "video",
        q,
        videoDuration: "short",
        maxResults: String(maxResults),
        key,
      });
      if (pageToken) searchParams.set("pageToken", pageToken);
      return `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    });

    const searchBody = searchRes.body as {
      items?: YoutubeApiSearchItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!searchRes.ok) {
      if (cached) {
        res.json({
          ...cached,
          source: "cache",
          quotaExceeded: isYoutubeQuotaError(searchRes.status, searchBody),
          message: searchBody.error?.message,
        });
        return;
      }
      const ok = await respondShortsFromPopular(
        isYoutubeQuotaError(searchRes.status, searchBody),
        searchBody.error?.message,
      );
      if (ok) return;
      res.status(searchRes.status).json({
        error: "youtube_shorts_failed",
        message: searchBody.error?.message ?? searchRes.status,
        quotaExceeded: isYoutubeQuotaError(searchRes.status, searchBody),
      });
      return;
    }

    const candidates = (searchBody.items ?? [])
      .map((item) => {
        const videoId = item.id?.videoId?.trim();
        if (!videoId) return null;
        return {
          videoId,
          title: item.snippet?.title?.trim() || "Untitled",
          channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
          thumbnailUrl: youtubeThumbnailUrl(videoId, item.snippet?.thumbnails),
          publishedAt: item.snippet?.publishedAt,
          isShort: true as const,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const enriched = await fetchVideosByIds(candidates.map((item) => item.videoId), "contentDetails");
    const durationById = new Map(
      enriched.items.map((item) => [item.videoId, item.durationSeconds] as const),
    );

    const strict = candidates
      .map((item) => {
        const durationSeconds = durationById.get(item.videoId);
        return { ...item, durationSeconds };
      })
      .filter((item) => item.durationSeconds == null || item.durationSeconds <= 60);

    const items =
      strict.length > 0
        ? strict
        : candidates.map((item) => ({
            ...item,
            durationSeconds: durationById.get(item.videoId),
          }));

    const payload = { items, nextPageToken: searchBody.nextPageToken ?? null };
    await setYoutubeCache(cacheKey, payload, 3600);
    res.json({ ...payload, source: "search.list" });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/live", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const eventTypeRaw = String(req.query.eventType ?? "live").trim().toLowerCase();
    const eventType =
      eventTypeRaw === "upcoming" || eventTypeRaw === "completed" ? eventTypeRaw : "live";
    const q = String(req.query.q ?? "").trim() || "live";
    const pageToken = String(req.query.pageToken ?? "").trim();
    const idsParam = String(req.query.ids ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const maxResults = Math.min(
      25,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );

    const hydrateLiveIds = async (ids: string[], meta?: { quotaExceeded?: boolean; message?: string; source?: string }) => {
      const enriched = await fetchVideosByIds(ids);
      if (!enriched.ok && enriched.items.length === 0) {
        return false;
      }
      const items = enriched.items
        .filter((item) => {
          if (eventType === "live") return item.liveBroadcastContent === "live" || item.isLive;
          if (eventType === "upcoming") return item.liveBroadcastContent === "upcoming";
          return true;
        })
        .map((item) => ({
          ...item,
          isLive: item.liveBroadcastContent === "live",
        }));

      // If filters emptied (streams ended), still return enriched rows so UI isn't blank.
      const payload = {
        items: items.length > 0 ? items.slice(0, maxResults) : enriched.items.slice(0, maxResults),
        nextPageToken: null as string | null,
      };
      if (payload.items.length > 0) {
        await setYoutubeCache(`live-ids:${eventType}`, payload.items.map((item) => item.videoId), 86_400);
        await setYoutubeCache(`live-feed:${eventType}:seed`, payload, 900);
      }
      res.json({
        ...payload,
        source: meta?.source || "videos.list",
        quotaExceeded: meta?.quotaExceeded,
        message: meta?.message,
      });
      return true;
    };

    // Explicit ids — never uses search.list (fixes quota + pasted live URLs).
    if (idsParam.length > 0) {
      const ok = await hydrateLiveIds(idsParam, { source: "videos.list" });
      if (ok) return;
      res.status(502).json({ error: "youtube_live_failed", message: "Could not load live videos by id" });
      return;
    }

    const cacheKey = `live:${eventType}:${q}:${maxResults}:${pageToken || "first"}`;
    const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);
    const cachedIds = await getYoutubeCache<string[]>(`live-ids:${eventType}`);

    const searchRes = await youtubeFetchJson((key) => {
      const searchParams = new URLSearchParams({
        part: "snippet",
        type: "video",
        eventType,
        q,
        maxResults: String(maxResults),
        order: "viewCount",
        key,
      });
      if (pageToken) searchParams.set("pageToken", pageToken);
      return `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    });

    const searchBody = searchRes.body as {
      items?: YoutubeApiSearchItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!searchRes.ok) {
      const quotaExceeded = isYoutubeQuotaError(searchRes.status, searchBody);
      if (cached?.items?.length) {
        res.json({
          ...cached,
          source: "cache",
          quotaExceeded,
          message: searchBody.error?.message,
        });
        return;
      }

      const fallbackIds = [
        ...(cachedIds ?? []),
        ...LIVE_SEED_VIDEO_IDS,
      ];
      const ok = await hydrateLiveIds(fallbackIds, {
        quotaExceeded,
        message: searchBody.error?.message,
        source: "videos.list",
      });
      if (ok) return;

      res.status(searchRes.status).json({
        error: "youtube_live_failed",
        message: searchBody.error?.message ?? "Live feed failed",
        quotaExceeded,
      });
      return;
    }

    const candidates = (searchBody.items ?? [])
      .map((item) => {
        const videoId = item.id?.videoId?.trim();
        if (!videoId) return null;
        return {
          videoId,
          title: item.snippet?.title?.trim() || "Untitled",
          channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
          thumbnailUrl: youtubeThumbnailUrl(videoId, item.snippet?.thumbnails),
          publishedAt: item.snippet?.publishedAt,
          isLive: eventType === "live",
          liveBroadcastContent: eventType,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const enriched = await fetchVideosByIds(candidates.map((item) => item.videoId));
    const metaById = new Map(enriched.items.map((item) => [item.videoId, item]));

    const items = candidates.map((item) => {
      const meta = metaById.get(item.videoId);
      const broadcast =
        meta?.liveBroadcastContent === "live" ||
        meta?.liveBroadcastContent === "upcoming" ||
        meta?.liveBroadcastContent === "none"
          ? meta.liveBroadcastContent
          : item.liveBroadcastContent;
      return {
        ...item,
        title: meta?.title || item.title,
        channelTitle: meta?.channelTitle || item.channelTitle,
        thumbnailUrl: meta?.thumbnailUrl || item.thumbnailUrl,
        isLive: broadcast === "live",
        liveBroadcastContent: broadcast,
        concurrentViewers: meta?.concurrentViewers,
        activeLiveChatId: meta?.activeLiveChatId,
      };
    });

    const payload = { items, nextPageToken: searchBody.nextPageToken ?? null };
    await setYoutubeCache(cacheKey, payload, 900);
    await setYoutubeCache(
      `live-ids:${eventType}`,
      items.map((item) => item.videoId),
      86_400,
    );
    res.json({ ...payload, source: "search.list" });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/live/details", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const videoId = String(req.query.videoId ?? "").trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      res.status(400).json({ error: "videoId required" });
      return;
    }

    const cacheKey = `details:${videoId}`;
    const cached = await getYoutubeCache<Record<string, unknown>>(cacheKey);

    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet,liveStreamingDetails,statistics",
        id: videoId,
        key,
      });
      return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
    });

    const body = result.body as {
      items?: VideoListItem[];
      error?: { message?: string };
    };

    if (!result.ok) {
      if (cached) {
        res.json({ ...cached, source: "cache", quotaExceeded: isYoutubeQuotaError(result.status, body) });
        return;
      }
      res.status(result.status).json({
        error: "youtube_live_details_failed",
        message: body.error?.message ?? "Live details failed",
      });
      return;
    }

    const item = body.items?.[0];
    if (!item?.id) {
      res.status(404).json({ error: "video_not_found" });
      return;
    }

    const thumbs = item.snippet?.thumbnails;
    const viewers = item.liveStreamingDetails?.concurrentViewers;
    const broadcast = item.snippet?.liveBroadcastContent;
    const channelId = item.snippet?.channelId?.trim() || null;

    let channelThumbnailUrl: string | null = null;
    let subscriberCount: number | undefined;
    let channelDescription: string | null = null;
    let customUrl: string | null = null;
    if (channelId) {
      try {
        const channelRes = await youtubeFetchJson((key) => {
          const channelParams = new URLSearchParams({
            part: "snippet,statistics",
            id: channelId,
            key,
          });
          return `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`;
        });
        if (channelRes.ok) {
          const channelBody = channelRes.body as {
            items?: Array<{
              snippet?: {
                description?: string;
                customUrl?: string;
                thumbnails?: {
                  default?: { url?: string };
                  medium?: { url?: string };
                  high?: { url?: string };
                };
              };
              statistics?: { subscriberCount?: string };
            }>;
          };
          const channel = channelBody.items?.[0];
          const cThumbs = channel?.snippet?.thumbnails;
          channelThumbnailUrl =
            cThumbs?.medium?.url ?? cThumbs?.default?.url ?? cThumbs?.high?.url ?? null;
          const subs = channel?.statistics?.subscriberCount;
          subscriberCount = subs ? Number.parseInt(subs, 10) || undefined : undefined;
          channelDescription = channel?.snippet?.description?.trim() || null;
          customUrl = channel?.snippet?.customUrl?.trim() || null;
        }
      } catch {
        /* optional */
      }
    }

    const payload = {
      videoId: item.id,
      title: item.snippet?.title?.trim() || "Untitled",
      description: item.snippet?.description?.trim() || "",
      channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
      channelId,
      channelThumbnailUrl,
      channelDescription,
      customUrl,
      subscriberCount,
      thumbnailUrl: youtubeThumbnailUrl(item.id, thumbs),
      isLive: broadcast === "live",
      liveBroadcastContent: broadcast ?? "none",
      concurrentViewers: viewers ? Number.parseInt(viewers, 10) || undefined : undefined,
      activeLiveChatId: item.liveStreamingDetails?.activeLiveChatId?.trim() || null,
      scheduledStartTime: item.liveStreamingDetails?.scheduledStartTime ?? null,
      actualStartTime: item.liveStreamingDetails?.actualStartTime ?? null,
      viewCount: item.statistics?.viewCount
        ? Number.parseInt(item.statistics.viewCount, 10) || undefined
        : undefined,
      likeCount: item.statistics?.likeCount
        ? Number.parseInt(item.statistics.likeCount, 10) || undefined
        : undefined,
      watchUrl: `https://www.youtube.com/watch?v=${item.id}`,
      liveUrl: `https://www.youtube.com/live/${item.id}`,
      channelUrl: channelId
        ? customUrl
          ? `https://www.youtube.com/${customUrl.startsWith("@") ? customUrl : `@${customUrl}`}`
          : `https://www.youtube.com/channel/${channelId}`
        : null,
    };

    await setYoutubeCache(cacheKey, payload, 120);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/live/chat", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const liveChatId = String(req.query.liveChatId ?? "").trim();
    if (!liveChatId) {
      res.status(400).json({ error: "liveChatId required" });
      return;
    }

    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      200,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "50"), 10) || 50),
    );

    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet,authorDetails",
        liveChatId,
        maxResults: String(maxResults),
        key,
      });
      if (pageToken) params.set("pageToken", pageToken);
      return `https://www.googleapis.com/youtube/v3/liveChat/messages?${params.toString()}`;
    });

    const body = result.body as {
      items?: Array<{
        id?: string;
        snippet?: {
          type?: string;
          publishedAt?: string;
          displayMessage?: string;
          textMessageDetails?: { messageText?: string };
          superChatDetails?: {
            amountMicros?: string;
            currency?: string;
            amountDisplayString?: string;
            userComment?: string;
            tier?: number;
          };
          superStickerDetails?: {
            amountMicros?: string;
            currency?: string;
            amountDisplayString?: string;
            tier?: number;
            superStickerMetadata?: { altText?: string };
          };
          memberMilestoneChatDetails?: {
            memberMonth?: string;
            memberLevelName?: string;
            userComment?: string;
          };
        };
        authorDetails?: {
          channelId?: string;
          displayName?: string;
          profileImageUrl?: string;
          isVerified?: boolean;
          isChatOwner?: boolean;
          isChatSponsor?: boolean;
          isChatModerator?: boolean;
        };
      }>;
      nextPageToken?: string;
      pollingIntervalMillis?: number;
      offlineAt?: string;
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    };

    if (!result.ok) {
      res.status(result.status).json({
        error: "youtube_live_chat_failed",
        message: body.error?.message ?? "Live chat failed",
        reason: body.error?.errors?.[0]?.reason ?? null,
      });
      return;
    }

    const messages = (body.items ?? [])
      .map((item) => {
        const id = item.id?.trim();
        if (!id) return null;
        const type = item.snippet?.type ?? "textMessageEvent";
        const superChat = item.snippet?.superChatDetails;
        const superSticker = item.snippet?.superStickerDetails;
        const milestone = item.snippet?.memberMilestoneChatDetails;
        const kind =
          type === "superChatEvent"
            ? "superChat"
            : type === "superStickerEvent"
              ? "superSticker"
              : type === "memberMilestoneChatEvent"
                ? "membership"
                : type === "newSponsorEvent"
                  ? "membership"
                  : "chat";
        return {
          id,
          kind,
          type,
          publishedAt: item.snippet?.publishedAt ?? null,
          message:
            item.snippet?.displayMessage?.trim() ||
            item.snippet?.textMessageDetails?.messageText?.trim() ||
            superChat?.userComment?.trim() ||
            milestone?.userComment?.trim() ||
            "",
          amountDisplayString:
            superChat?.amountDisplayString?.trim() ||
            superSticker?.amountDisplayString?.trim() ||
            null,
          amountMicros: (() => {
            const raw = superChat?.amountMicros || superSticker?.amountMicros;
            if (!raw) return null;
            const n = Number.parseInt(raw, 10);
            return Number.isFinite(n) ? n : null;
          })(),
          currency: superChat?.currency || superSticker?.currency || null,
          tier: superChat?.tier ?? superSticker?.tier ?? null,
          stickerAlt: superSticker?.superStickerMetadata?.altText?.trim() || null,
          memberLevelName: milestone?.memberLevelName?.trim() || null,
          author: {
            channelId: item.authorDetails?.channelId ?? null,
            displayName: item.authorDetails?.displayName?.trim() || "Viewer",
            profileImageUrl: item.authorDetails?.profileImageUrl ?? null,
            isVerified: Boolean(item.authorDetails?.isVerified),
            isOwner: Boolean(item.authorDetails?.isChatOwner),
            isModerator: Boolean(item.authorDetails?.isChatModerator),
            isMember: Boolean(item.authorDetails?.isChatSponsor),
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    res.json({
      messages,
      nextPageToken: body.nextPageToken ?? null,
      pollingIntervalMillis: body.pollingIntervalMillis ?? 5000,
      offlineAt: body.offlineAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

/** Insert a live chat text message using the viewer's Google OAuth token (no youtube.com redirect). */
router.post("/youtube/live/chat", async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization ?? "").trim();
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!accessToken) {
      res.status(401).json({
        error: "youtube_oauth_required",
        message: "Google YouTube access token required to send live chat.",
        reason: "authRequired",
      });
      return;
    }

    const liveChatId = String(req.body?.liveChatId ?? "").trim();
    const messageText = String(req.body?.messageText ?? "").trim();
    if (!liveChatId) {
      res.status(400).json({ error: "liveChatId required" });
      return;
    }
    if (!messageText) {
      res.status(400).json({ error: "messageText required" });
      return;
    }
    if (messageText.length > 200) {
      res.status(400).json({ error: "message_too_long", message: "Max 200 characters." });
      return;
    }

    const upstream = await fetch(
      "https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            liveChatId,
            type: "textMessageEvent",
            textMessageDetails: { messageText },
          },
        }),
      },
    );
    const body = (await upstream.json()) as {
      id?: string;
      snippet?: { displayMessage?: string; textMessageDetails?: { messageText?: string } };
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    };

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: "youtube_live_chat_send_failed",
        message: body.error?.message ?? upstream.statusText,
        reason: body.error?.errors?.[0]?.reason ?? null,
      });
      return;
    }

    res.json({
      id: body.id ?? `sent-${Date.now()}`,
      message:
        body.snippet?.displayMessage?.trim() ||
        body.snippet?.textMessageDetails?.messageText?.trim() ||
        messageText,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/playlist", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const playlistId = String(req.query.playlistId ?? "").trim();
    if (!playlistId) {
      res.status(400).json({ error: "playlistId required" });
      return;
    }

    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      50,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "50"), 10) || 50),
    );

    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet,contentDetails",
        playlistId,
        maxResults: String(maxResults),
        key,
      });
      if (pageToken) params.set("pageToken", pageToken);
      return `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
    });

    const body = result.body as {
      items?: Array<{
        contentDetails?: { videoId?: string };
        snippet?: {
          title?: string;
          channelTitle?: string;
          publishedAt?: string;
          resourceId?: { videoId?: string };
          thumbnails?: {
            medium?: { url?: string };
            high?: { url?: string };
            default?: { url?: string };
            maxres?: { url?: string };
          };
        };
      }>;
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!result.ok) {
      res.status(result.status).json({
        error: "youtube_playlist_failed",
        message: body.error?.message ?? "Playlist failed",
      });
      return;
    }

    const items = (body.items ?? [])
      .map((item) => {
        const videoId =
          item.contentDetails?.videoId?.trim() ||
          item.snippet?.resourceId?.videoId?.trim();
        if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
        return {
          videoId,
          title: item.snippet?.title?.trim() || "Untitled",
          channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
          thumbnailUrl: youtubeThumbnailUrl(videoId, item.snippet?.thumbnails),
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
