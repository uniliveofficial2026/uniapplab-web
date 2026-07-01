import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

router.use(auth, requireAdmin);

router.get("/users", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    let query = getSupabaseService()
      .from("profiles")
      .select("id, username, display_name, role, banned_at, ban_reason, muted_until, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ users: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/ban", async (req, res, next) => {
  try {
    const { reason } = req.body as { reason?: string };
    const { data, error } = await getSupabaseService()
      .from("profiles")
      .update({
        banned_at: new Date().toISOString(),
        ban_reason: reason?.slice(0, 500) ?? "Banned by admin",
      })
      .eq("id", req.params.id)
      .select("id, banned_at, ban_reason")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/unban", async (req, res, next) => {
  try {
    const { data, error } = await getSupabaseService()
      .from("profiles")
      .update({ banned_at: null, ban_reason: null })
      .eq("id", req.params.id)
      .select("id, banned_at")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body as { role?: string };
    if (!role || !["user", "streamer", "admin"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const { data, error } = await getSupabaseService()
      .from("profiles")
      .update({ role })
      .eq("id", req.params.id)
      .select("id, role")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/mute", async (req, res, next) => {
  try {
    const { minutes } = req.body as { minutes?: number };
    const mins = Math.max(1, Math.min(60 * 24 * 30, Math.floor(minutes ?? 60)));
    const until = new Date(Date.now() + mins * 60_000).toISOString();
    const { data, error } = await getSupabaseService()
      .from("profiles")
      .update({ muted_until: until })
      .eq("id", req.params.id)
      .select("id, muted_until")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/streams/:id/stop", async (req, res, next) => {
  try {
    const { data, error } = await getSupabaseService()
      .from("streams")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("id, status, ended_at")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
