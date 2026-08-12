/**
 * Supabase Edge Function — admin API.
 * Migrated from Vercel Express (artifacts/api-server/src/routes/admin.ts).
 * All routes require an authenticated admin.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

async function countTable(
  table: string,
  filter?: { column: string; value: string },
  idColumn = "id",
): Promise<number> {
  let query = getSupabaseService().from(table).select(idColumn, { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function envPresent(key: string): boolean {
  return Boolean(String(Deno.env.get(key) ?? "").trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const url = new URL(req.url);
  const seg = subPath(url, "admin");
  const q = String(url.searchParams.get("q") ?? "").trim();

  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  const adminErr = requireAdmin(ctx);
  if (adminErr) return adminErr;

  const sb = getSupabaseService();
  const path = seg.join("/");

  try {
    // GET /admin/overview
    if (req.method === "GET" && path === "overview") {
      const [
        users,
        postsRes,
        comments,
        chatMessages,
        liveStreams,
        activePartyRooms,
        giftMessages,
        wallets,
      ] = await Promise.all([
        countTable("profiles"),
        sb.from("posts").select("id, payload"),
        countTable("social_comments"),
        countTable("chat_messages"),
        countTable("streams", { column: "status", value: "live" }),
        countTable("party_rooms", { column: "status", value: "active" }),
        countTable("party_room_messages", { column: "kind", value: "gift" }),
        countTable("wallets", undefined, "user_id"),
      ]);
      const posts = postsRes.data ?? [];
      const reels = posts.filter((row) => {
        const payload = row.payload as Record<string, unknown> | null;
        return payload?.contentKind === "reel";
      }).length;
      return json({
        users,
        posts: posts.length,
        reels,
        comments,
        chatMessages,
        liveStreams,
        activePartyRooms,
        giftMessages,
        wallets,
      });
    }

    // GET /admin/users
    if (req.method === "GET" && path === "users") {
      let query = sb
        .from("profiles")
        .select("id, username, display_name, role, banned_at, ban_reason, muted_until, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ users: data ?? [] });
    }

    // POST /admin/users/:id/ban
    if (req.method === "POST" && seg[0] === "users" && seg[2] === "ban") {
      const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
      const { data, error } = await sb
        .from("profiles")
        .update({
          banned_at: new Date().toISOString(),
          ban_reason: reason?.slice(0, 500) ?? "Banned by admin",
        })
        .eq("id", seg[1])
        .select("id, banned_at, ban_reason")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // POST /admin/users/:id/unban
    if (req.method === "POST" && seg[0] === "users" && seg[2] === "unban") {
      const { data, error } = await sb
        .from("profiles")
        .update({ banned_at: null, ban_reason: null })
        .eq("id", seg[1])
        .select("id, banned_at")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // PATCH /admin/users/:id/role
    if (req.method === "PATCH" && seg[0] === "users" && seg[2] === "role") {
      const { role } = (await req.json().catch(() => ({}))) as { role?: string };
      if (!role || !["user", "streamer", "admin"].includes(role)) {
        return json({ error: "Invalid role" }, 400);
      }
      const { data, error } = await sb
        .from("profiles")
        .update({ role })
        .eq("id", seg[1])
        .select("id, role")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // POST /admin/users/:id/mute
    if (req.method === "POST" && seg[0] === "users" && seg[2] === "mute") {
      const { minutes } = (await req.json().catch(() => ({}))) as { minutes?: number };
      const mins = Math.max(1, Math.min(60 * 24 * 30, Math.floor(minutes ?? 60)));
      const until = new Date(Date.now() + mins * 60_000).toISOString();
      const { data, error } = await sb
        .from("profiles")
        .update({ muted_until: until })
        .eq("id", seg[1])
        .select("id, muted_until")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // GET /admin/content/posts
    if (req.method === "GET" && path === "content/posts") {
      let query = sb
        .from("posts")
        .select(
          "id, author_id, payload, is_archived, created_at, author:profiles!posts_author_id_fkey(username, display_name)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (q) query = query.or(`id.ilike.%${q}%,payload->>caption.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      const items = (data ?? []).filter((row) => {
        const payload = row.payload as Record<string, unknown> | null;
        return payload?.contentKind !== "reel";
      });
      return json({ items });
    }

    // GET /admin/content/reels
    if (req.method === "GET" && path === "content/reels") {
      let query = sb
        .from("posts")
        .select(
          "id, author_id, payload, is_archived, created_at, author:profiles!posts_author_id_fkey(username, display_name)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (q) query = query.or(`id.ilike.%${q}%,payload->>caption.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      const items = (data ?? []).filter((row) => {
        const payload = row.payload as Record<string, unknown> | null;
        return payload?.contentKind === "reel";
      });
      return json({ items });
    }

    // PATCH /admin/content/posts/:id
    if (req.method === "PATCH" && seg[0] === "content" && seg[1] === "posts" && seg[2]) {
      const { archived } = (await req.json().catch(() => ({}))) as { archived?: boolean };
      const { data, error } = await sb
        .from("posts")
        .update({ is_archived: Boolean(archived) })
        .eq("id", seg[2])
        .select("id, is_archived")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // GET /admin/content/comments
    if (req.method === "GET" && path === "content/comments") {
      let query = sb
        .from("social_comments")
        .select(
          "id, target_kind, target_id, author_id, body, created_at, author:profiles!social_comments_author_id_fkey(username, display_name)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (q) query = query.or(`body.ilike.%${q}%,target_id.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ items: data ?? [] });
    }

    // DELETE /admin/content/comments/:id
    if (req.method === "DELETE" && seg[0] === "content" && seg[1] === "comments" && seg[2]) {
      const { error } = await sb.from("social_comments").delete().eq("id", seg[2]);
      if (error) return json({ error: error.message }, 400);
      return noContent();
    }

    // GET /admin/chat/messages
    if (req.method === "GET" && path === "chat/messages") {
      let query = sb
        .from("chat_messages")
        .select("id, thread_id, sender_id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (q) query = query.ilike("body", `%${q}%`);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ items: data ?? [] });
    }

    // DELETE /admin/chat/messages/:id
    if (req.method === "DELETE" && seg[0] === "chat" && seg[1] === "messages" && seg[2]) {
      const { error } = await sb.from("chat_messages").delete().eq("id", seg[2]);
      if (error) return json({ error: error.message }, 400);
      return noContent();
    }

    // GET /admin/wallet/users
    if (req.method === "GET" && path === "wallet/users") {
      let query = sb
        .from("wallets")
        .select("user_id, balance, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (q) {
        const { data: profiles } = await sb
          .from("profiles")
          .select("id")
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
          .limit(20);
        const ids = (profiles ?? []).map((p) => p.id);
        if (ids.length === 0) return json({ items: [] });
        query = query.in("user_id", ids);
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ items: data ?? [] });
    }

    // GET /admin/wallet/transactions
    if (req.method === "GET" && path === "wallet/transactions") {
      const { data, error } = await sb
        .from("wallet_transactions")
        .select("id, from_user, to_user, amount, tx_type, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 400);
      return json({ items: data ?? [] });
    }

    // GET /admin/streams
    if (req.method === "GET" && path === "streams") {
      const status = String(url.searchParams.get("status") ?? "live");
      let query = sb
        .from("streams")
        .select("id, user_id, title, status, started_at, ended_at")
        .order("started_at", { ascending: false })
        .limit(50);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      const rows = data ?? [];
      const hostIds = [...new Set(rows.map((r) => String(r.user_id)).filter(Boolean))];
      const partyByOwner = new Map<
        string,
        { id: string; privacy: string | null; room_mode: string | null }
      >();
      if (hostIds.length > 0) {
        const { data: parties } = await sb
          .from("party_rooms")
          .select("id, owner_id, privacy, room_mode, status")
          .in("owner_id", hostIds)
          .eq("status", "active")
          .limit(120);
        for (const party of parties ?? []) {
          const ownerId = String(party.owner_id);
          if (partyByOwner.has(ownerId)) continue;
          partyByOwner.set(ownerId, {
            id: String(party.id),
            privacy: (party.privacy as string | null) ?? null,
            room_mode: (party.room_mode as string | null) ?? null,
          });
        }
      }
      return json({
        items: rows.map((row) => {
          const party = partyByOwner.get(String(row.user_id));
          return {
            ...row,
            privacy: party?.privacy ?? "Public",
            party_room_id: party?.id ?? null,
            room_mode: party?.room_mode ?? null,
          };
        }),
      });
    }

    // POST /admin/streams/:id/stop
    if (req.method === "POST" && seg[0] === "streams" && seg[2] === "stop") {
      const streamId = String(seg[1] ?? "");
      const { data: stream, error: streamErr } = await sb
        .from("streams")
        .select("id, user_id, status")
        .eq("id", streamId)
        .maybeSingle();
      if (streamErr) return json({ error: streamErr.message }, 400);
      if (!stream) return json({ error: "stream_not_found" }, 404);

      const { data, error } = await sb
        .from("streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", streamId)
        .select("id, status, ended_at, user_id")
        .single();
      if (error) return json({ error: error.message }, 400);

      let endedPartyRoomIds: string[] = [];
      if (stream.user_id) {
        const { data: parties } = await sb
          .from("party_rooms")
          .select("id")
          .eq("owner_id", stream.user_id)
          .eq("status", "active");
        endedPartyRoomIds = (parties ?? []).map((row) => String(row.id));
        if (endedPartyRoomIds.length > 0) {
          await sb
            .from("party_rooms")
            .update({ status: "ended", updated_at: new Date().toISOString() })
            .in("id", endedPartyRoomIds);
        }
      }
      return json({ ...data, endedPartyRoomIds });
    }

    // POST /admin/streams/:id/ban — stop live + ban host
    if (req.method === "POST" && seg[0] === "streams" && seg[2] === "ban") {
      const streamId = String(seg[1] ?? "");
      const body = (await req.json().catch(() => ({}))) as { reason?: string };
      const reason =
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim().slice(0, 500)
          : "Live stream banned by platform admin";

      const { data: stream, error: streamErr } = await sb
        .from("streams")
        .select("id, user_id")
        .eq("id", streamId)
        .maybeSingle();
      if (streamErr) return json({ error: streamErr.message }, 400);
      if (!stream?.user_id) return json({ error: "stream_not_found" }, 404);

      const hostId = String(stream.user_id);
      const { data: stopped, error } = await sb
        .from("streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", streamId)
        .select("id, status, ended_at, user_id")
        .single();
      if (error) return json({ error: error.message }, 400);

      const { data: parties } = await sb
        .from("party_rooms")
        .select("id")
        .eq("owner_id", hostId)
        .eq("status", "active");
      const endedPartyRoomIds = (parties ?? []).map((row) => String(row.id));
      if (endedPartyRoomIds.length > 0) {
        await sb
          .from("party_rooms")
          .update({ status: "ended", updated_at: new Date().toISOString() })
          .in("id", endedPartyRoomIds);
      }

      const { data: banned, error: banErr } = await sb
        .from("profiles")
        .update({
          banned_at: new Date().toISOString(),
          ban_reason: reason,
        })
        .eq("id", hostId)
        .select("id, banned_at, ban_reason")
        .single();
      if (banErr) return json({ error: banErr.message }, 400);

      return json({ stream: stopped, ban: banned, endedPartyRoomIds });
    }

    // GET /admin/party-rooms/gifts  (must precede generic party-rooms match)
    if (req.method === "GET" && path === "party-rooms/gifts") {
      const { data, error } = await sb
        .from("party_room_messages")
        .select("id, room_id, sender_id, sender_name, body, kind, meta, created_at")
        .eq("kind", "gift")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 400);
      return json({ items: data ?? [] });
    }

    // GET /admin/party-rooms
    if (req.method === "GET" && path === "party-rooms") {
      const mode = String(url.searchParams.get("mode") ?? "").trim();
      let query = sb
        .from("party_rooms")
        .select("id, owner_id, room_name, room_mode, status, participant_count, created_at, privacy")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (mode) query = query.ilike("room_mode", `%${mode}%`);
      if (q) query = query.or(`room_name.ilike.%${q}%,id.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ items: data ?? [] });
    }

    // POST /admin/party-rooms/:id/end
    if (req.method === "POST" && seg[0] === "party-rooms" && seg[2] === "end") {
      const roomId = String(seg[1] ?? "");
      const body = (await req.json().catch(() => ({}))) as { hostUserId?: string };
      const { data: room } = await sb
        .from("party_rooms")
        .select("id, owner_id")
        .eq("id", roomId)
        .maybeSingle();
      const ownerId =
        room?.owner_id ||
        (typeof body.hostUserId === "string" && body.hostUserId.trim()
          ? body.hostUserId.trim()
          : "");
      if (!room && !ownerId) return json({ error: "party_room_not_found" }, 404);

      let data = room;
      if (room) {
        const updated = await sb
          .from("party_rooms")
          .update({ status: "ended", updated_at: new Date().toISOString() })
          .eq("id", roomId)
          .select("id, status, owner_id")
          .maybeSingle();
        if (updated.error) return json({ error: updated.error.message }, 400);
        data = updated.data;
      }
      if (ownerId) {
        await sb
          .from("streams")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("user_id", ownerId)
          .eq("status", "live");
        await sb
          .from("party_rooms")
          .update({ status: "ended", updated_at: new Date().toISOString() })
          .eq("owner_id", ownerId)
          .eq("status", "active");
      }
      return json(data ?? { id: roomId, status: "ended", owner_id: ownerId || null });
    }

    // POST /admin/party-rooms/:id/ban — end room + ban owner
    if (req.method === "POST" && seg[0] === "party-rooms" && seg[2] === "ban") {
      const roomId = String(seg[1] ?? "");
      const body = (await req.json().catch(() => ({}))) as {
        reason?: string;
        hostUserId?: string;
      };
      const reason =
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim().slice(0, 500)
          : "Live room banned by platform admin";

      const { data: room, error: roomErr } = await sb
        .from("party_rooms")
        .select("id, owner_id")
        .eq("id", roomId)
        .maybeSingle();
      if (roomErr) return json({ error: roomErr.message }, 400);
      const ownerId =
        room?.owner_id ||
        (typeof body.hostUserId === "string" && body.hostUserId.trim()
          ? body.hostUserId.trim()
          : "");
      if (!ownerId) return json({ error: "party_room_not_found" }, 404);

      let ended = room;
      if (room) {
        const updated = await sb
          .from("party_rooms")
          .update({ status: "ended", updated_at: new Date().toISOString() })
          .eq("id", roomId)
          .select("id, status, owner_id")
          .maybeSingle();
        if (updated.error) return json({ error: updated.error.message }, 400);
        ended = updated.data;
      }

      await sb
        .from("streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("user_id", ownerId)
        .eq("status", "live");
      await sb
        .from("party_rooms")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("owner_id", ownerId)
        .eq("status", "active");

      const { data: banned, error: banErr } = await sb
        .from("profiles")
        .update({
          banned_at: new Date().toISOString(),
          ban_reason: reason,
        })
        .eq("id", ownerId)
        .select("id, banned_at, ban_reason")
        .single();
      if (banErr) return json({ error: banErr.message }, 400);

      return json({
        room: ended ?? { id: roomId, status: "ended", owner_id: ownerId },
        ban: banned,
      });
    }

    // GET /admin/integrations/status
    if (req.method === "GET" && path === "integrations/status") {
      return json({
        services: [
          {
            id: "supabase",
            configured: envPresent("SUPABASE_URL") || envPresent("VITE_SUPABASE_URL"),
            serverKeys: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
          },
          {
            id: "livekit",
            configured: envPresent("LIVEKIT_URL") || envPresent("VITE_LIVEKIT_URL"),
            serverKeys: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
          },
          {
            id: "trtc",
            configured: envPresent("VITE_TENCENT_WEBAR_APP_ID"),
            serverKeys: ["VITE_TENCENT_WEBAR_APP_ID", "VITE_TENCENT_WEBAR_LICENSE_KEY", "VITE_TENCENT_WEBAR_TOKEN"],
          },
          {
            id: "trtc-mobile",
            configured:
              envPresent("VITE_TENCENT_LICENSE_URL") && envPresent("VITE_TENCENT_LICENSE_KEY"),
            serverKeys: [
              "VITE_TENCENT_APP_ID",
              "VITE_TENCENT_LICENSE_URL",
              "VITE_TENCENT_LICENSE_KEY",
              "VITE_TENCENT_BUNDLE_ID",
            ],
          },
          {
            id: "tencent-rtc",
            configured:
              envPresent("VITE_TENCENT_RTC_SDK_APP_ID") && envPresent("TENCENT_RTC_SECRET_KEY"),
            serverKeys: ["VITE_TENCENT_RTC_SDK_APP_ID", "TENCENT_RTC_SECRET_KEY"],
          },
          {
            id: "deepar",
            configured: envPresent("VITE_DEEPAR_LICENSE_KEY"),
            serverKeys: ["VITE_DEEPAR_LICENSE_KEY"],
          },
        ],
      });
    }

    return json({ error: "not_found" }, 404);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
