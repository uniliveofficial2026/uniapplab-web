import type { Request, Response, NextFunction } from "express";

/** Server-to-server only — blocks public abuse of internal queues. */
export function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_SECRET?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      res.status(503).json({ error: "internal_api_disabled" });
      return;
    }
    next();
    return;
  }
  const provided = req.headers["x-internal-secret"];
  if (typeof provided !== "string" || provided !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
