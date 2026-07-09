import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { fetchFirebaseProfileRecord, isFirestoreAdminAvailable } from "../lib/firestoreAdmin";
import { verifyFirebaseIdToken } from "../lib/firebaseAuth";
import { fetchProfile, getSupabaseAnon, getSupabaseService } from "../lib/supabase";

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseService()
      .schema("auth")
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (error || !data?.id) return null;
    return data.id;
  } catch {
    return null;
  }
}

function syntheticFirebaseUser(verified: {
  firebaseUid: string;
  email: string | null;
}): User {
  return {
    id: verified.firebaseUid,
    email: verified.email ?? undefined,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

async function resolveUserFromFirebaseToken(token: string): Promise<User | null> {
  const verified = await verifyFirebaseIdToken(token);
  if (!verified) return null;

  let userId =
    verified.supabaseUserId ??
    (verified.email ? await findAuthUserIdByEmail(verified.email) : null);

  if (userId) {
    try {
      const { data } = await getSupabaseService().auth.admin.getUserById(userId);
      if (data.user) return data.user;
    } catch {
      /* fall through to Firebase-only lane */
    }
  }

  return syntheticFirebaseUser(verified);
}

async function loadProfile(userId: string) {
  try {
    const profile = await fetchProfile(userId);
    if (profile) return profile;
  } catch {
    /* try Firestore */
  }
  if (isFirestoreAdminAvailable()) {
    return fetchFirebaseProfileRecord(userId);
  }
  return null;
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

  try {
    const { data, error } = await getSupabaseAnon().auth.getUser(token);
    if (!error && data.user) {
      req.authUser = data.user;
      req.profile = await loadProfile(data.user.id);
      next();
      return;
    }
  } catch {
    /* try Firebase */
  }

  const firebaseUser = await resolveUserFromFirebaseToken(token);
  if (!firebaseUser) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  req.authUser = firebaseUser;
  req.profile = await loadProfile(firebaseUser.id);
  next();
}
