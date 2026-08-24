import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";
import { apiError } from "../lib/apiError";

const router: IRouter = Router();

async function assertRoomHost(roomId: string, userId: string): Promise<boolean> {
  const { data } = await getSupabaseService()
    .from("party_rooms")
    .select("owner_id")
    .eq("id", roomId)
    .maybeSingle();
  if (data?.owner_id === userId) return true;
  const { data: stream } = await getSupabaseService()
    .from("streams")
    .select("user_id")
    .eq("id", roomId)
    .maybeSingle();
  return stream?.user_id === userId;
}

router.get("/:roomId/seats", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomIdRaw = req.params.roomId;
    const roomId = Array.isArray(roomIdRaw) ? roomIdRaw[0] : roomIdRaw;
    if (!roomId) {
      res.status(400).json({ error: "roomId required" });
      return;
    }
    const { data, error } = await getSupabaseService()
      .from("live_room_seats")
      .select("*")
      .eq("room_id", roomId)
      .order("seat_index", { ascending: true });
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        res.json({ roomId, seats: [] });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ roomId, seats: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post("/:roomId/seats/:seatIndex/request", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const roomId = String(Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId);
    const seatIndex = Math.floor(Number(req.params.seatIndex));
    if (!roomId || !Number.isFinite(seatIndex) || seatIndex < 0) {
      res.status(400).json({ error: "roomId and seatIndex required" });
      return;
    }

    try {
      const { getLiveLifecycleService } = await import("../domain/live-lifecycle");
      getLiveLifecycleService().rejectIfEnding(roomId, "seat");
    } catch (err) {
      const rec = err as { status?: number; code?: string };
      if (rec.status && rec.code) {
        apiError(res, rec.status, rec.code);
        return;
      }
    }

    const { data: existing } = await getSupabaseService()
      .from("live_room_seats")
      .select("*")
      .eq("room_id", roomId)
      .eq("seat_index", seatIndex)
      .maybeSingle();

    if (existing?.user_id && existing.user_id !== userId && existing.state !== "empty") {
      apiError(res, 409, "error.seatOccupied");
      return;
    }

    const row = {
      room_id: roomId,
      seat_index: seatIndex,
      user_id: userId,
      state: "requested",
      role: "guest",
      can_publish: false,
      muted: false,
      updated_at: new Date().toISOString(),
      version: Number(existing?.version ?? 0) + 1,
    };

    const { data, error } = await getSupabaseService()
      .from("live_room_seats")
      .upsert(row, { onConflict: "room_id,seat_index" })
      .select("*")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json({ seat: data });
  } catch (err) {
    next(err);
  }
});

router.post("/:roomId/seats/:seatIndex/approve", auth, requireNotBanned, async (req, res, next) => {
  try {
    const actorId = req.authUser!.id;
    const roomId = String(Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId);
    const seatIndex = Math.floor(Number(req.params.seatIndex));
    if (!(await assertRoomHost(roomId, actorId))) {
      apiError(res, 403, "error.hostRequired");
      return;
    }

    const { data: seat } = await getSupabaseService()
      .from("live_room_seats")
      .select("*")
      .eq("room_id", roomId)
      .eq("seat_index", seatIndex)
      .maybeSingle();
    if (!seat?.user_id) {
      apiError(res, 404, "error.notFound");
      return;
    }

    const { data, error } = await getSupabaseService()
      .from("live_room_seats")
      .update({
        state: "approved",
        can_publish: true,
        version: Number(seat.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq("seat_index", seatIndex)
      .eq("version", seat.version)
      .select("*")
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(409).json({ error: "seat_version_conflict" });
      return;
    }
    res.json({ seat: data });
  } catch (err) {
    next(err);
  }
});

router.post("/:roomId/seats/:seatIndex/leave", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const roomId = String(Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId);
    const seatIndex = Math.floor(Number(req.params.seatIndex));

    const { data: seat } = await getSupabaseService()
      .from("live_room_seats")
      .select("*")
      .eq("room_id", roomId)
      .eq("seat_index", seatIndex)
      .maybeSingle();

    const isHost = await assertRoomHost(roomId, userId);
    if (seat?.user_id !== userId && !isHost) {
      res.status(403).json({ error: "not_seat_occupant" });
      return;
    }

    const { data, error } = await getSupabaseService()
      .from("live_room_seats")
      .update({
        user_id: null,
        state: "empty",
        can_publish: false,
        muted: false,
        version: Number(seat?.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq("seat_index", seatIndex)
      .select("*")
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ seat: data });
  } catch (err) {
    next(err);
  }
});

export default router;
