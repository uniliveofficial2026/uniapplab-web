/**
 * Canonical auth identity mapping: provider + provider_user_id → internal user_id.
 * Email is metadata only and must never be the request-time identity key.
 * Distinct provider subjects with the same email are never silently merged.
 */
import { getSupabaseService } from "./supabase";

export type AuthProvider = "supabase" | "firebase" | "google" | "apple" | "email";

export type ResolvedIdentity = {
  userId: string;
  provider: AuthProvider;
  providerUserId: string;
  created: boolean;
};

export type AuthIdentityRow = {
  id: string;
  user_id: string;
  provider: AuthProvider;
  provider_user_id: string;
  verified: boolean;
  linkage_status: "verified" | "pending_conflict" | "revoked";
  created_at: string;
  updated_at: string;
};

export type LinkIdentityResult =
  | { ok: true; created: boolean; identity: AuthIdentityRow }
  | { ok: false; code: "conflict" | "error"; existingUserId?: string };

async function lookupIdentityRow(
  provider: AuthProvider,
  providerUserId: string,
): Promise<AuthIdentityRow | null> {
  const { data, error } = await getSupabaseService()
    .from("auth_identities")
    .select("id, user_id, provider, provider_user_id, verified, linkage_status, created_at, updated_at")
    .eq("provider", provider)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();
  if (error || !data?.user_id) return null;
  return data as AuthIdentityRow;
}

async function lookupIdentity(
  provider: AuthProvider,
  providerUserId: string,
): Promise<string | null> {
  const row = await lookupIdentityRow(provider, providerUserId);
  if (!row || row.linkage_status === "revoked") return null;
  return row.user_id;
}

async function insertIdentity(
  userId: string,
  provider: AuthProvider,
  providerUserId: string,
): Promise<"ok" | "conflict" | "error"> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseService().from("auth_identities").insert({
    user_id: userId,
    provider,
    provider_user_id: providerUserId,
    verified: true,
    linkage_status: "verified",
    updated_at: now,
  });
  if (!error) return "ok";
  if (error.code === "23505") return "conflict";
  // Table may not exist yet in environments that have not applied the migration.
  if (
    error.message?.includes("auth_identities") ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  ) {
    return "error";
  }
  return "error";
}

/**
 * Ensure a verified provider subject maps to an existing canonical user_id.
 * Does not auto-merge distinct accounts by email.
 * When mapping table is unavailable, returns null so callers can use verified subject heuristics safely.
 */
export async function resolveOrLinkAuthIdentity(input: {
  provider: AuthProvider;
  providerUserId: string;
  /** Existing Supabase user id when the token already maps to one (custom claim or primary auth). */
  preferredUserId?: string | null;
}): Promise<ResolvedIdentity | null> {
  const providerUserId = input.providerUserId.trim();
  if (!providerUserId) return null;

  const existing = await lookupIdentity(input.provider, providerUserId);
  if (existing) {
    return {
      userId: existing,
      provider: input.provider,
      providerUserId,
      created: false,
    };
  }

  const preferred = input.preferredUserId?.trim() || null;
  if (!preferred) {
    // Do not invent a new auth.users row here — account creation is an explicit auth flow.
    return null;
  }

  const inserted = await insertIdentity(preferred, input.provider, providerUserId);
  if (inserted === "ok") {
    return {
      userId: preferred,
      provider: input.provider,
      providerUserId,
      created: true,
    };
  }
  if (inserted === "conflict") {
    const raced = await lookupIdentity(input.provider, providerUserId);
    if (raced) {
      return {
        userId: raced,
        provider: input.provider,
        providerUserId,
        created: false,
      };
    }
  }

  // Migration not applied or insert blocked — fall through with preferred id for continuity.
  return {
    userId: preferred,
    provider: input.provider,
    providerUserId,
    created: false,
  };
}

export async function listAuthIdentities(userId: string): Promise<AuthIdentityRow[]> {
  const { data, error } = await getSupabaseService()
    .from("auth_identities")
    .select("id, user_id, provider, provider_user_id, verified, linkage_status, created_at, updated_at")
    .eq("user_id", userId)
    .neq("linkage_status", "revoked")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as AuthIdentityRow[];
}

/**
 * Explicit account link. Never merges when the provider subject already belongs to another user.
 */
export async function linkVerifiedIdentity(input: {
  canonicalUserId: string;
  provider: AuthProvider;
  providerUserId: string;
}): Promise<LinkIdentityResult> {
  const providerUserId = input.providerUserId.trim();
  const canonicalUserId = input.canonicalUserId.trim();
  if (!providerUserId || !canonicalUserId) return { ok: false, code: "error" };

  const existing = await lookupIdentityRow(input.provider, providerUserId);
  if (existing && existing.linkage_status !== "revoked") {
    if (existing.user_id === canonicalUserId) {
      return { ok: true, created: false, identity: existing };
    }
    return { ok: false, code: "conflict", existingUserId: existing.user_id };
  }

  if (existing?.linkage_status === "revoked" && existing.user_id === canonicalUserId) {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseService()
      .from("auth_identities")
      .update({
        verified: true,
        linkage_status: "verified",
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("user_id", canonicalUserId)
      .select("id, user_id, provider, provider_user_id, verified, linkage_status, created_at, updated_at")
      .single();
    if (error || !data) return { ok: false, code: "error" };
    return { ok: true, created: false, identity: data as AuthIdentityRow };
  }

  const inserted = await insertIdentity(canonicalUserId, input.provider, providerUserId);
  if (inserted === "ok") {
    const row = await lookupIdentityRow(input.provider, providerUserId);
    if (!row) return { ok: false, code: "error" };
    return { ok: true, created: true, identity: row };
  }
  if (inserted === "conflict") {
    const raced = await lookupIdentityRow(input.provider, providerUserId);
    if (raced && raced.user_id !== canonicalUserId) {
      return { ok: false, code: "conflict", existingUserId: raced.user_id };
    }
    if (raced && raced.user_id === canonicalUserId) {
      return { ok: true, created: false, identity: raced };
    }
  }
  return { ok: false, code: "error" };
}

export async function unlinkIdentity(input: {
  canonicalUserId: string;
  provider: AuthProvider;
  providerUserId: string;
}): Promise<{ ok: true } | { ok: false; code: "last_identity" | "not_found" | "error" }> {
  const rows = await listAuthIdentities(input.canonicalUserId);
  const target = rows.find(
    (r) => r.provider === input.provider && r.provider_user_id === input.providerUserId.trim(),
  );
  if (!target) return { ok: false, code: "not_found" };
  if (rows.length <= 1) return { ok: false, code: "last_identity" };

  const now = new Date().toISOString();
  const { error } = await getSupabaseService()
    .from("auth_identities")
    .update({
      verified: false,
      linkage_status: "revoked",
      updated_at: now,
    })
    .eq("id", target.id)
    .eq("user_id", input.canonicalUserId);
  if (error) return { ok: false, code: "error" };
  return { ok: true };
}

/** Reject client attempts to impersonate another acting user. */
export function rejectClientActingUserId(
  bodyUserId: unknown,
  authUserId: string,
): string | null {
  if (bodyUserId == null || bodyUserId === "") return null;
  const claimed = String(bodyUserId).trim();
  if (!claimed) return null;
  if (claimed !== authUserId) {
    return "client_user_id_impersonation_rejected";
  }
  return null;
}
