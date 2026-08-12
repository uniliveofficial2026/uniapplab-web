type FirebaseLookupUser = {
  localId?: string;
  email?: string;
  customAttributes?: string;
};

export type VerifiedFirebaseUser = {
  firebaseUid: string;
  email: string | null;
  supabaseUserId: string | null;
};

function firebaseApiKey(): string | null {
  const key =
    process.env.FIREBASE_API_KEY?.trim() ||
    process.env.VITE_FIREBASE_API_KEY?.trim() ||
    "";
  return key || null;
}

function parseSupabaseUidFromCustomAttributes(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as { supabase_uid?: string };
    const uid = parsed.supabase_uid?.trim();
    return uid || null;
  } catch {
    return null;
  }
}

/** Verify a Firebase ID token via Identity Toolkit (no extra SDK). */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedFirebaseUser | null> {
  const apiKey = firebaseApiKey();
  if (!apiKey) return null;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!res.ok) return null;

  const body = (await res.json()) as { users?: FirebaseLookupUser[] };
  const user = body.users?.[0];
  if (!user?.localId) return null;

  return {
    firebaseUid: user.localId,
    email: user.email?.trim().toLowerCase() ?? null,
    supabaseUserId: parseSupabaseUidFromCustomAttributes(user.customAttributes),
  };
}
