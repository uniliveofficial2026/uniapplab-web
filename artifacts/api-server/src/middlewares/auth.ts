import type { NextFunction, Request, Response } from "express";
import { fetchProfile, getSupabaseAnon, getSupabaseService } from "../lib/supabase";
import { verifyFirebaseIdToken } from "../lib/firebaseAuth";

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await getSupabaseService()
    .schema("auth")
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

async function resolveUserFromFirebaseToken(token: string) {
  const verified = await verifyFirebaseIdToken(token);
  if (!verified) return null;

  const userId =
    verified.supabaseUserId ??
    (verified.email ? await findAuthUserIdByEmail(verified.email) : null);
  if (!userId) return null;

  const { data } = await getSupabaseService().auth.admin.getUserById(userId);
  return data.user ?? null;
}

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
  if (!error && data.user) {
    req.authUser = data.user;
    try {
      req.profile = await fetchProfile(data.user.id);
    } catch {
      req.profile = null;
    }
    next();
    return;
  }

  const firebaseUser = await resolveUserFromFirebaseToken(token);
  if (!firebaseUser) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  req.authUser = firebaseUser;
  try {
    req.profile = await fetchProfile(firebaseUser.id);
  } catch {
    req.profile = null;
  }
  next();
}
