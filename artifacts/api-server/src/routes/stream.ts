import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";
import { deleteLiveKitRoom, isLiveKitConfigured, streamRoomName } from "../lib/livekit";
import {
  decrStreamViewers,
  getStreamViewers,
  incrStreamViewers,
  isUpstashConfigured,
} from "../lib/upstash";

/** Stream metadata lives in PostgreSQL (Supabase); viewer counts are ephemeral in Redis. */
function canGoLive(role: string | undefined): boolean {
  return role === "streamer" || role === "admin";
}

const router: IRouter = Router();

router.get("/live", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseService()
      .from("streams")
      .select("id, user_id, title, status, started_at")
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ streams: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post("/start", auth, requireNotBanned, async (req, res, next) => {
  try {
    const role = req.profile?.role;
    if (!canGoLive(role)) {
      res.status(403).json({ error: "Streamer role required" });
      return;
    }
    const { title } = req.body as { title?: string };
    const { data, error } = await getSupabaseService()
      .from("streams")
      .insert({
        user_id: req.authUser!.id,
        title: title?.slice(0, 120) ?? "Live",
        status: "live",
      })
      .select("id, user_id, title, status, started_at")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/stop", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { streamId } = req.body as { streamId?: string };
    if (!streamId) {
      res.status(400).json({ error: "streamId required" });
      return;
    }
    const { data: stream } = await getSupabaseService()
      .from("streams")
      .select("user_id")
      .eq("id", streamId)
      .maybeSingle();
    const isOwner = stream?.user_id === userId;
    const isAdmin = req.profile?.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    const { data, error } = await getSupabaseService()
      .from("streams")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", streamId)
      .select("id, status, ended_at")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (isLiveKitConfigured()) {
      await deleteLiveKitRoom(streamRoomName(streamId));
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/viewers", async (req, res, next) => {
  try {
    const streamId = req.params.id;
    if (!isUpstashConfigured()) {
      res.json({ streamId, viewers: 0, configured: false });
      return;
    }
    const viewers = await getStreamViewers(streamId);
    res.json({ streamId, viewers, configured: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/viewers", auth, requireNotBanned, async (req, res, next) => {
  try {
    const streamId = req.params.id;
    const action = (req.body as { action?: string })?.action;
    if (action !== "join" && action !== "leave") {
      res.status(400).json({ error: "action must be join or leave" });
      return;
    }
    if (!isUpstashConfigured()) {
      res.json({ streamId, viewers: 0, configured: false });
      return;
    }

    const { data: stream } = await getSupabaseService()
      .from("streams")
      .select("id, status")
      .eq("id", streamId)
      .maybeSingle();
    if (!stream || stream.status !== "live") {
      res.status(404).json({ error: "stream_not_live" });
      return;
    }

    const viewers =
      action === "join"
        ? await incrStreamViewers(streamId)
        : await decrStreamViewers(streamId);
    res.json({ streamId, viewers: viewers ?? 0, action, configured: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/signal", auth, requireNotBanned, async (req, res, next) => {
  try {
    const streamId = req.params.id;
    const { toUser, signalType, payload } = req.body as {
      toUser?: string | null;
      signalType?: string;
      payload?: Record<string, unknown>;
    };
    if (!signalType || !payload) {
      res.status(400).json({ error: "signalType and payload required" });
      return;
    }
    const { data, error } = await getSupabaseService()
      .from("stream_signals")
      .insert({
        stream_id: streamId,
        from_user: req.authUser!.id,
        to_user: toUser ?? null,
        signal_type: signalType,
        payload,
      })
      .select("id, stream_id, from_user, to_user, signal_type, created_at")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
