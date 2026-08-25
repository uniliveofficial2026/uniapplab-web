import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { isBad } from "../lib/moderation";
import { getSupabaseService } from "../lib/supabase";
import { getTypingUserIds, isUpstashConfigured, setTypingIndicator } from "../lib/upstash";

const router: IRouter = Router();

import { buildDmKey } from "../lib/chatDmKey";
async function assertThreadMember(threadId: string, userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseService()
    .from("chat_thread_members")
    .select("user_id")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

async function findExistingDmThread(userId: string, peerId: string): Promise<{ id: string; created_at: string } | null> {
  const dmKey = buildDmKey(userId, peerId);
  const service = getSupabaseService();
  const { data, error } = await service
    .from("chat_threads")
    .select("id, created_at")
    .eq("thread_type", "dm")
    .eq("dm_key", dmKey)
    .maybeSingle();
  if (error || !data) return null;
  const { data: memberships, error: memberErr } = await service
    .from("chat_thread_members")
    .select("user_id")
    .eq("thread_id", data.id);
  if (memberErr) return null;
  const members = new Set((memberships ?? []).map((row) => String(row.user_id || "")).filter(Boolean));
  return members.size === 2 && members.has(userId) && members.has(peerId) ? data : null;
}

function sanitizeGroupMeta(raw: unknown, ownerId: string, memberIds: string[]): Record<string, unknown> {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const memberSet = new Set(memberIds);
  const cleanIds = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.map(String).filter((id) => memberSet.has(id)))]
    : [];
  const adminIds = cleanIds(source.adminIds);
  if (!adminIds.includes(ownerId)) adminIds.unshift(ownerId);
  return {
    kind: "group",
    localId: typeof source.localId === "string" ? source.localId.trim().slice(0, 128) : undefined,
    title: typeof source.title === "string" ? source.title.trim().slice(0, 120) : undefined,
    avatarUrl: typeof source.avatarUrl === "string" ? source.avatarUrl.trim().slice(0, 4000) : undefined,
    createdBy: ownerId,
    adminIds,
    mutedMemberIds: cleanIds(source.mutedMemberIds),
    adminOnlyPosting: Boolean(source.adminOnlyPosting),
    requireApprovalToJoin: Boolean(source.requireApprovalToJoin),
  };
}

router.get("/threads", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { data: memberships, error: memberErr } = await getSupabaseService()
      .from("chat_thread_members")
      .select("thread_id")
      .eq("user_id", userId);
    if (memberErr) {
      res.status(400).json({ error: memberErr.message });
      return;
    }
    const threadIds = (memberships ?? []).map((m) => m.thread_id).filter(Boolean);
    if (threadIds.length === 0) {
      res.json({ threads: [] });
      return;
    }

    const { data: threads, error: threadErr } = await getSupabaseService()
      .from("chat_threads")
      .select("id, thread_type, dm_key, created_at, updated_at, meta")
      .in("id", threadIds)
      .order("updated_at", { ascending: false });
    if (threadErr) {
      res.status(400).json({ error: threadErr.message });
      return;
    }

    const { data: allMembers } = await getSupabaseService()
      .from("chat_thread_members")
      .select("thread_id, user_id")
      .in("thread_id", threadIds);

    const membersByThread = new Map<string, string[]>();
    for (const row of allMembers ?? []) {
      const list = membersByThread.get(row.thread_id) ?? [];
      list.push(row.user_id);
      membersByThread.set(row.thread_id, list);
    }

    const enriched = await Promise.all(
      (threads ?? []).map(async (thread) => {
        const { data: latest } = await getSupabaseService()
          .from("chat_messages")
          .select("id, body, sender_id, created_at, client_id, payload")
          .eq("thread_id", thread.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          ...thread,
          members: membersByThread.get(thread.id) ?? [],
          latestMessage: latest ?? null,
        };
      }),
    );

    res.json({ threads: enriched });
  } catch (err) {
    next(err);
  }
});

router.get("/threads/:threadId/messages", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const threadIdRaw = req.params.threadId;
    const threadId = Array.isArray(threadIdRaw) ? threadIdRaw[0] : threadIdRaw;
    if (!threadId) {
      res.status(400).json({ error: "threadId required" });
      return;
    }
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const isMember = await assertThreadMember(threadId, userId);
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this thread" });
      return;
    }

    let query = getSupabaseService()
      .from("chat_messages")
      .select("id, thread_id, sender_id, body, payload, client_id, created_at, edited_at, deleted_at")
      .eq("thread_id", threadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      const { data: cursorRow } = await getSupabaseService()
        .from("chat_messages")
        .select("created_at")
        .eq("id", before)
        .maybeSingle();
      if (cursorRow?.created_at) {
        query = query.lt("created_at", cursorRow.created_at);
      }
    }

    const { data, error } = await query;
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ messages: (data ?? []).reverse(), threadId });
  } catch (err) {
    next(err);
  }
});

router.post("/threads", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { memberIds, threadType, meta } = req.body as {
      memberIds?: string[];
      threadType?: "dm" | "group";
      meta?: Record<string, unknown>;
    };
    const members = Array.from(new Set([userId, ...(memberIds ?? []).map(String)])).filter(Boolean);
    if (members.length < 2) {
      res.status(400).json({ error: "At least two members required" });
      return;
    }
    const isGroup = threadType === "group";
    const isDm = !isGroup && members.length === 2;
    if (!isDm && !isGroup) {
      res.status(400).json({ error: "threadType=group is required for multi-member chats" });
      return;
    }
    if (isDm) {
      const peerId = members.find((id) => id !== userId)!;
      const existing = await findExistingDmThread(userId, peerId);
      if (existing) { res.status(200).json(existing); return; }
    }
    const insertRow: Record<string, unknown> = {
      thread_type: isDm ? "dm" : "group",
      dm_key: isDm ? buildDmKey(userId, members.find((id) => id !== userId)!) : null,
      meta: isGroup ? sanitizeGroupMeta(meta, userId, members) : {},
    };
    const service = getSupabaseService();
    const { data: thread, error: threadErr } = await service
      .from("chat_threads")
      .insert(insertRow)
      .select("id, created_at")
      .single();
    if (threadErr) {
      if (isDm && threadErr.code === "23505") {
        const peerId = members.find((id) => id !== userId)!;
        const existing = await findExistingDmThread(userId, peerId);
        if (existing) { res.status(200).json(existing); return; }
      }
      res.status(400).json({ error: threadErr.message ?? "Failed to create thread" });
      return;
    }
    const rows = members.map((id) => ({ thread_id: thread.id, user_id: id }));
    const { error: memberErr } = await service.from("chat_thread_members").insert(rows);
    if (memberErr) {
      await service.from("chat_threads").delete().eq("id", thread.id);
      if (isDm && memberErr.code === "23505") {
        const peerId = members.find((id) => id !== userId)!;
        const existing = await findExistingDmThread(userId, peerId);
        if (existing) { res.status(200).json(existing); return; }
      }
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
    const { threadId, body, payload, clientId } = req.body as {
      threadId?: string;
      body?: string;
      payload?: Record<string, unknown>;
      clientId?: string;
    };
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

    const isMember = await assertThreadMember(threadId, userId);
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this thread" });
      return;
    }

    const normalizedClientId =
      typeof clientId === "string" && clientId.trim() ? clientId.trim() : null;

    // clientMessageId makes retries idempotent.
    if (normalizedClientId) {
      const { data: existing } = await getSupabaseService()
        .from("chat_messages")
        .select("id, thread_id, sender_id, body, created_at, client_id, payload")
        .eq("thread_id", threadId)
        .eq("sender_id", userId)
        .eq("client_id", normalizedClientId)
        .maybeSingle();
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }

    const { data, error } = await getSupabaseService()
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        sender_id: userId,
        body: text,
        payload: payload && typeof payload === "object" ? payload : {},
        client_id: normalizedClientId,
      })
      .select("id, thread_id, sender_id, body, created_at, client_id, payload")
      .single();

    if (error) {
      if (normalizedClientId && error.code === "23505") {
        const { data: existing } = await getSupabaseService()
          .from("chat_messages")
          .select("id, thread_id, sender_id, body, created_at, client_id, payload")
          .eq("sender_id", userId)
          .eq("client_id", normalizedClientId)
          .maybeSingle();
        if (existing) {
          res.status(200).json(existing);
          return;
        }
      }
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

router.post("/messages/delete", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { threadId, messageId, clientId } = req.body as {
      threadId?: string;
      messageId?: string;
      clientId?: string;
    };
    if (!threadId) {
      res.status(400).json({ error: "threadId required" });
      return;
    }

    const isMember = await assertThreadMember(threadId, userId);
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this thread" });
      return;
    }

    const normalizedMessageId =
      typeof messageId === "string" && messageId.trim() ? messageId.trim() : null;
    const normalizedClientId =
      typeof clientId === "string" && clientId.trim() ? clientId.trim() : null;

    if (!normalizedMessageId && !normalizedClientId) {
      res.status(400).json({ error: "messageId or clientId required" });
      return;
    }

    const service = getSupabaseService();
    let query = service
      .from("chat_messages")
      .select("id, thread_id, sender_id, deleted_at")
      .eq("thread_id", threadId)
      .eq("sender_id", userId)
      .limit(1);

    if (normalizedMessageId) {
      query = query.eq("id", normalizedMessageId);
    } else {
      query = query.eq("client_id", normalizedClientId!);
    }

    const { data: existing, error: lookupErr } = await query.maybeSingle();
    if (lookupErr) {
      res.status(400).json({ error: lookupErr.message });
      return;
    }
    if (!existing) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (existing.deleted_at) {
      res.status(200).json({
        id: existing.id,
        thread_id: threadId,
        deleted_at: existing.deleted_at,
        alreadyDeleted: true,
      });
      return;
    }

    const deletedAt = new Date().toISOString();
    const { data, error } = await service
      .from("chat_messages")
      .update({ deleted_at: deletedAt, body: "Message deleted", payload: {} })
      .eq("id", existing.id)
      .eq("sender_id", userId)
      .select("id, thread_id, sender_id, body, created_at, client_id, payload, deleted_at")
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await service
      .from("chat_threads")
      .update({ updated_at: deletedAt })
      .eq("id", threadId);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/typing", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { threadId, typing = true } = req.body as { threadId?: string; typing?: boolean };
    if (!threadId) {
      res.status(400).json({ error: "threadId required" });
      return;
    }

    const isMember = await assertThreadMember(threadId, userId);
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this thread" });
      return;
    }

    if (!isUpstashConfigured()) {
      res.json({ ok: false, configured: false });
      return;
    }

    if (typing) {
      await setTypingIndicator(threadId, userId);
    }

    const userIds = await getTypingUserIds(threadId);
    res.json({ ok: true, threadId, userIds, configured: true });
  } catch (err) {
    next(err);
  }
});

export default router;
