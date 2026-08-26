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

    const sb = getSupabaseService();
    const { data: partyRoom, error } = await sb
      .from("party_rooms")
      .select("id, status, owner_id, room_mode")
      .eq("id", trimmedRoomId)
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    let roomStatus = partyRoom?.status as string | undefined;
    let ownerId = partyRoom?.owner_id as string | undefined;
    const userId = req.authUser!.id;

    if (!partyRoom) {
      // Dual-write era: Solo Live may exist only in Firestore while viewers discover via
      // Supabase party_rooms. Rehydrate SSOT here so token mint and discovery converge.
      const firestoreRoom = await fetchFirestorePartyRoom(trimmedRoomId);
      if (!firestoreRoom) {
        res.status(404).json({ error: "party_room_not_found" });
        return;
      }
      roomStatus = firestoreRoom.status;
      ownerId =
        firestoreRoom.owner_id ||
        (firestoreRoom as { ownerId?: string }).ownerId ||
        undefined;

      if (ownerId && roomStatus === "active") {
        const now = new Date().toISOString();
        const { error: upsertErr } = await sb.from("party_rooms").upsert(
          {
            id: trimmedRoomId,
            owner_id: ownerId,
            room_name: `Room ${trimmedRoomId}`,
            room_mode: "Solo-Live",
            privacy: firestoreRoom.privacy || "Public",
            join_policy: "Anyone",
            status: "active",
            tags: ["Solo-Live"],
            updated_at: now,
          },
          { onConflict: "id" },
        );
        if (upsertErr) {
          console.warn("[livekit/party/token] supabase rehydrate failed", upsertErr.message);
        }
      }
    }

    if (roomStatus && roomStatus !== "active") {
      res.status(400).json({ error: "party_room_ended" });
      return;
    }
    const roomName = partyRoomName(trimmedRoomId);
    await ensureLiveKitRoom(roomName);

    // LiveKit publishing permission is derived server-side from room role/seat state.
    // Never trust client-supplied publish=true as sufficient authority.
    const wantHidden = Boolean(hidden) && req.profile?.role === "admin";
    const isOwner = Boolean(ownerId && ownerId === userId);

    let seatedPublisher = false;
    if (!isOwner && !wantHidden) {
      const { data: seat } = await getSupabaseService()
        .from("live_room_seats")
        .select("seat_index, state")
        .eq("room_id", trimmedRoomId)
        .eq("user_id", userId)
        .in("state", ["approved", "active", "occupied"])
        .maybeSingle();
      seatedPublisher = Boolean(seat);
    }

    const canPublish = !wantHidden && (isOwner || seatedPublisher);

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
      role: isOwner ? "host" : seatedPublisher ? "guest" : "viewer",
    });
    void publish; // Client publish flag is not authority — retained only for API shape compatibility.
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

    if (event.event === "participant_left" && event.room?.name?.startsWith("ic-party-")) {
      const roomId = event.room.name.replace(/^ic-party-/, "");
      const identity = event.participant?.identity?.trim();
      if (identity) {
        const { getLiveLifecycleService } = await import("../domain/live-lifecycle");
        const service = getLiveLifecycleService();
        if (service.getRoom(roomId)) {
          const session = service
            .listSessions(roomId)
            .find((row) => !row.disconnectedAt && (row.userId === identity || row.participantSessionId === identity));
          if (session) service.unexpectedDisconnect(roomId, session.participantSessionId);
          service.expireHostGrace(roomId);
        }
      }
    }

    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "invalid webhook" });
  }
});

export { deleteLiveKitRoom, streamRoomName };
export default router;
