/**
 * Supabase Edge Function — stream
 * Migrated from artifacts/api-server/src/routes/stream.ts
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { RoomServiceClient } from "npm:livekit-server-sdk@2";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireNotBanned } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";
import {
  decrStreamViewers,
  getStreamViewers,
  incrStreamViewers,
  isUpstashConfigured,
} from "../_shared/upstash.ts";

function env(name: string, fallback = ""): string {
  return String(Deno.env.get(name) || fallback).trim();
}

function canGoLive(role: string | undefined): boolean {
  return role === "streamer" || role === "admin";
}

function isLiveKitConfigured(): boolean {
  return Boolean(env("LIVEKIT_API_KEY") && env("LIVEKIT_API_SECRET") && env("LIVEKIT_URL", env("VITE_LIVEKIT_URL")));
}

async function deleteLiveKitRoom(roomName: string): Promise<void> {
  if (!isLiveKitConfigured()) return;
  try {
    const svc = new RoomServiceClient(
      env("LIVEKIT_URL", env("VITE_LIVEKIT_URL")),
      env("LIVEKIT_API_KEY"),
      env("LIVEKIT_API_SECRET"),
    );
    await svc.deleteRoom(roomName);
  } catch {
    /* room may already be gone */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const url = new URL(req.url);
  const seg = subPath(url, "stream");
  const sb = getSupabaseService();

  // GET /stream/live — public
  if (req.method === "GET" && seg[0] === "live") {
    const { data, error } = await sb
      .from("streams")
      .select("id, user_id, title, status, started_at")
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) return json({ error: error.message }, 400);
    return json({ streams: data ?? [] });
  }

  // GET /stream/:id/viewers — public
  if (req.method === "GET" && seg[0] && seg[1] === "viewers") {
    const streamId = seg[0];
    if (!isUpstashConfigured()) return json({ streamId, viewers: 0, configured: false });
    const viewers = await getStreamViewers(streamId);
    return json({ streamId, viewers, configured: true });
  }

  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  const banned = requireNotBanned(ctx);
  if (banned) return banned;
  const userId = ctx.user.id;

  if (req.method === "POST" && seg[0] === "start") {
    if (!canGoLive(ctx.profile?.role)) return json({ error: "Streamer role required" }, 403);
    const { title } = (await req.json().catch(() => ({}))) as { title?: string };
    const { data, error } = await sb
      .from("streams")
      .insert({
        user_id: userId,
        title: title?.slice(0, 120) ?? "Live",
        status: "live",
      })
      .select("id, user_id, title, status, started_at")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json(data, 201);
  }

  if (req.method === "POST" && seg[0] === "stop") {
    const { streamId } = (await req.json().catch(() => ({}))) as { streamId?: string };
    if (!streamId) return json({ error: "streamId required" }, 400);
    const { data: stream } = await sb.from("streams").select("user_id").eq("id", streamId).maybeSingle();
    const isOwner = stream?.user_id === userId;
    const isAdmin = ctx.profile?.role === "admin";
    if (!isOwner && !isAdmin) return json({ error: "Not allowed" }, 403);
    const { data, error } = await sb
      .from("streams")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", streamId)
      .select("id, status, ended_at")
      .single();
    if (error) return json({ error: error.message }, 400);
    await deleteLiveKitRoom(`ic-stream-${streamId}`);
    return json(data);
  }

  if (req.method === "POST" && seg[0] && seg[1] === "viewers") {
    const streamId = seg[0];
    const action = (await req.json().catch(() => ({})) as { action?: string }).action;
    if (action !== "join" && action !== "leave") {
      return json({ error: "action must be join or leave" }, 400);
    }
    if (!isUpstashConfigured()) return json({ streamId, viewers: 0, configured: false });
    const { data: stream } = await sb.from("streams").select("id, status").eq("id", streamId).maybeSingle();
    if (!stream || stream.status !== "live") return json({ error: "stream_not_live" }, 404);
    const viewers =
      action === "join" ? await incrStreamViewers(streamId) : await decrStreamViewers(streamId);
    return json({ streamId, viewers: viewers ?? 0, action, configured: true });
  }

  if (req.method === "POST" && seg[0] && seg[1] === "signal") {
    const streamId = seg[0];
    const { toUser, signalType, payload } = (await req.json().catch(() => ({}))) as {
      toUser?: string | null;
      signalType?: string;
      payload?: Record<string, unknown>;
    };
    if (!signalType || !payload) return json({ error: "signalType and payload required" }, 400);
    const { data, error } = await sb
      .from("stream_signals")
      .insert({
        stream_id: streamId,
        from_user: userId,
        to_user: toUser ?? null,
        signal_type: signalType,
        payload,
      })
      .select("id, stream_id, from_user, to_user, signal_type, created_at")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json(data, 201);
  }

  return json({ error: "not_found" }, 404);
});
