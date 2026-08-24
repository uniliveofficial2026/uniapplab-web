import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { fetchFirebaseProfileRecord, isFirestoreAdminAvailable } from "../lib/firestoreAdmin";
import { verifyFirebaseIdToken } from "../lib/firebaseAuth";
import { resolveOrLinkAuthIdentity } from "../lib/authIdentities";
import { fetchProfile, getSupabaseAnon, getSupabaseService } from "../lib/supabase";
import {
  devLocalAdminAuthEnabled,
  devLocalAdminUserId,
  isDevLocalAdminToken,
} from "../lib/devLocalAdminAuth";
import { apiError } from "../lib/apiError";
import { endPerfSpan, startPerfSpan } from "../lib/performance/spans";
import { detectAdminEnvironment } from "../domain/admin-control-plane/adminIdentityService";

function readRequestToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  if (detectAdminEnvironment() === "local") {
    const queryToken = req.query.access_token;
    if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();
  }
  return null;
}

function syntheticUser(id: string, email: string | null): User {
  return {
    id,
    email: email ?? undefined,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

async function loadAuthUser(userId: string): Promise<User | null> {
  try {
    const { data } = await getSupabaseService().auth.admin.getUserById(userId);
    if (data.user) return data.user;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Firebase token → verified provider subject → auth_identities → canonical user_id.
 * Email is never used as the identity key.
 */
async function resolveUserFromFirebaseToken(token: string): Promise<User | null> {
  const verified = await verifyFirebaseIdToken(token);
  if (!verified) return null;

  const preferred =
    verified.supabaseUserId?.trim() ||
    null;

  const mapped = await resolveOrLinkAuthIdentity({
    provider: "firebase",
    providerUserId: verified.firebaseUid,
    preferredUserId: preferred,
  });

  if (mapped?.userId) {
    const user = await loadAuthUser(mapped.userId);
    if (user) return user;
    // Known mapping but admin API unavailable — still use canonical id.
    return syntheticUser(mapped.userId, verified.email);
  }

  // No preferred Supabase id and no prior mapping: use Firebase subject as session id
  // only when explicitly linked via custom claim later. Refuse silent email merges.
  if (preferred) {
    const user = await loadAuthUser(preferred);
    if (user) return user;
  }

  return syntheticUser(verified.firebaseUid, verified.email);
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

type AuthCacheEntry = { user: User; profile: Awaited<ReturnType<typeof loadProfile>>; exp: number };
const AUTH_RESULT_TTL_MS = 5_000;
const authResultCache = new Map<string, AuthCacheEntry>();

function authCacheKey(token: string): string {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${token.length}:${(h >>> 0).toString(16)}`;
}

function readAuthCache(token: string): AuthCacheEntry | null {
  const hit = authResultCache.get(authCacheKey(token));
  if (!hit || hit.exp <= Date.now()) {
    if (hit) authResultCache.delete(authCacheKey(token));
    return null;
  }
  return hit;
}

function writeAuthCache(token: string, user: User, profile: AuthCacheEntry["profile"]): void {
  if (authResultCache.size > 500) authResultCache.clear();
  authResultCache.set(authCacheKey(token), { user, profile, exp: Date.now() + AUTH_RESULT_TTL_MS });
}

export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  startPerfSpan(req, "auth");
  const token = readRequestToken(req);
  if (!token) {
    endPerfSpan(req, "auth");
    apiError(res, 401, "error.unauthorized");
    return;
  }

  // Reject body/query impersonation of acting user when present on authenticated routes.
  const body = req.body as { userId?: unknown; user_id?: unknown } | undefined;
  const queryUserId = req.query.userId ?? req.query.user_id;

  const cached = readAuthCache(token);
  if (cached) {
    req.authUser = cached.user;
    req.profile = cached.profile;
    const claimed = body?.userId ?? body?.user_id ?? queryUserId;
    if (claimed != null && String(claimed).trim() && String(claimed).trim() !== cached.user.id) {
      endPerfSpan(req, "auth");
      apiError(res, 403, "error.impersonation");
      return;
    }
    endPerfSpan(req, "auth");
    next();
    return;
  }

  if (devLocalAdminAuthEnabled() && isDevLocalAdminToken(token)) {
    const userId = devLocalAdminUserId(token);
    if (!userId) {
      endPerfSpan(req, "auth");
      apiError(res, 401, "error.invalidToken");
      return;
    }
    const user = (await loadAuthUser(userId)) ?? syntheticUser(userId, null);
    req.authUser = user;
    req.profile = await loadProfile(userId);
    writeAuthCache(token, user, req.profile);
    endPerfSpan(req, "auth");
    next();
    return;
  }

  try {
    const { data, error } = await getSupabaseAnon().auth.getUser(token);
    if (!error && data.user) {
      // Ensure supabase provider mapping exists for this subject.
      void resolveOrLinkAuthIdentity({
        provider: "supabase",
        providerUserId: data.user.id,
        preferredUserId: data.user.id,
      });
      req.authUser = data.user;
      req.profile = await loadProfile(data.user.id);
      writeAuthCache(token, data.user, req.profile);

      const claimed = body?.userId ?? body?.user_id ?? queryUserId;
      if (claimed != null && String(claimed).trim() && String(claimed).trim() !== data.user.id) {
        endPerfSpan(req, "auth");
        apiError(res, 403, "error.impersonation");
        return;
      }

      endPerfSpan(req, "auth");
      next();
      return;
    }
  } catch {
    /* try Firebase */
  }

  const firebaseUser = await resolveUserFromFirebaseToken(token);
  if (!firebaseUser) {
    endPerfSpan(req, "auth");
    apiError(res, 401, "error.invalidToken");
    return;
  }

  req.authUser = firebaseUser;
  req.profile = await loadProfile(firebaseUser.id);
  writeAuthCache(token, firebaseUser, req.profile);

  const claimed = body?.userId ?? body?.user_id ?? queryUserId;
  if (claimed != null && String(claimed).trim() && String(claimed).trim() !== firebaseUser.id) {
    endPerfSpan(req, "auth");
    apiError(res, 403, "error.impersonation");
    return;
  }

  endPerfSpan(req, "auth");
  next();
}
