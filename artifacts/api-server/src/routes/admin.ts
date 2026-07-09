import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

router.use(auth, requireAdmin);

async function countTable(table: string, filter?: { column: string; value: string }): Promise<number> {
  let query = getSupabaseService().from(table).select("id", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

router.get("/overview", async (_req, res, next) => {
  try {
    const sb = getSupabaseService();
    const [users, postsRes, comments, chatMessages, liveStreams, activePartyRooms, giftMessages, wallets] =
      await Promise.all([
        countTable("profiles"),
        sb.from("posts").select("id, payload"),
        countTable("social_comments"),
        countTable("chat_messages"),
        countTable("streams", { column: "status", value: "live" }),
        countTable("party_rooms", { column: "status", value: "active" }),
        countTable("party_room_messages", { column: "kind", value: "gift" }),
        countTable("wallets"),
      ]);
    const posts = postsRes.data ?? [];
    const reels = posts.filter((row) => {
      const payload = row.payload as Record<string, unknown> | null;
      return payload?.contentKind === "reel";
    }).length;
    res.json({
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
  } catch (err) {
    next(err);
  }
});

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

router.get("/content/posts", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    let query = getSupabaseService()
      .from("posts")
      .select("id, author_id, payload, is_archived, created_at, author:profiles!posts_author_id_fkey(username, display_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q) query = query.or(`id.ilike.%${q}%,payload->>caption.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    const items = (data ?? []).filter((row) => {
      const payload = row.payload as Record<string, unknown> | null;
      return payload?.contentKind !== "reel";
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get("/content/reels", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    let query = getSupabaseService()
      .from("posts")
      .select("id, author_id, payload, is_archived, created_at, author:profiles!posts_author_id_fkey(username, display_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q) query = query.or(`id.ilike.%${q}%,payload->>caption.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    const items = (data ?? []).filter((row) => {
      const payload = row.payload as Record<string, unknown> | null;
      return payload?.contentKind === "reel";
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.patch("/content/posts/:id", async (req, res, next) => {
  try {
    const { archived } = req.body as { archived?: boolean };
    const { data, error } = await getSupabaseService()
      .from("posts")
      .update({ is_archived: Boolean(archived) })
      .eq("id", req.params.id)
      .select("id, is_archived")
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

router.get("/content/comments", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    let query = getSupabaseService()
      .from("social_comments")
      .select("id, target_kind, target_id, author_id, body, created_at, author:profiles!social_comments_author_id_fkey(username, display_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q) query = query.or(`body.ilike.%${q}%,target_id.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.delete("/content/comments/:id", async (req, res, next) => {
  try {
    const { error } = await getSupabaseService().from("social_comments").delete().eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/chat/messages", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    let query = getSupabaseService()
      .from("chat_messages")
      .select("id, thread_id, sender_id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q) query = query.ilike("body", `%${q}%`);
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.delete("/chat/messages/:id", async (req, res, next) => {
  try {
    const { error } = await getSupabaseService().from("chat_messages").delete().eq("id", req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/wallet/users", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    let query = getSupabaseService()
      .from("wallets")
      .select("user_id, balance, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (q) {
      const { data: profiles } = await getSupabaseService()
        .from("profiles")
        .select("id")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      const ids = (profiles ?? []).map((p) => p.id);
      if (ids.length === 0) {
        res.json({ items: [] });
        return;
      }
      query = query.in("user_id", ids);
    }
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.get("/wallet/transactions", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseService()
      .from("wallet_transactions")
      .select("id, from_user, to_user, amount, tx_type, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.get("/streams", async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "live");
    let query = getSupabaseService()
      .from("streams")
      .select("id, user_id, title, status, started_at, ended_at")
      .order("started_at", { ascending: false })
      .limit(50);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ items: data ?? [] });
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

router.get("/party-rooms", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const mode = String(req.query.mode ?? "").trim();
    let query = getSupabaseService()
      .from("party_rooms")
      .select("id, owner_id, room_name, room_mode, status, participant_count, created_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (mode) query = query.ilike("room_mode", `%${mode}%`);
    if (q) query = query.or(`room_name.ilike.%${q}%,id.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post("/party-rooms/:id/end", async (req, res, next) => {
  try {
    const { data, error } = await getSupabaseService()
      .from("party_rooms")
      .update({ status: "ended", updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("id, status")
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

router.get("/party-rooms/gifts", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseService()
      .from("party_room_messages")
      .select("id, room_id, sender_id, sender_name, body, kind, meta, created_at")
      .eq("kind", "gift")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ items: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.get("/integrations/status", async (_req, res) => {
  const envPresent = (key: string) => Boolean(String(process.env[key] ?? "").trim());
  res.json({
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
        serverKeys: ["VITE_TENCENT_WEBAR_APP_ID", "VITE_TENCENT_WEBAR_LICENSE_KEY"],
      },
      {
        id: "deepar",
        configured: envPresent("VITE_DEEPAR_LICENSE_KEY"),
        serverKeys: ["VITE_DEEPAR_LICENSE_KEY"],
      },
    ],
  });
});

export default router;
