import { getSupabaseAnon, getSupabaseService } from "./supabase";
import { verifyFirebaseIdToken } from "./firebaseAuth";

export type MigrateFirebaseInput = {
  firebaseUid: string;
  username?: string;
  displayName?: string;
  profileSetupComplete?: boolean;
  avatarUrl?: string | null;
};

export type MigrateFirebaseResult = {
  supabaseUserId: string;
  accessToken: string;
  refreshToken: string;
};

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

function slugUsername(email: string, uid: string, preferred?: string): string {
  const fromPreferred = preferred?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (fromPreferred && fromPreferred.length >= 3) return fromPreferred.slice(0, 24);
  const base = (email.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (base.length >= 3) return base.slice(0, 24);
  return `user_${uid.replace(/-/g, "").slice(0, 8)}`;
}

async function ensureProfileRow(
  userId: string,
  input: MigrateFirebaseInput,
  email: string,
): Promise<void> {
  const username = slugUsername(email, userId, input.username);
  const displayName = input.displayName?.trim() || username;
  const { error } = await getSupabaseService()
    .from("profiles")
    .upsert(
      {
        id: userId,
        username,
        display_name: displayName,
        avatar_url: input.avatarUrl ?? null,
        bio: "",
        profile_setup_complete: Boolean(input.profileSetupComplete),
        public_user_id: username,
        public_user_id_changed_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) throw error;
}

async function createSessionForEmail(email: string): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  const service = getSupabaseService();
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    throw linkError ?? new Error("generateLink failed");
  }

  const anon = getSupabaseAnon();
  const { data: otpData, error: otpError } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (otpError || !otpData.session?.access_token || !otpData.session.refresh_token) {
    throw otpError ?? new Error("verifyOtp failed");
  }

  const userId = otpData.session.user.id;
  return {
    accessToken: otpData.session.access_token,
    refreshToken: otpData.session.refresh_token,
    userId,
  };
}

/** Link a Firebase-only newcomer to Supabase auth + profile (service role). */
export async function migrateFirebaseUserToSupabase(
  firebaseIdToken: string,
  input: MigrateFirebaseInput,
): Promise<MigrateFirebaseResult> {
  const verified = await verifyFirebaseIdToken(firebaseIdToken);
  if (!verified) {
    throw new Error("invalid_firebase_token");
  }
  if (verified.firebaseUid !== input.firebaseUid.trim()) {
    throw new Error("firebase_uid_mismatch");
  }
  if (!verified.email) {
    throw new Error("firebase_email_required");
  }

  const email = verified.email;
  const service = getSupabaseService();
  let supabaseUserId =
    verified.supabaseUserId ?? (await findAuthUserIdByEmail(email));

  if (!supabaseUserId) {
    const username = slugUsername(email, input.firebaseUid, input.username);
    const displayName = input.displayName?.trim() || username;
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName,
        avatar_url: input.avatarUrl ?? undefined,
        firebase_uid: input.firebaseUid,
      },
    });
    if (createError) {
      const existing = await findAuthUserIdByEmail(email);
      if (!existing) throw createError;
      supabaseUserId = existing;
    } else {
      supabaseUserId = created.user.id;
    }
  }

  await ensureProfileRow(supabaseUserId, input, email);

  const session = await createSessionForEmail(email);
  if (session.userId !== supabaseUserId) {
    supabaseUserId = session.userId;
  }

  return {
    supabaseUserId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
}
