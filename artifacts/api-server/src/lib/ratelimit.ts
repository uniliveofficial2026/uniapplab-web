import type { Request, Response, NextFunction } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis, isUpstashConfigured } from "./upstash";

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  const redis = getRedis();
  if (!redis) return null;
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      prefix: "ic:rl",
    });
  }
  return limiter;
}

export async function upstashRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rl = getLimiter();
  if (!rl) {
    next();
    return;
  }
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "anon";
  const { success, remaining } = await rl.limit(ip);
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  if (!success) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  next();
}
