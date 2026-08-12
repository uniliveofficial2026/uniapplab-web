import type { NextFunction, Request, Response } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role =
    (req.authUser?.app_metadata as { role?: string } | undefined)?.role ??
    req.profile?.role;
  if (role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}
