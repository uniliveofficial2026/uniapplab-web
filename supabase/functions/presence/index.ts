/**
 * Supabase Edge Function — presence
 * Migrated from artifacts/api-server/src/routes/presence.ts
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireNotBanned } from "../_shared/auth.ts";
import {
  filterOnlineUserIds,
  isUpstashConfigured,
  isUserOnline,
  setUserOnline,
} from "../_shared/upstash.ts";

function parseUserIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(",").map((id) => id.trim()).filter(Boolean);
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const url = new URL(req.url);
  const seg = subPath(url, "presence");
  if (seg[0] !== "online") return json({ error: "not_found" }, 404);

  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  const banned = requireNotBanned(ctx);
  if (banned) return banned;
  const userId = ctx.user.id;

  if (req.method === "GET") {
    if (!isUpstashConfigured()) {
      return json({ online: false, userIds: [], configured: false });
    }
    const ids = parseUserIds(url.searchParams.get("ids"));
    if (!ids.length) {
      const online = await isUserOnline(userId);
      return json({ online, userId, configured: true });
    }
    const onlineIds = await filterOnlineUserIds(ids);
    return json({ userIds: onlineIds, configured: true });
  }

  if (req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as {
      ttlSeconds?: number;
      friendIds?: unknown;
    };
    const ttlSeconds = Math.min(300, Math.max(30, Number(body.ttlSeconds) || 90));
    if (!isUpstashConfigured()) return json({ ok: false, configured: false });
    await setUserOnline(userId, ttlSeconds);
    const friendIds = parseUserIds(body.friendIds);
    if (friendIds.length) {
      const onlineIds = await filterOnlineUserIds(friendIds);
      return json({ ok: true, online: true, userIds: onlineIds, configured: true });
    }
    return json({ ok: true, online: true, userId, configured: true });
  }

  return json({ error: "not_found" }, 404);
});
