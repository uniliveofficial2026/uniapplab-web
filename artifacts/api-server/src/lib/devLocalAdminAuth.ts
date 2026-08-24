import { getSupabaseService } from "./supabase";
import { detectAdminEnvironment } from "../domain/admin-control-plane/adminIdentityService";

const DEV_LOCAL_PREFIX = "dev-local.";

function platformAdminUsernames(): Set<string> {
  return new Set(
    String(process.env.PLATFORM_ADMIN_USERNAMES ?? "uniliveofficial2026,oowai20")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function platformAdminEmails(): Set<string> {
  return new Set(
    String(process.env.PLATFORM_ADMIN_EMAILS ?? "uniliveofficial2026@gmail.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isDevLocalAdminToken(token: string): boolean {
  return token.startsWith(DEV_LOCAL_PREFIX);
}

export function devLocalAdminUserId(token: string): string | null {
  if (!isDevLocalAdminToken(token)) return null;
  const userId = token.slice(DEV_LOCAL_PREFIX.length).trim();
  if (!userId) return null;
  if (userId.length >= 8) return userId;
  if (/^u\d+$/i.test(userId)) return userId;
  return null;
}

export function mintDevLocalAdminToken(userId: string): string {
  return `${DEV_LOCAL_PREFIX}${userId}`;
}

export function devLocalAdminAuthEnabled(): boolean {
  return detectAdminEnvironment() === "local";
}

export async function resolveLocalPlatformAdminUser(): Promise<{
  userId: string;
  email: string | null;
  username: string | null;
} | null> {
  const sb = getSupabaseService();
  const usernames = [...platformAdminUsernames()];
  const emails = [...platformAdminEmails()];

  for (const username of usernames) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .maybeSingle();
    if (!error && data?.id) {
      return {
        userId: String(data.id),
        email: null,
        username: data.username ? String(data.username) : username,
      };
    }
  }

  for (const email of emails) {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>;
    const hit = users.find((u) => (u.email || "").trim().toLowerCase() === email);
    if (hit?.id) {
      const profile = await sb.from("profiles").select("username").eq("id", hit.id).maybeSingle();
      return {
        userId: hit.id,
        email: hit.email ?? email,
        username: profile.data?.username ? String(profile.data.username) : null,
      };
    }
  }

  const { data: adminProfile } = await sb
    .from("profiles")
    .select("id, username")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (adminProfile?.id) {
    return {
      userId: String(adminProfile.id),
      email: null,
      username: adminProfile.username ? String(adminProfile.username) : null,
    };
  }

  return null;
}
