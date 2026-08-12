import type { NextFunction, Request, Response } from "express";

export function requireNotBanned(req: Request, res: Response, next: NextFunction): void {
  if (req.profile?.banned_at) {
    res.status(403).json({ error: "Account banned", reason: req.profile.ban_reason });
    return;
  }
  next();
}
