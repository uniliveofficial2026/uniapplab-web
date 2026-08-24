/**
 * YouTube Data API v3 search.list params.
 * Requires YOUTUBE_API_KEY (or VITE_YOUTUBE_API_KEY) on the API server — never send the key from the client.
 */

export type YoutubeSearchType = "video" | "channel" | "playlist" | "all" | "movie" | "episode";
export type YoutubeSearchOrder = "relevance" | "date" | "viewCount" | "rating" | "title" | "videoCount";
export type YoutubeUploadDate = "any" | "hour" | "today" | "week" | "month" | "year";
export type YoutubeVideoDuration = "any" | "short" | "medium" | "long";
export type YoutubeVideoDefinition = "any" | "high" | "standard";
export type YoutubeVideoDimension = "any" | "2d" | "3d";
export type YoutubeVideoCaption = "any" | "closedCaption" | "none";
export type YoutubeVideoLicense = "any" | "creativeCommon" | "youtube";
export type YoutubeEventType = "any" | "completed" | "live" | "upcoming";
export type YoutubeSafeSearch = "moderate" | "none" | "strict";

export type YoutubeSearchFilters = {
  type?: YoutubeSearchType;
  order?: YoutubeSearchOrder;
  uploadDate?: YoutubeUploadDate;
  videoDuration?: YoutubeVideoDuration;
  videoDefinition?: YoutubeVideoDefinition;
  videoDimension?: YoutubeVideoDimension;
  videoCaption?: YoutubeVideoCaption;
  videoLicense?: YoutubeVideoLicense;
  eventType?: YoutubeEventType;
  safeSearch?: YoutubeSafeSearch;
  regionCode?: string;
  relevanceLanguage?: string;
  channelId?: string;
  location?: string;
  locationRadius?: string;
  publishedAfter?: string;
  publishedBefore?: string;
};

export type YoutubeSearchRequest = YoutubeSearchFilters & {
  q?: string;
  pageToken?: string;
  maxResults?: number;
};

const ORDER = new Set<YoutubeSearchOrder>([
  "relevance",
  "date",
  "viewCount",
  "rating",
  "title",
  "videoCount",
]);
const DURATION = new Set<YoutubeVideoDuration>(["any", "short", "medium", "long"]);
const DEFINITION = new Set<YoutubeVideoDefinition>(["any", "high", "standard"]);
const DIMENSION = new Set<YoutubeVideoDimension>(["any", "2d", "3d"]);
const CAPTION = new Set<YoutubeVideoCaption>(["any", "closedCaption", "none"]);
const LICENSE = new Set<YoutubeVideoLicense>(["any", "creativeCommon", "youtube"]);
const EVENT = new Set<YoutubeEventType>(["any", "completed", "live", "upcoming"]);
const SAFE = new Set<YoutubeSafeSearch>(["moderate", "none", "strict"]);
const UPLOAD = new Set<YoutubeUploadDate>(["any", "hour", "today", "week", "month", "year"]);
const TYPE = new Set<YoutubeSearchType>(["video", "channel", "playlist", "all", "movie", "episode"]);

const REGION = /^[A-Za-z]{2}$/;
const LANG = /^[A-Za-z]{2,3}$/;
const CHANNEL_ID = /^UC[\w-]{20,}$/;
const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCATION = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;
const RADIUS = /^\d+(?:\.\d+)?(?:m|km|ft|mi)$/i;

type ParamSource = { get(name: string): string | null };

export function asYoutubeParamSource(query: unknown): ParamSource {
  if (query instanceof URLSearchParams) return query;
  const record = (query ?? {}) as Record<string, unknown>;
  return {
    get(name: string) {
      const value = record[name];
      if (Array.isArray(value)) {
        const first = value[0];
        return first == null ? null : String(first);
      }
      if (value == null) return null;
      return String(value);
    },
  };
}

function pick<T extends string>(value: string, allowed: Set<T>): T | undefined {
  const trimmed = value.trim();
  return allowed.has(trimmed as T) ? (trimmed as T) : undefined;
}

export function publishedAfterForUploadDate(
  uploadDate: YoutubeUploadDate | undefined,
  nowMs = Date.now(),
): string | undefined {
  if (!uploadDate || uploadDate === "any") return undefined;
  const hour = 3_600_000;
  const delta =
    uploadDate === "hour"
      ? hour
      : uploadDate === "today"
        ? 24 * hour
        : uploadDate === "week"
          ? 7 * 24 * hour
          : uploadDate === "month"
            ? 30 * 24 * hour
            : 365 * 24 * hour;
  return new Date(nowMs - delta).toISOString();
}

export function parseYoutubeSearchRequest(query: unknown): YoutubeSearchRequest {
  const src = asYoutubeParamSource(query);
  const maxParsed = Number.parseInt(src.get("maxResults") ?? "20", 10);
  const maxResults = Math.min(25, Math.max(1, Number.isFinite(maxParsed) ? maxParsed : 20));
  const region = (src.get("regionCode") ?? "").trim().toUpperCase();
  const language = (src.get("relevanceLanguage") ?? "").trim().toLowerCase();
  const channelId = (src.get("channelId") ?? "").trim();
  const location = (src.get("location") ?? "").trim();
  const locationRadius = (src.get("locationRadius") ?? "").trim();
  const publishedAfter = (src.get("publishedAfter") ?? "").trim();
  const publishedBefore = (src.get("publishedBefore") ?? "").trim();
  const uploadDate = pick(src.get("uploadDate") ?? "", UPLOAD);

  return {
    q: (src.get("q") ?? "").trim(),
    pageToken: (src.get("pageToken") ?? "").trim() || undefined,
    maxResults,
    type: pick(src.get("type") ?? "", TYPE),
    order: pick(src.get("order") ?? "", ORDER),
    uploadDate,
    videoDuration: pick(src.get("videoDuration") ?? "", DURATION),
    videoDefinition: pick(src.get("videoDefinition") ?? "", DEFINITION),
    videoDimension: pick(src.get("videoDimension") ?? "", DIMENSION),
    videoCaption: pick(src.get("videoCaption") ?? "", CAPTION),
    videoLicense: pick(src.get("videoLicense") ?? "", LICENSE),
    eventType: pick(src.get("eventType") ?? "", EVENT),
    safeSearch: pick(src.get("safeSearch") ?? "", SAFE),
    regionCode: REGION.test(region) ? region : undefined,
    relevanceLanguage: LANG.test(language) ? language : undefined,
    channelId: CHANNEL_ID.test(channelId) ? channelId : undefined,
    location: LOCATION.test(location) ? location : undefined,
    locationRadius: RADIUS.test(locationRadius) ? locationRadius : undefined,
    publishedAfter: RFC3339.test(publishedAfter) ? publishedAfter : undefined,
    publishedBefore: RFC3339.test(publishedBefore) ? publishedBefore : undefined,
  };
}

export function youtubeSearchUsesVideoConstraints(filters: YoutubeSearchFilters): boolean {
  return Boolean(
    (filters.videoDuration && filters.videoDuration !== "any") ||
      (filters.videoDefinition && filters.videoDefinition !== "any") ||
      (filters.videoDimension && filters.videoDimension !== "any") ||
      (filters.videoCaption && filters.videoCaption !== "any") ||
      (filters.videoLicense && filters.videoLicense !== "any") ||
      (filters.eventType && filters.eventType !== "any") ||
      filters.type === "movie" ||
      filters.type === "episode" ||
      filters.location,
  );
}

export function resolveYoutubeSearchListType(filters: YoutubeSearchFilters): string {
  if (filters.type === "all" && !youtubeSearchUsesVideoConstraints(filters)) {
    return "video,channel,playlist";
  }
  if (filters.type === "channel") return "channel";
  if (filters.type === "playlist") return "playlist";
  return "video";
}

export function isYoutubeHomeBrowse(request: YoutubeSearchRequest): boolean {
  if (request.q) return false;
  if (request.channelId) return false;
  if (request.location) return false;
  if (request.publishedAfter || request.publishedBefore) return false;
  if (request.uploadDate && request.uploadDate !== "any") return false;
  if (request.type && request.type !== "video") return false;
  if (request.order && request.order !== "relevance") return false;
  if (request.safeSearch && request.safeSearch !== "moderate") return false;
  if (request.regionCode || request.relevanceLanguage) return false;
  return !youtubeSearchUsesVideoConstraints(request);
}

function appendNonDefault(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
  skip?: string,
) {
  if (!value || value === skip) return;
  params.set(key, value);
}

export function youtubeSearchFiltersToQuery(request: YoutubeSearchRequest): URLSearchParams {
  const params = new URLSearchParams();
  if (request.q) params.set("q", request.q);
  if (request.pageToken) params.set("pageToken", request.pageToken);
  if (request.maxResults && request.maxResults !== 20) {
    params.set("maxResults", String(request.maxResults));
  }
  appendNonDefault(params, "type", request.type, "video");
  appendNonDefault(params, "order", request.order, "relevance");
  appendNonDefault(params, "uploadDate", request.uploadDate, "any");
  appendNonDefault(params, "videoDuration", request.videoDuration, "any");
  appendNonDefault(params, "videoDefinition", request.videoDefinition, "any");
  appendNonDefault(params, "videoDimension", request.videoDimension, "any");
  appendNonDefault(params, "videoCaption", request.videoCaption, "any");
  appendNonDefault(params, "videoLicense", request.videoLicense, "any");
  appendNonDefault(params, "eventType", request.eventType, "any");
  appendNonDefault(params, "safeSearch", request.safeSearch, "moderate");
  appendNonDefault(params, "regionCode", request.regionCode);
  appendNonDefault(params, "relevanceLanguage", request.relevanceLanguage);
  appendNonDefault(params, "channelId", request.channelId);
  appendNonDefault(params, "location", request.location);
  appendNonDefault(params, "locationRadius", request.locationRadius);
  appendNonDefault(params, "publishedAfter", request.publishedAfter);
  appendNonDefault(params, "publishedBefore", request.publishedBefore);
  return params;
}

export function youtubeSearchCacheKey(request: YoutubeSearchRequest): string {
  const params = youtubeSearchFiltersToQuery(request);
  params.sort();
  return `search:v3:${params.toString() || "home"}`;
}

export function buildYoutubeSearchListParams(
  request: YoutubeSearchRequest,
  apiKey: string,
  nowMs = Date.now(),
): URLSearchParams {
  const type = resolveYoutubeSearchListType(request);
  const params = new URLSearchParams({
    part: "snippet",
    type,
    maxResults: String(request.maxResults ?? 20),
    key: apiKey,
  });
  if (request.q) params.set("q", request.q);
  if (request.pageToken) params.set("pageToken", request.pageToken);
  if (request.order && request.order !== "relevance") params.set("order", request.order);
  if (request.safeSearch) params.set("safeSearch", request.safeSearch);
  if (request.regionCode) params.set("regionCode", request.regionCode);
  if (request.relevanceLanguage) params.set("relevanceLanguage", request.relevanceLanguage);
  if (request.channelId) params.set("channelId", request.channelId);

  const publishedAfter =
    request.publishedAfter || publishedAfterForUploadDate(request.uploadDate, nowMs);
  if (publishedAfter) params.set("publishedAfter", publishedAfter);
  if (request.publishedBefore) params.set("publishedBefore", request.publishedBefore);

  if (type === "video") {
    if (request.videoDuration && request.videoDuration !== "any") {
      params.set("videoDuration", request.videoDuration);
    }
    if (request.videoDefinition && request.videoDefinition !== "any") {
      params.set("videoDefinition", request.videoDefinition);
    }
    if (request.videoDimension && request.videoDimension !== "any") {
      params.set("videoDimension", request.videoDimension);
    }
    if (request.videoCaption && request.videoCaption !== "any") {
      params.set("videoCaption", request.videoCaption);
    }
    if (request.videoLicense && request.videoLicense !== "any") {
      params.set("videoLicense", request.videoLicense);
    }
    if (request.eventType && request.eventType !== "any") {
      params.set("eventType", request.eventType);
    }
    if (request.type === "movie") params.set("videoType", "movie");
    if (request.type === "episode") params.set("videoType", "episode");
    if (request.location) {
      params.set("location", request.location);
      params.set("locationRadius", request.locationRadius || "10km");
    }
  }

  return params;
}
