import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { isBad } from "../lib/moderation";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

router.post("/threads", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { memberIds } = req.body as { memberIds?: string[] };
    const members = Array.from(new Set([userId, ...(memberIds ?? [])])).filter(Boolean);
    if (members.length < 2) {
      res.status(400).json({ error: "At least two members required" });
      return;
    }

    const { data: thread, error: threadErr } = await getSupabaseService()
      .from("chat_threads")
      .insert({})
      .select("id, created_at")
      .single();
    if (threadErr || !thread) {
      res.status(400).json({ error: threadErr?.message ?? "Failed to create thread" });
      return;
    }

    const rows = members.map((id) => ({ thread_id: thread.id, user_id: id }));
    const { error: memberErr } = await getSupabaseService().from("chat_thread_members").insert(rows);
    if (memberErr) {
      res.status(400).json({ error: memberErr.message });
      return;
    }

    res.status(201).json(thread);
  } catch (err) {
    next(err);
  }
});

router.post("/messages", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { threadId, body } = req.body as { threadId?: string; body?: string };
    const text = body?.trim();
    if (!threadId || !text) {
      res.status(400).json({ error: "threadId and body required" });
      return;
    }
    if (req.profile?.muted_until && Date.parse(req.profile.muted_until) > Date.now()) {
      res.status(403).json({ error: "Muted" });
      return;
    }
    if (isBad(text)) {
      res.status(400).json({ error: "Message blocked by moderation" });
      return;
    }

    const { data, error } = await getSupabaseService()
      .from("chat_messages")
      .insert({ thread_id: threadId, sender_id: userId, body: text })
      .select("id, thread_id, sender_id, body, created_at")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await getSupabaseService()
      .from("chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
