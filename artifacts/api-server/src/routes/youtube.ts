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
  parseYoutubeChapters,
} from "../lib/youtubeQuota";
import {
  buildYoutubeSearchListParams,
  isYoutubeHomeBrowse,
  parseYoutubeSearchRequest,
  youtubeSearchCacheKey,
} from "../lib/youtubeSearchFilters";

const router: IRouter = Router();

type YoutubeApiSearchItem = {
  id?: { kind?: string; videoId?: string; channelId?: string; playlistId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
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
    tags?: string[];
    categoryId?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
      maxres?: { url?: string };
    };
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  status?: { embeddable?: boolean };
  liveStreamingDetails?: {
    concurrentViewers?: string;
    activeLiveChatId?: string;
    scheduledStartTime?: string;
    actualStartTime?: string;
  };
};

type FeedItem = {
  kind?: "video" | "channel" | "playlist";
  videoId: string;
  channelId?: string;
  playlistId?: string;
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

function mapVideoListItem(item: VideoListItem, opts?: { preferShort?: boolean }): FeedItem | null {
  const videoId = item.id?.trim();
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  const durationSeconds = parseIsoDurationSeconds(item.contentDetails?.duration) ?? undefined;
  const broadcast = item.snippet?.liveBroadcastContent;
  const viewers = item.liveStreamingDetails?.concurrentViewers;
  return {
    videoId,
    kind: "video" as const,
    title: item.snippet?.title?.trim() || "Untitled",
    channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
    channelId: item.snippet?.channelId?.trim() || undefined,
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

function mapSearchListItem(item: YoutubeApiSearchItem): FeedItem | null {
  const snippet = item.snippet;
  const title = snippet?.title?.trim() || "Untitled";
  const channelTitle = snippet?.channelTitle?.trim() || "YouTube";
  const publishedAt = snippet?.publishedAt;
  const thumbs = snippet?.thumbnails;
  const liveBroadcastContent = snippet?.liveBroadcastContent;
  const videoId = item.id?.videoId?.trim();
  const channelId = item.id?.channelId?.trim() || snippet?.channelId?.trim();
  const playlistId = item.id?.playlistId?.trim();

  if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return {
      kind: "video",
      videoId,
      channelId,
      title,
      channelTitle,
      thumbnailUrl: youtubeThumbnailUrl(videoId, thumbs),
      publishedAt,
      isLive: liveBroadcastContent === "live",
      liveBroadcastContent: liveBroadcastContent ?? "none",
    };
  }

  if (channelId) {
    return {
      kind: "channel",
      videoId: "",
      channelId,
      title,
      channelTitle: title,
      thumbnailUrl: thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || "",
      publishedAt,
    };
  }

  if (playlistId) {
    return {
      kind: "playlist",
      videoId: "",
      playlistId,
      channelId,
      title,
      channelTitle,
      thumbnailUrl: thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || "",
      publishedAt,
    };
  }

  return null;
}

router.get("/youtube/search", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }

    const request = parseYoutubeSearchRequest(req.query);
    const maxResults = request.maxResults ?? 20;

    // Empty query + default filters → mostPopular chart (home rail). Real searches always use search.list.
    if (isYoutubeHomeBrowse(request)) {
      const cacheKey = `search-browse:home:${maxResults}:${request.pageToken || "first"}`;
      const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);
      const popular = await fetchMostPopular(maxResults, request.pageToken);
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
        message: popular.message ?? "Popular feed failed",
        quotaExceeded: popular.quotaExceeded,
      });
      return;
    }

    const cacheKey = youtubeSearchCacheKey(request);
    const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);

    const result = await youtubeFetchJson((key) => {
      const params = buildYoutubeSearchListParams(request, key);
      return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    });

    const body = result.body as {
      items?: YoutubeApiSearchItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (result.ok) {
      let items = (body.items ?? [])
        .map((item) => mapSearchListItem(item))
        .filter((item): item is FeedItem => item !== null);

      const videoIds = items.filter((item) => item.kind === "video" && item.videoId).map((item) => item.videoId);
      if (videoIds.length > 0) {
        const enriched = await fetchVideosByIds(videoIds);
        if (enriched.ok && enriched.items.length > 0) {
          const byId = new Map(enriched.items.map((item) => [item.videoId, item]));
          items = items.map((item) => {
            if (item.kind !== "video") return item;
            const extra = byId.get(item.videoId);
            return extra ? { ...item, ...extra, kind: "video" as const } : item;
          });
        }
      }

      const payload = { items, nextPageToken: body.nextPageToken ?? null };
      await setYoutubeCache(cacheKey, payload, 900);
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
      const collected: FeedItem[] = [];
      let token: string | undefined = pageToken || undefined;
      let nextPageToken: string | null = null;

      for (let page = 0; page < 4 && collected.length < maxResults; page += 1) {
        const popular = await fetchMostPopular(50, token);
        if (!popular.ok) {
          if (page === 0 && cached) {
            res.json({ ...cached, source: "cache", quotaExceeded: true, message: message || popular.message });
            return true;
          }
          break;
        }
        for (const item of popular.items) {
          if (item.durationSeconds != null && item.durationSeconds <= 60) {
            collected.push({ ...item, isShort: true });
          }
        }
        nextPageToken = popular.nextPageToken;
        token = popular.nextPageToken || undefined;
        if (!token) break;
      }

      if (collected.length === 0) {
        const seeded = await fetchVideosByIds([...LIVE_SEED_VIDEO_IDS]);
        if (seeded.ok) {
          collected.push(
            ...seeded.items.map((item) => ({
              ...item,
              isShort: item.durationSeconds != null && item.durationSeconds <= 60,
            })),
          );
        }
      }

      if (collected.length === 0 && cached?.items?.length) {
        res.json({ ...cached, source: "cache", quotaExceeded, message });
        return true;
      }
      if (collected.length === 0) return false;

      const payload = {
        items: collected.slice(0, maxResults),
        nextPageToken,
      };
      await setYoutubeCache(cacheKey, payload, 1800);
      res.json({ ...payload, source: "videos.list", quotaExceeded, message });
      return true;
    };

    // Default Shorts rail — no search.list (saves 100 units / call).
    if (!q) {
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
    const q = String(req.query.q ?? "").trim();
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
        maxResults: String(maxResults),
        order: "viewCount",
        key,
      });
      if (q) searchParams.set("q", q);
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

function relatedSearchQuery(title: string): string {
  const cleaned = title
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/official\s*(music\s*)?(video|audio|mv)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || title).slice(0, 96);
}

router.get("/youtube/video", async (req, res, next) => {
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
    const cacheKey = `video:${videoId}`;
    const cached = await getYoutubeCache<Record<string, unknown>>(cacheKey);
    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet,contentDetails,statistics,status,liveStreamingDetails",
        id: videoId,
        key,
      });
      return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
    });
    const body = result.body as {
      items?: VideoListItem[];
      error?: { message?: string };
    };
    if (!result.ok || !body.items?.[0]) {
      if (cached) {
        res.json({ ...cached, source: "cache" });
        return;
      }
      res.status(result.ok ? 404 : result.status).json({
        error: "youtube_video_failed",
        message: body.error?.message ?? "Video not found",
      });
      return;
    }
    const item = body.items[0];
    const mapped = mapVideoListItem(item);
    if (!mapped) {
      res.status(404).json({ error: "youtube_video_failed", message: "Video not found" });
      return;
    }
    const description = item.snippet?.description ?? "";
    const payload = {
      ...mapped,
      description,
      tags: Array.isArray((item.snippet as { tags?: string[] } | undefined)?.tags)
        ? ((item.snippet as { tags?: string[] }).tags ?? []).slice(0, 20)
        : [],
      categoryId: (item.snippet as { categoryId?: string } | undefined)?.categoryId ?? null,
      embeddable: (item.status as { embeddable?: boolean } | undefined)?.embeddable !== false,
      viewCount: item.statistics?.viewCount ? Number.parseInt(item.statistics.viewCount, 10) || 0 : 0,
      likeCount: item.statistics?.likeCount ? Number.parseInt(item.statistics.likeCount, 10) || 0 : 0,
      commentCount: (item.statistics as { commentCount?: string } | undefined)?.commentCount
        ? Number.parseInt((item.statistics as { commentCount?: string }).commentCount ?? "0", 10) || 0
        : 0,
      chapters: parseYoutubeChapters(description),
    };
    await setYoutubeCache(cacheKey, payload, 1800);
    res.json({ ...payload, source: "videos.list" });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/related", async (req, res, next) => {
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
    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      25,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );

    const details = await fetchVideosByIds([videoId]);
    const seed = details.items[0];
    const q = relatedSearchQuery(seed?.title || "recommended videos");
    const cacheKey = `related:${videoId}:${q}:${pageToken || "first"}`;
    const cached = await getYoutubeCache<{ items: FeedItem[]; nextPageToken: string | null }>(cacheKey);

    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: String(maxResults),
        q,
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

    if (!result.ok) {
      if (cached) {
        res.json({ ...cached, source: "cache", quotaExceeded: isYoutubeQuotaError(result.status, body) });
        return;
      }
      res.status(result.status).json({
        error: "youtube_related_failed",
        message: body.error?.message ?? "Related failed",
        quotaExceeded: isYoutubeQuotaError(result.status, body),
      });
      return;
    }

    const mapped = (body.items ?? [])
      .map((item) => mapSearchListItem(item))
      .filter((item): item is FeedItem => Boolean(item && item.kind === "video" && item.videoId !== videoId));

    const enriched = await fetchVideosByIds(mapped.map((item) => item.videoId));
    const byId = new Map(enriched.items.map((item) => [item.videoId, item]));
    const items = mapped.map((item) => byId.get(item.videoId) ?? item);
    const payload = { items, nextPageToken: body.nextPageToken ?? null };
    await setYoutubeCache(cacheKey, payload, 900);
    res.json({ ...payload, source: "search.list" });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/comments", async (req, res, next) => {
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
    const pageToken = String(req.query.pageToken ?? "").trim();
    const order = String(req.query.order ?? "relevance").trim() === "time" ? "time" : "relevance";
    const maxResults = Math.min(
      50,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );

    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet,replies",
        videoId,
        maxResults: String(maxResults),
        order,
        textFormat: "plainText",
        key,
      });
      if (pageToken) params.set("pageToken", pageToken);
      return `https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`;
    });

    const body = result.body as {
      items?: Array<{
        id?: string;
        snippet?: {
          totalReplyCount?: number;
          topLevelComment?: {
            id?: string;
            snippet?: {
              authorDisplayName?: string;
              authorProfileImageUrl?: string;
              authorChannelId?: { value?: string };
              textDisplay?: string;
              likeCount?: number;
              publishedAt?: string;
            };
          };
        };
        replies?: {
          comments?: Array<{
            id?: string;
            snippet?: {
              authorDisplayName?: string;
              authorProfileImageUrl?: string;
              authorChannelId?: { value?: string };
              textDisplay?: string;
              likeCount?: number;
              publishedAt?: string;
            };
          }>;
        };
      }>;
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!result.ok) {
      res.status(result.status).json({
        error: "youtube_comments_failed",
        message: body.error?.message ?? "Comments failed",
        quotaExceeded: isYoutubeQuotaError(result.status, body),
      });
      return;
    }

    const mapComment = (comment: {
      id?: string;
      snippet?: {
        authorDisplayName?: string;
        authorProfileImageUrl?: string;
        authorChannelId?: { value?: string };
        textDisplay?: string;
        likeCount?: number;
        publishedAt?: string;
      };
    }) => ({
      id: comment.id ?? "",
      author: comment.snippet?.authorDisplayName?.trim() || "YouTube",
      authorAvatar: comment.snippet?.authorProfileImageUrl ?? null,
      authorChannelId: comment.snippet?.authorChannelId?.value ?? null,
      text: comment.snippet?.textDisplay?.trim() || "",
      likeCount: comment.snippet?.likeCount ?? 0,
      publishedAt: comment.snippet?.publishedAt ?? null,
    });

    const items = (body.items ?? []).map((thread) => {
      const top = thread.snippet?.topLevelComment;
      const replies = (thread.replies?.comments ?? []).map((comment) => mapComment(comment));
      return {
        ...mapComment(top ?? {}),
        id: top?.id || thread.id || "",
        replyCount: thread.snippet?.totalReplyCount ?? replies.length,
        replies,
      };
    });

    res.json({ items, nextPageToken: body.nextPageToken ?? null });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/comments/replies", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }
    const parentId = String(req.query.parentId ?? "").trim();
    if (!parentId) {
      res.status(400).json({ error: "parentId required" });
      return;
    }
    const pageToken = String(req.query.pageToken ?? "").trim();
    const result = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet",
        parentId,
        maxResults: "50",
        textFormat: "plainText",
        key,
      });
      if (pageToken) params.set("pageToken", pageToken);
      return `https://www.googleapis.com/youtube/v3/comments?${params.toString()}`;
    });
    const body = result.body as {
      items?: Array<{
        id?: string;
        snippet?: {
          authorDisplayName?: string;
          authorProfileImageUrl?: string;
          authorChannelId?: { value?: string };
          textDisplay?: string;
          likeCount?: number;
          publishedAt?: string;
        };
      }>;
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!result.ok) {
      res.status(result.status).json({
        error: "youtube_comment_replies_failed",
        message: body.error?.message ?? "Replies failed",
      });
      return;
    }
    const items = (body.items ?? []).map((comment) => ({
      id: comment.id ?? "",
      author: comment.snippet?.authorDisplayName?.trim() || "YouTube",
      authorAvatar: comment.snippet?.authorProfileImageUrl ?? null,
      authorChannelId: comment.snippet?.authorChannelId?.value ?? null,
      text: comment.snippet?.textDisplay?.trim() || "",
      likeCount: comment.snippet?.likeCount ?? 0,
      publishedAt: comment.snippet?.publishedAt ?? null,
    }));
    res.json({ items, nextPageToken: body.nextPageToken ?? null });
  } catch (error) {
    next(error);
  }
});

router.get("/youtube/channel", async (req, res, next) => {
  try {
    if (!youtubeApiKey()) {
      res.status(503).json({ error: "youtube_not_configured" });
      return;
    }
    const channelId = String(req.query.channelId ?? "").trim();
    if (!/^UC[\w-]{20,}$/.test(channelId)) {
      res.status(400).json({ error: "channelId required" });
      return;
    }
    const pageToken = String(req.query.pageToken ?? "").trim();
    const maxResults = Math.min(
      50,
      Math.max(1, Number.parseInt(String(req.query.maxResults ?? "20"), 10) || 20),
    );

    const channelRes = await youtubeFetchJson((key) => {
      const params = new URLSearchParams({
        part: "snippet,statistics,contentDetails",
        id: channelId,
        key,
      });
      return `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`;
    });
    const channelBody = channelRes.body as {
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          description?: string;
          customUrl?: string;
          thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
        };
        statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
      error?: { message?: string };
    };
    if (!channelRes.ok || !channelBody.items?.[0]) {
      res.status(channelRes.ok ? 404 : channelRes.status).json({
        error: "youtube_channel_failed",
        message: channelBody.error?.message ?? "Channel not found",
      });
      return;
    }
    const channel = channelBody.items[0];
    const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads?.trim();
    let items: FeedItem[] = [];
    let nextPageToken: string | null = null;
    if (uploadsId) {
      const listRes = await youtubeFetchJson((key) => {
        const params = new URLSearchParams({
          part: "snippet,contentDetails",
          playlistId: uploadsId,
          maxResults: String(maxResults),
          key,
        });
        if (pageToken) params.set("pageToken", pageToken);
        return `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
      });
      const listBody = listRes.body as {
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
      };
      if (listRes.ok) {
        items = (listBody.items ?? [])
          .map((item): FeedItem | null => {
            const videoId =
              item.contentDetails?.videoId?.trim() || item.snippet?.resourceId?.videoId?.trim() || "";
            if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
            return {
              kind: "video",
              videoId,
              channelId,
              title: item.snippet?.title?.trim() || "Untitled",
              channelTitle: item.snippet?.channelTitle?.trim() || channel.snippet?.title?.trim() || "YouTube",
              thumbnailUrl: youtubeThumbnailUrl(videoId, item.snippet?.thumbnails),
              publishedAt: item.snippet?.publishedAt,
            };
          })
          .filter((item): item is FeedItem => Boolean(item));
        nextPageToken = listBody.nextPageToken ?? null;
      }
    }

    const thumbs = channel.snippet?.thumbnails;
    res.json({
      channel: {
        channelId,
        title: channel.snippet?.title?.trim() || "YouTube",
        description: channel.snippet?.description ?? "",
        customUrl: channel.snippet?.customUrl ?? null,
        thumbnailUrl: thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || "",
        subscriberCount: channel.statistics?.subscriberCount
          ? Number.parseInt(channel.statistics.subscriberCount, 10) || 0
          : 0,
        videoCount: channel.statistics?.videoCount
          ? Number.parseInt(channel.statistics.videoCount, 10) || 0
          : 0,
        viewCount: channel.statistics?.viewCount
          ? Number.parseInt(channel.statistics.viewCount, 10) || 0
          : 0,
        uploadsPlaylistId: uploadsId ?? null,
      },
      items,
      nextPageToken,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
