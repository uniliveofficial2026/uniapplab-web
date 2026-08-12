/**
 * Supabase Edge Function — LiveKit token API.
 * Migrated from Vercel Express (artifacts/api-server/src/routes/livekit.ts).
 * Routes:
 *   GET  /livekit/health
 *   POST /livekit/token        → stream host/viewer token
 *   POST /livekit/chat/token   → 1:1 / group chat call token
 *   POST /livekit/party/token  → party / smule-room token
 *   POST /livekit/webhook      → LiveKit room lifecycle webhook
 *
 * Note: Firestore-only party rooms (no Supabase row) are handled by the
 * transitional Express API; this function resolves party rooms via Supabase.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
} from "npm:livekit-server-sdk@2";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireNotBanned } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

function env(name: string, fallback = ""): string {
  return String(Deno.env.get(name) || fallback).trim();
}

function getLiveKitUrl(): string {
  return env("LIVEKIT_URL", env("VITE_LIVEKIT_URL"));
}

function isLiveKitConfigured(): boolean {
  return Boolean(env("LIVEKIT_API_KEY") && env("LIVEKIT_API_SECRET") && getLiveKitUrl());
}

const streamRoomName = (id: string) => `ic-stream-${id}`;
const partyRoomName = (id: string) => `ic-party-${id}`;
const chatCallRoomName = (threadId: string, callKind = "audio") =>
  `ic-chat-call-${callKind === "video" ? "video" : "audio"}-${threadId}`;

function getRoomService(): RoomServiceClient | null {
  if (!isLiveKitConfigured()) return null;
  return new RoomServiceClient(getLiveKitUrl(), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
}

async function createLiveKitToken(opts: {
  identity: string;
  name?: string;
  room: string;
  role?: "host" | "viewer";
  canPublish?: boolean;
  hidden?: boolean;
}): Promise<string> {
  if (!isLiveKitConfigured()) throw new Error("livekit_not_configured");
  const hidden = Boolean(opts.hidden);
  const publish = hidden ? false : (opts.canPublish ?? opts.role === "host");
  const watchIdentity = hidden
    ? `aw_${String(opts.identity).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36) || "watch"}`
    : opts.identity;
  const at = new AccessToken(env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"), {
    identity: watchIdentity,
    name: hidden ? " " : opts.name || opts.identity,
    ttl: "6h",
  });
  at.addGrant({
    roomJoin: true,
    room: opts.room,
    canPublish: publish,
    canSubscribe: true,
    canPublishData: !hidden,
    hidden,
  });
  return await at.toJwt();
}

async function ensureLiveKitRoom(roomName: string): Promise<boolean> {
  const svc = getRoomService();
  if (!svc) return false;
  const existing = await svc.listRooms([roomName]);
  if (existing?.length) return true;
  await svc.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 50 });
  return true;
}

async function pingLiveKit(): Promise<{ ok: boolean; url?: string; reason?: string }> {
  if (!isLiveKitConfigured()) return { ok: false, reason: "not_configured" };
  try {
    const svc = getRoomService();
    await svc!.listRooms();
    return { ok: true, url: getLiveKitUrl() };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function canGoLive(role: string | undefined): boolean {
  return role === "streamer" || role === "admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const url = new URL(req.url);
  const seg = subPath(url, "livekit");

  // GET /livekit/health — public
  if (req.method === "GET" && seg[0] === "health") {
    if (!isLiveKitConfigured()) return json({ ok: false, configured: false }, 503);
    const result = await pingLiveKit();
    return json({ configured: true, ...result }, result.ok ? 200 : 503);
  }

  // POST /livekit/webhook — LiveKit-signed, no user auth
  if (req.method === "POST" && seg[0] === "webhook") {
    const apiKey = env("LIVEKIT_API_KEY");
    const apiSecret = env("LIVEKIT_API_SECRET");
    if (!apiKey || !apiSecret) return json({ error: "livekit_not_configured" }, 503);

    const receiver = new WebhookReceiver(apiKey, apiSecret);
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ error: "missing authorization" }, 401);
      const body = await req.text();
      const event = await receiver.receive(body, authHeader);
      if (event.event === "room_finished" && event.room?.name?.startsWith("ic-stream-")) {
        const streamId = event.room.name.replace(/^ic-stream-/, "");
        await getSupabaseService()
          .from("streams")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", streamId)
          .eq("status", "live");
      }
      return json({ ok: true });
    } catch {
      return json({ error: "invalid webhook" }, 401);
    }
  }

  // All token routes require auth + not banned.
  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  const banned = requireNotBanned(ctx);
  if (banned) return banned;
  const sb = getSupabaseService();
  const userId = ctx.user.id;
  const displayName = ctx.profile?.display_name || ctx.profile?.username || userId;

  // POST /livekit/token — stream token
  if (req.method === "POST" && seg[0] === "token" && seg.length === 1) {
    if (!isLiveKitConfigured()) return json({ error: "livekit_not_configured" }, 503);
    const { streamId, role = "viewer" } = (await req.json().catch(() => ({}))) as {
      streamId?: string;
      role?: "host" | "viewer";
    };
    if (!streamId) return json({ error: "streamId required" }, 400);

    const { data: stream, error } = await sb
      .from("streams")
      .select("id, user_id, status, title")
      .eq("id", streamId)
      .maybeSingle();
    if (error || !stream) return json({ error: "stream_not_found" }, 404);
    if (stream.status !== "live") return json({ error: "stream_not_live" }, 400);

    const isHost = role === "host";
    if (isHost) {
      if (stream.user_id !== userId) return json({ error: "not_stream_owner" }, 403);
      if (!canGoLive(ctx.profile?.role)) return json({ error: "streamer_role_required" }, 403);
    }

    const roomName = streamRoomName(streamId);
    if (isHost) await ensureLiveKitRoom(roomName);

    const token = await createLiveKitToken({
      identity: userId,
      name: displayName,
      room: roomName,
      role: isHost ? "host" : "viewer",
    });

    return json({
      token,
      url: getLiveKitUrl(),
      roomName,
      streamId,
      role: isHost ? "host" : "viewer",
    });
  }

  // POST /livekit/chat/token
  if (req.method === "POST" && seg[0] === "chat" && seg[1] === "token") {
    if (!isLiveKitConfigured()) return json({ error: "livekit_not_configured" }, 503);
    const { threadId, callKind = "audio" } = (await req.json().catch(() => ({}))) as {
      threadId?: string;
      callKind?: "audio" | "video";
    };
    if (!threadId?.trim()) return json({ error: "threadId required" }, 400);

    const tid = threadId.trim();
    const { data: membership, error } = await sb
      .from("chat_thread_members")
      .select("user_id")
      .eq("thread_id", tid)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !membership) return json({ error: "not_thread_member" }, 403);

    const kind = callKind === "video" ? "video" : "audio";
    const roomName = chatCallRoomName(tid, kind);
    await ensureLiveKitRoom(roomName);

    const token = await createLiveKitToken({
      identity: userId,
      name: displayName,
      room: roomName,
      canPublish: true,
    });

    return json({ token, url: getLiveKitUrl(), roomName, threadId: tid, callKind: kind, publish: true });
  }

  // POST /livekit/party/token
  if (req.method === "POST" && seg[0] === "party" && seg[1] === "token") {
    if (!isLiveKitConfigured()) return json({ error: "livekit_not_configured" }, 503);
    const { roomId, publish = false, hidden = false } = (await req.json().catch(() => ({}))) as {
      roomId?: string;
      publish?: boolean;
      hidden?: boolean;
    };
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) return json({ error: "roomId required" }, 400);

    const { data: partyRoom, error } = await sb
      .from("party_rooms")
      .select("id, status")
      .eq("id", trimmedRoomId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);

    const roomStatus = partyRoom?.status as string | undefined;
    if (!partyRoom) return json({ error: "party_room_not_found" }, 404);
    if (roomStatus && roomStatus !== "active") return json({ error: "party_room_ended" }, 400);

    const roomName = partyRoomName(trimmedRoomId);
    await ensureLiveKitRoom(roomName);

    const wantHidden = Boolean(hidden) && ctx.profile?.role === "admin";
    const canPublish =
      !wantHidden && Boolean(publish) && (!roomStatus || roomStatus === "active");
    const token = await createLiveKitToken({
      identity: userId,
      name: displayName,
      room: roomName,
      canPublish,
      hidden: wantHidden,
    });

    return json({
      token,
      url: getLiveKitUrl(),
      roomName,
      roomId: trimmedRoomId,
      publish: canPublish,
      hidden: wantHidden,
    });
  }

  return json({ error: "not_found" }, 404);
});
