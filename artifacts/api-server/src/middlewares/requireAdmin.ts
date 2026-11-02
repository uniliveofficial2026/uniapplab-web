import type { NextFunction, Request, Response } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.profile?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}
