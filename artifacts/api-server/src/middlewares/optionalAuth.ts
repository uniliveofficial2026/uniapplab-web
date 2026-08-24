import type { NextFunction, Request, Response } from "express";
import { auth } from "./auth";

/** Authenticate when Bearer is present; otherwise continue as anonymous. Never trust client user_id. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ") || !header.slice("Bearer ".length).trim()) {
    next();
    return;
  }
  await auth(req, res, next);
}
