import type { Request, Response, NextFunction } from "express";

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_HITS = 90;

function clientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "anon"
  );
}

/** In-memory rate limit when Upstash is not configured (single-instance safety net). */
export function fallbackRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);
  if (bucket.hits.length >= MAX_HITS) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  bucket.hits.push(now);
  buckets.set(ip, bucket);
  next();
}
