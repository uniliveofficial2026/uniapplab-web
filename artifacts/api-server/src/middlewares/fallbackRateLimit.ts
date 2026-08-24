import type { Request, Response, NextFunction } from "express";
import { clientIp, shouldSkipGlobalRateLimit } from "../lib/rateLimitPolicy";

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_HITS = 90;

/** In-memory rate limit when Upstash is not configured (single-instance safety net). */
export function fallbackRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkipGlobalRateLimit(req)) {
    next();
    return;
  }
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
