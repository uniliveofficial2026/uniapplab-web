import type { Request, Response, NextFunction } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis, isUpstashConfigured } from "./upstash";
import { logger } from "./logger";

let limiter: Ratelimit | null = null;
let upstashDisabledUntilMs = 0;

function getLimiter(): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  if (Date.now() < upstashDisabledUntilMs) return null;
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

function disableUpstashTemporarily(reason: string): void {
  // Avoid hammering a quota-exhausted Redis on every request.
  upstashDisabledUntilMs = Date.now() + 15 * 60 * 1000;
  limiter = null;
  logger.warn({ reason }, "Upstash rate limit disabled temporarily; failing open");
}

export async function upstashRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const path = String(req.originalUrl || req.url || "");
  if (path.includes("/discord/interactions")) {
    next();
    return;
  }
  const rl = getLimiter();
  if (!rl) {
    next();
    return;
  }
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "anon";
  try {
    const { success, remaining } = await rl.limit(ip);
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    if (!success) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/max requests limit exceeded|quota|limit exceeded/i.test(message)) {
      disableUpstashTemporarily(message);
    } else {
      logger.warn({ err }, "Upstash rate limit failed; allowing request");
    }
    next();
  }
}
