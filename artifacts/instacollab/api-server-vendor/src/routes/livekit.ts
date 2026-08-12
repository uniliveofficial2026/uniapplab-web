import { Router, type IRouter } from "express";
import { WebhookReceiver } from "livekit-server-sdk";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";
import { fetchFirestorePartyRoom } from "../lib/firestoreAdmin";
import {
  createLiveKitToken,
  deleteLiveKitRoom,
  ensureLiveKitRoom,
  getLiveKitUrl,
  isLiveKitConfigured,
  pingLiveKit,
  streamRoomName,
  partyRoomName,
  chatCallRoomName,
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

/** 1:1 / group chat audio+video calls — any thread member may publish. */
router.post("/livekit/chat/token", auth, requireNotBanned, async (req, res, next) => {
  try {
    if (!isLiveKitConfigured()) {
      res.status(503).json({ error: "livekit_not_configured" });
      return;
    }

    const { threadId, callKind = "audio" } = req.body as {
      threadId?: string;
      callKind?: "audio" | "video";
    };
    if (!threadId?.trim()) {
      res.status(400).json({ error: "threadId required" });
      return;
    }

    const userId = req.authUser!.id;
    const tid = threadId.trim();
    const { data: membership, error } = await getSupabaseService()
      .from("chat_thread_members")
      .select("user_id")
      .eq("thread_id", tid)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !membership) {
      res.status(403).json({ error: "not_thread_member" });
      return;
    }

    const kind = callKind === "video" ? "video" : "audio";
    const roomName = chatCallRoomName(tid, kind);
    await ensureLiveKitRoom(roomName);

    const token = await createLiveKitToken({
      identity: userId,
      name: req.profile?.display_name || req.profile?.username || userId,
      room: roomName,
      canPublish: true,
    });

    res.json({
      token,
      url: getLiveKitUrl(),
      roomName,
      threadId: tid,
      callKind: kind,
      publish: true,
    });
  } catch (err) {
    next(err);
  }
});

/** Party / smule-room voice + data bus — `ic-party-{roomId}`. */
router.post("/livekit/party/token", auth, requireNotBanned, async (req, res, next) => {
  try {
    if (!isLiveKitConfigured()) {
      res.status(503).json({ error: "livekit_not_configured" });
      return;
    }

    const { roomId, publish = false, hidden = false } = req.body as {
      roomId?: string;
      publish?: boolean;
      hidden?: boolean;
    };
    const trimmedRoomId = roomId?.trim();
    if (!trimmedRoomId) {
      res.status(400).json({ error: "roomId required" });
      return;
    }

    const { data: partyRoom, error } = await getSupabaseService()
      .from("party_rooms")
      .select("id, status")
      .eq("id", trimmedRoomId)
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    let roomStatus = partyRoom?.status as string | undefined;

    if (!partyRoom) {
      const firestoreRoom = await fetchFirestorePartyRoom(trimmedRoomId);
      if (!firestoreRoom) {
        res.status(404).json({ error: "party_room_not_found" });
        return;
      }
      roomStatus = firestoreRoom.status;
    }

    if (roomStatus && roomStatus !== "active") {
      res.status(400).json({ error: "party_room_ended" });
      return;
    }

    const userId = req.authUser!.id;
    const roomName = partyRoomName(trimmedRoomId);
    await ensureLiveKitRoom(roomName);

    // Room must exist (Supabase or Firestore). Publish only for active rooms.
    // Platform admins may request a hidden subscribe-only token for silent watch
    // (private rooms included; host roster / participant list stay unchanged).
    const wantHidden = Boolean(hidden) && req.profile?.role === "admin";
    const canPublish =
      !wantHidden && Boolean(publish) && (!roomStatus || roomStatus === "active");
    const token = await createLiveKitToken({
      identity: userId,
      name: req.profile?.display_name || req.profile?.username || userId,
      room: roomName,
      canPublish,
      hidden: wantHidden,
    });

    res.json({
      token,
      url: getLiveKitUrl(),
      roomName,
      roomId: trimmedRoomId,
      publish: canPublish,
      hidden: wantHidden,
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
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    const body =
      rawBody instanceof Buffer
        ? rawBody.toString("utf8")
        : req.body instanceof Buffer
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
