import type { NextFunction, Request, Response } from "express";
import { fetchProfile, getSupabaseAnon } from "../lib/supabase";

export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const { data, error } = await getSupabaseAnon().auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  req.authUser = data.user;
  try {
    req.profile = await fetchProfile(data.user.id);
  } catch {
    req.profile = null;
  }
  next();
}
