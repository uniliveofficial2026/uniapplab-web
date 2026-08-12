import type { Plugin } from "vite";

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

function readSearchParams(url: string): URLSearchParams {
  const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  return new URLSearchParams(query);
}

function readJsonBody(req: {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

/** Local dev handler for /api/youtube/* when api-server is not running. */
export function youtubeApiPlugin(apiKey: string): Plugin | null {
  const key = apiKey.trim();
  if (!key) return null;

  return {
    name: "youtube-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/youtube")) {
          next();
          return;
        }

        if (url.startsWith("/api/youtube/health")) {
          res.setHeader("content-type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true, configured: true }));
          return;
        }

        const thumb = (
          videoId: string,
          thumbs?: {
            medium?: { url?: string };
            high?: { url?: string };
            default?: { url?: string };
          },
        ) =>
          thumbs?.high?.url ||
          thumbs?.medium?.url ||
          thumbs?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        if (
          (url === "/api/youtube/popular" || url.startsWith("/api/youtube/popular?")) &&
          req.method === "GET"
        ) {
          const params = readSearchParams(url);
          try {
            const pageToken = (params.get("pageToken") ?? "").trim();
            const maxResults = Math.min(
              25,
              Math.max(1, Number.parseInt(params.get("maxResults") ?? "20", 10) || 20),
            );
            const upstreamParams = new URLSearchParams({
              part: "snippet,contentDetails,statistics",
              chart: "mostPopular",
              maxResults: String(maxResults),
              regionCode: "US",
              key,
            });
            if (pageToken) upstreamParams.set("pageToken", pageToken);
            const upstream = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?${upstreamParams.toString()}`,
            );
            const body = (await upstream.json()) as {
              items?: Array<{
                id?: string;
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
              }>;
              nextPageToken?: string;
              error?: { message?: string };
            };
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_popular_failed",
                  message: body.error?.message ?? upstream.statusText,
                }),
              );
              return;
            }
            const items = (body.items ?? [])
              .map((item) => {
                const videoId = item.id?.trim();
                if (!videoId) return null;
                return {
                  videoId,
                  title: item.snippet?.title?.trim() || "Untitled",
                  channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
                  thumbnailUrl: thumb(videoId, item.snippet?.thumbnails),
                  publishedAt: item.snippet?.publishedAt,
                };
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item));
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                items,
                nextPageToken: body.nextPageToken ?? null,
                source: "videos.list",
              }),
            );
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_popular_failed",
                message: error instanceof Error ? error.message : "Popular failed",
              }),
            );
          }
          return;
        }

        if (url.startsWith("/api/youtube/search") && req.method === "GET") {
          const params = readSearchParams(url);
          const q = (params.get("q") ?? "").trim();
          const browse =
            !q ||
            ["trending", "trending music news gaming", "music", "news", "gaming", "live"].includes(
              q.toLowerCase(),
            );
          if (browse) {
            // Avoid Search Queries quota — proxy to popular chart.
            const pageToken = (params.get("pageToken") ?? "").trim();
            const maxResults = Math.min(
              25,
              Math.max(1, Number.parseInt(params.get("maxResults") ?? "20", 10) || 20),
            );
            try {
              const upstreamParams = new URLSearchParams({
                part: "snippet,contentDetails,statistics",
                chart: "mostPopular",
                maxResults: String(maxResults),
                regionCode: "US",
                key,
              });
              if (pageToken) upstreamParams.set("pageToken", pageToken);
              const upstream = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?${upstreamParams.toString()}`,
              );
              const body = (await upstream.json()) as {
                items?: Array<{
                  id?: string;
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
                }>;
                nextPageToken?: string;
                error?: { message?: string };
              };
              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.setHeader("content-type", "application/json");
                res.end(
                  JSON.stringify({
                    error: "youtube_search_failed",
                    message: body.error?.message ?? upstream.statusText,
                  }),
                );
                return;
              }
              const items = (body.items ?? [])
                .map((item) => {
                  const videoId = item.id?.trim();
                  if (!videoId) return null;
                  return {
                    videoId,
                    title: item.snippet?.title?.trim() || "Untitled",
                    channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
                    thumbnailUrl: thumb(videoId, item.snippet?.thumbnails),
                    publishedAt: item.snippet?.publishedAt,
                  };
                })
                .filter((item): item is NonNullable<typeof item> => Boolean(item));
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  items,
                  nextPageToken: body.nextPageToken ?? null,
                  source: "videos.list",
                }),
              );
            } catch (error) {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_search_failed",
                  message: error instanceof Error ? error.message : "Search failed",
                }),
              );
            }
            return;
          }

          try {
            const pageToken = (params.get("pageToken") ?? "").trim();
            const maxResults = Math.min(
              25,
              Math.max(1, Number.parseInt(params.get("maxResults") ?? "20", 10) || 20),
            );
            const upstreamParams = new URLSearchParams({
              part: "snippet",
              type: "video",
              q,
              maxResults: String(maxResults),
              key,
            });
            if (pageToken) upstreamParams.set("pageToken", pageToken);

            const upstream = await fetch(
              `https://www.googleapis.com/youtube/v3/search?${upstreamParams.toString()}`,
            );
            const body = (await upstream.json()) as {
              items?: YoutubeApiSearchItem[];
              nextPageToken?: string;
              error?: { message?: string };
            };

            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_search_failed",
                  message: body.error?.message ?? upstream.statusText,
                }),
              );
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

            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ items, nextPageToken: body.nextPageToken ?? null }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_search_failed",
                message: error instanceof Error ? error.message : "Search failed",
              }),
            );
          }
          return;
        }

        if (url.startsWith("/api/youtube/shorts") && req.method === "GET") {
          const params = readSearchParams(url);
          const q = (params.get("q") ?? "").trim();
          const pageToken = (params.get("pageToken") ?? "").trim();
          const maxResults = Math.min(
            25,
            Math.max(1, Number.parseInt(params.get("maxResults") ?? "20", 10) || 20),
          );

          // Default Shorts rail uses videos.list (avoids Search Queries quota).
          if (!q || q === "#shorts" || q.toLowerCase() === "shorts") {
            try {
              const upstreamParams = new URLSearchParams({
                part: "snippet,contentDetails",
                chart: "mostPopular",
                maxResults: String(Math.min(50, maxResults * 2)),
                regionCode: "US",
                key,
              });
              if (pageToken) upstreamParams.set("pageToken", pageToken);
              const upstream = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?${upstreamParams.toString()}`,
              );
              const body = (await upstream.json()) as {
                items?: Array<{
                  id?: string;
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
                  contentDetails?: { duration?: string };
                }>;
                nextPageToken?: string;
                error?: { message?: string };
              };
              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.setHeader("content-type", "application/json");
                res.end(
                  JSON.stringify({
                    error: "youtube_shorts_failed",
                    message: body.error?.message ?? upstream.statusText,
                  }),
                );
                return;
              }
              const parseDuration = (value?: string) => {
                if (!value) return null;
                const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim());
                if (!match) return null;
                return (
                  Number(match[1] ?? 0) * 3600 +
                  Number(match[2] ?? 0) * 60 +
                  Number(match[3] ?? 0)
                );
              };
              const mapped = (body.items ?? [])
                .map((item) => {
                  const videoId = item.id?.trim();
                  if (!videoId) return null;
                  const durationSeconds = parseDuration(item.contentDetails?.duration) ?? undefined;
                  return {
                    videoId,
                    title: item.snippet?.title?.trim() || "Untitled",
                    channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
                    thumbnailUrl: thumb(videoId, item.snippet?.thumbnails),
                    publishedAt: item.snippet?.publishedAt,
                    isShort: true as const,
                    durationSeconds,
                  };
                })
                .filter((item): item is NonNullable<typeof item> => Boolean(item));
              const strict = mapped.filter(
                (item) => item.durationSeconds == null || item.durationSeconds <= 60,
              );
              const items = (strict.length > 0 ? strict : mapped).slice(0, maxResults);
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  items,
                  nextPageToken: body.nextPageToken ?? null,
                  source: "videos.list",
                }),
              );
            } catch (error) {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_shorts_failed",
                  message: error instanceof Error ? error.message : "Shorts failed",
                }),
              );
            }
            return;
          }

          try {
            const upstreamParams = new URLSearchParams({
              part: "snippet",
              type: "video",
              q,
              videoDuration: "short",
              maxResults: String(maxResults),
              key,
            });
            if (pageToken) upstreamParams.set("pageToken", pageToken);

            const upstream = await fetch(
              `https://www.googleapis.com/youtube/v3/search?${upstreamParams.toString()}`,
            );
            const body = (await upstream.json()) as {
              items?: YoutubeApiSearchItem[];
              nextPageToken?: string;
              error?: { message?: string };
            };

            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_shorts_failed",
                  message: body.error?.message ?? upstream.statusText,
                }),
              );
              return;
            }

            const candidates = (body.items ?? [])
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
                  isShort: true as const,
                };
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item));

            const ids = candidates.map((item) => item.videoId);
            const durationById = new Map<string, number>();
            if (ids.length > 0) {
              const detailsParams = new URLSearchParams({
                part: "contentDetails",
                id: ids.join(","),
                key,
              });
              const detailsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
              );
              if (detailsRes.ok) {
                const detailsBody = (await detailsRes.json()) as {
                  items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
                };
                for (const item of detailsBody.items ?? []) {
                  const id = item.id?.trim();
                  const raw = item.contentDetails?.duration ?? "";
                  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(raw);
                  if (id && match) {
                    durationById.set(
                      id,
                      Number(match[1] ?? 0) * 3600 +
                        Number(match[2] ?? 0) * 60 +
                        Number(match[3] ?? 0),
                    );
                  }
                }
              }
            }

            const withDuration = candidates.map((item) => ({
              ...item,
              durationSeconds: durationById.get(item.videoId),
            }));
            const strict = withDuration.filter(
              (item) => item.durationSeconds == null || item.durationSeconds <= 60,
            );
            const items = strict.length > 0 ? strict : withDuration;

            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ items, nextPageToken: body.nextPageToken ?? null }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_shorts_failed",
                message: error instanceof Error ? error.message : "Shorts failed",
              }),
            );
          }
          return;
        }

        if (url.startsWith("/api/youtube/live/details") && req.method === "GET") {
          const params = readSearchParams(url);
          const videoId = (params.get("videoId") ?? "").trim();
          if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "videoId required" }));
            return;
          }
          try {
            const upstreamParams = new URLSearchParams({
              part: "snippet,liveStreamingDetails,statistics",
              id: videoId,
              key,
            });
            const upstream = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?${upstreamParams.toString()}`,
            );
            const body = (await upstream.json()) as {
              items?: Array<{
                id?: string;
                snippet?: {
                  title?: string;
                  channelTitle?: string;
                  channelId?: string;
                  description?: string;
                  liveBroadcastContent?: string;
                  thumbnails?: {
                    medium?: { url?: string };
                    high?: { url?: string };
                    default?: { url?: string };
                  };
                };
                liveStreamingDetails?: {
                  concurrentViewers?: string;
                  activeLiveChatId?: string;
                  scheduledStartTime?: string;
                  actualStartTime?: string;
                };
                statistics?: { viewCount?: string; likeCount?: string };
              }>;
              error?: { message?: string };
            };
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_live_details_failed",
                  message: body.error?.message ?? upstream.statusText,
                }),
              );
              return;
            }
            const item = body.items?.[0];
            if (!item?.id) {
              res.statusCode = 404;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: "video_not_found" }));
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
                const channelParams = new URLSearchParams({
                  part: "snippet,statistics",
                  id: channelId,
                  key,
                });
                const channelRes = await fetch(
                  `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
                );
                if (channelRes.ok) {
                  const channelBody = (await channelRes.json()) as {
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
                    cThumbs?.medium?.url ??
                    cThumbs?.default?.url ??
                    cThumbs?.high?.url ??
                    null;
                  const subs = channel?.statistics?.subscriberCount;
                  subscriberCount = subs ? Number.parseInt(subs, 10) || undefined : undefined;
                  channelDescription = channel?.snippet?.description?.trim() || null;
                  customUrl = channel?.snippet?.customUrl?.trim() || null;
                }
              } catch {
                /* optional */
              }
            }

            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                videoId: item.id,
                title: item.snippet?.title?.trim() || "Untitled",
                description: item.snippet?.description?.trim() || "",
                channelTitle: item.snippet?.channelTitle?.trim() || "YouTube",
                channelId,
                channelThumbnailUrl,
                channelDescription,
                customUrl,
                subscriberCount,
                thumbnailUrl:
                  thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? "",
                isLive: broadcast === "live",
                liveBroadcastContent: broadcast ?? "none",
                concurrentViewers: viewers
                  ? Number.parseInt(viewers, 10) || undefined
                  : undefined,
                activeLiveChatId:
                  item.liveStreamingDetails?.activeLiveChatId?.trim() || null,
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
                  ? `https://www.youtube.com/channel/${channelId}`
                  : null,
              }),
            );
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_live_details_failed",
                message: error instanceof Error ? error.message : "Live details failed",
              }),
            );
          }
          return;
        }

        if (url.startsWith("/api/youtube/live/chat") && req.method === "GET") {
          const params = readSearchParams(url);
          const liveChatId = (params.get("liveChatId") ?? "").trim();
          if (!liveChatId) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "liveChatId required" }));
            return;
          }
          try {
            const pageToken = (params.get("pageToken") ?? "").trim();
            const maxResults = Math.min(
              200,
              Math.max(1, Number.parseInt(params.get("maxResults") ?? "50", 10) || 50),
            );
            const upstreamParams = new URLSearchParams({
              part: "snippet,authorDetails",
              liveChatId,
              maxResults: String(maxResults),
              key,
            });
            if (pageToken) upstreamParams.set("pageToken", pageToken);
            const upstream = await fetch(
              `https://www.googleapis.com/youtube/v3/liveChat/messages?${upstreamParams.toString()}`,
            );
            const body = (await upstream.json()) as {
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
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_live_chat_failed",
                  message: body.error?.message ?? upstream.statusText,
                  reason: body.error?.errors?.[0]?.reason ?? null,
                }),
              );
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
                      : type === "memberMilestoneChatEvent" || type === "newSponsorEvent"
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
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                messages,
                nextPageToken: body.nextPageToken ?? null,
                pollingIntervalMillis: body.pollingIntervalMillis ?? 5000,
                offlineAt: body.offlineAt ?? null,
              }),
            );
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_live_chat_failed",
                message: error instanceof Error ? error.message : "Live chat failed",
              }),
            );
          }
          return;
        }

        if (url.startsWith("/api/youtube/live/chat") && req.method === "POST") {
          try {
            const authHeader = String(req.headers.authorization ?? "").trim();
            const accessToken = authHeader.toLowerCase().startsWith("bearer ")
              ? authHeader.slice(7).trim()
              : "";
            if (!accessToken) {
              res.statusCode = 401;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_oauth_required",
                  message: "Google YouTube access token required to send live chat.",
                  reason: "authRequired",
                }),
              );
              return;
            }
            const payload = (await readJsonBody(req)) as {
              liveChatId?: string;
              messageText?: string;
            };
            const liveChatId = String(payload.liveChatId ?? "").trim();
            const messageText = String(payload.messageText ?? "").trim();
            if (!liveChatId) {
              res.statusCode = 400;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: "liveChatId required" }));
              return;
            }
            if (!messageText) {
              res.statusCode = 400;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: "messageText required" }));
              return;
            }
            if (messageText.length > 200) {
              res.statusCode = 400;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({ error: "message_too_long", message: "Max 200 characters." }),
              );
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
              snippet?: {
                displayMessage?: string;
                textMessageDetails?: { messageText?: string };
              };
              error?: { message?: string; errors?: Array<{ reason?: string }> };
            };
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_live_chat_send_failed",
                  message: body.error?.message ?? upstream.statusText,
                  reason: body.error?.errors?.[0]?.reason ?? null,
                }),
              );
              return;
            }
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                id: body.id ?? `sent-${Date.now()}`,
                message:
                  body.snippet?.displayMessage?.trim() ||
                  body.snippet?.textMessageDetails?.messageText?.trim() ||
                  messageText,
              }),
            );
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_live_chat_send_failed",
                message: error instanceof Error ? error.message : "Live chat send failed",
              }),
            );
          }
          return;
        }

        if (
          (url === "/api/youtube/live" || url.startsWith("/api/youtube/live?")) &&
          req.method === "GET"
        ) {
          const params = readSearchParams(url);
          const eventTypeRaw = (params.get("eventType") ?? "live").trim().toLowerCase();
          const eventType =
            eventTypeRaw === "upcoming" || eventTypeRaw === "completed"
              ? eventTypeRaw
              : "live";
          const q = (params.get("q") ?? "").trim() || "live";
          try {
            const pageToken = (params.get("pageToken") ?? "").trim();
            const maxResults = Math.min(
              25,
              Math.max(1, Number.parseInt(params.get("maxResults") ?? "20", 10) || 20),
            );
            const upstreamParams = new URLSearchParams({
              part: "snippet",
              type: "video",
              eventType,
              q,
              maxResults: String(maxResults),
              order: "viewCount",
              key,
            });
            if (pageToken) upstreamParams.set("pageToken", pageToken);

            const upstream = await fetch(
              `https://www.googleapis.com/youtube/v3/search?${upstreamParams.toString()}`,
            );
            const body = (await upstream.json()) as {
              items?: YoutubeApiSearchItem[];
              nextPageToken?: string;
              error?: { message?: string };
            };

            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_live_failed",
                  message: body.error?.message ?? upstream.statusText,
                }),
              );
              return;
            }

            const candidates = (body.items ?? [])
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
                  isLive: eventType === "live",
                  liveBroadcastContent: eventType as "live" | "upcoming" | "completed",
                };
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item));

            const ids = candidates.map((item) => item.videoId);
            const metaById = new Map<
              string,
              {
                concurrentViewers?: number;
                liveBroadcastContent?: string;
                activeLiveChatId?: string;
              }
            >();
            if (ids.length > 0) {
              const detailsParams = new URLSearchParams({
                part: "liveStreamingDetails,snippet",
                id: ids.join(","),
                key,
              });
              const detailsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
              );
              if (detailsRes.ok) {
                const detailsBody = (await detailsRes.json()) as {
                  items?: Array<{
                    id?: string;
                    snippet?: { liveBroadcastContent?: string };
                    liveStreamingDetails?: {
                      concurrentViewers?: string;
                      activeLiveChatId?: string;
                    };
                  }>;
                };
                for (const item of detailsBody.items ?? []) {
                  const id = item.id?.trim();
                  if (!id) continue;
                  const viewers = item.liveStreamingDetails?.concurrentViewers;
                  const chatId = item.liveStreamingDetails?.activeLiveChatId?.trim();
                  metaById.set(id, {
                    concurrentViewers: viewers
                      ? Number.parseInt(viewers, 10) || undefined
                      : undefined,
                    liveBroadcastContent: item.snippet?.liveBroadcastContent,
                    activeLiveChatId: chatId || undefined,
                  });
                }
              }
            }

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
                isLive: broadcast === "live",
                liveBroadcastContent: broadcast,
                concurrentViewers: meta?.concurrentViewers,
                activeLiveChatId: meta?.activeLiveChatId,
              };
            });

            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ items, nextPageToken: body.nextPageToken ?? null }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_live_failed",
                message: error instanceof Error ? error.message : "Live failed",
              }),
            );
          }
          return;
        }

        if (url.startsWith("/api/youtube/playlist") && req.method === "GET") {
          const params = readSearchParams(url);
          const playlistId = (params.get("playlistId") ?? "").trim();
          if (!playlistId) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "playlistId required" }));
            return;
          }

          try {
            const pageToken = (params.get("pageToken") ?? "").trim();
            const maxResults = Math.min(
              50,
              Math.max(1, Number.parseInt(params.get("maxResults") ?? "50", 10) || 50),
            );
            const upstreamParams = new URLSearchParams({
              part: "snippet,contentDetails",
              playlistId,
              maxResults: String(maxResults),
              key,
            });
            if (pageToken) upstreamParams.set("pageToken", pageToken);

            const upstream = await fetch(
              `https://www.googleapis.com/youtube/v3/playlistItems?${upstreamParams.toString()}`,
            );
            const body = (await upstream.json()) as {
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
                  };
                };
              }>;
              nextPageToken?: string;
              error?: { message?: string };
            };

            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  error: "youtube_playlist_failed",
                  message: body.error?.message ?? upstream.statusText,
                }),
              );
              return;
            }

            const items = (body.items ?? [])
              .map((item) => {
                const videoId =
                  item.contentDetails?.videoId?.trim() ||
                  item.snippet?.resourceId?.videoId?.trim();
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

            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ items, nextPageToken: body.nextPageToken ?? null }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: "youtube_playlist_failed",
                message: error instanceof Error ? error.message : "Playlist failed",
              }),
            );
          }
          return;
        }

        next();
      });
    },
  };
}
