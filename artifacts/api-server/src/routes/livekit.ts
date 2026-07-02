import { Router, type IRouter } from "express";
import { WebhookReceiver } from "livekit-server-sdk";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";
import {
  createLiveKitToken,
  deleteLiveKitRoom,
  ensureLiveKitRoom,
  getLiveKitUrl,
  isLiveKitConfigured,
  pingLiveKit,
  streamRoomName,
  partyRoomName,
} from "../lib/livekit";

const router: IRouter = Router();

function canGoLive(role: string | undefined): boolean {
  return role === "streamer" || role === "admin";
}

router.get("/livekit/health", async (_req, res) => {
  if (!isLiveKitConfigured()) {
    res.status(503).json({ ok: false, configured: false });
    return;
  }
  const result = await pingLiveKit();
  res.status(result.ok ? 200 : 503).json({ configured: true, ...result });
});

router.post("/livekit/token", auth, requireNotBanned, async (req, res, next) => {
  try {
    if (!isLiveKitConfigured()) {
      res.status(503).json({ error: "livekit_not_configured" });
      return;
    }

    const { streamId, role = "viewer" } = req.body as {
      streamId?: string;
      role?: "host" | "viewer";
    };
    if (!streamId) {
      res.status(400).json({ error: "streamId required" });
      return;
    }

    const { data: stream, error } = await getSupabaseService()
      .from("streams")
      .select("id, user_id, status, title")
      .eq("id", streamId)
      .maybeSingle();

    if (error || !stream) {
      res.status(404).json({ error: "stream_not_found" });
      return;
    }

    if (stream.status !== "live") {
      res.status(400).json({ error: "stream_not_live" });
      return;
    }

    const userId = req.authUser!.id;
    const isHost = role === "host";
    if (isHost) {
      if (stream.user_id !== userId) {
        res.status(403).json({ error: "not_stream_owner" });
        return;
      }
      if (!canGoLive(req.profile?.role)) {
        res.status(403).json({ error: "streamer_role_required" });
        return;
      }
    }

    const roomName = streamRoomName(streamId);
    if (isHost) {
      await ensureLiveKitRoom(roomName);
    }

    const token = await createLiveKitToken({
      identity: userId,
      name: req.profile?.display_name || req.profile?.username || userId,
      room: roomName,
      role: isHost ? "host" : "viewer",
    });

    res.json({
      token,
      url: getLiveKitUrl(),
      roomName,
      streamId,
      role: isHost ? "host" : "viewer",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/livekit/party/token", auth, requireNotBanned, async (req, res, next) => {
  try {
    if (!isLiveKitConfigured()) {
      res.status(503).json({ error: "livekit_not_configured" });
      return;
    }

    const { roomId, publish = true } = req.body as {
      roomId?: string;
      publish?: boolean;
    };
    if (!roomId?.trim()) {
      res.status(400).json({ error: "roomId required" });
      return;
    }

    const userId = req.authUser!.id;
    const roomName = partyRoomName(roomId.trim());
    await ensureLiveKitRoom(roomName);

    const token = await createLiveKitToken({
      identity: userId,
      name: req.profile?.display_name || req.profile?.username || userId,
      room: roomName,
      canPublish: Boolean(publish),
    });

    res.json({
      token,
      url: getLiveKitUrl(),
      roomName,
      roomId: roomId.trim(),
      publish: Boolean(publish),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/livekit/webhook", async (req, res) => {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    res.status(503).json({ error: "livekit_not_configured" });
    return;
  }

  const receiver = new WebhookReceiver(apiKey, apiSecret);
  try {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== "string") {
      res.status(401).json({ error: "missing authorization" });
      return;
    }
    const body =
      req.body instanceof Buffer
        ? req.body.toString("utf8")
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? {});
    const event = await receiver.receive(body, authHeader);

    if (event.event === "room_finished" && event.room?.name?.startsWith("ic-stream-")) {
      const streamId = event.room.name.replace(/^ic-stream-/, "");
      await getSupabaseService()
        .from("streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", streamId)
        .eq("status", "live");
    }

    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "invalid webhook" });
  }
});

export { deleteLiveKitRoom, streamRoomName };
export default router;
