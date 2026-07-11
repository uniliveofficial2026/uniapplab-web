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

        if (url.startsWith("/api/youtube/search") && req.method === "GET") {
          const params = readSearchParams(url);
          const q = (params.get("q") ?? "").trim();
          if (!q) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "q required" }));
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
