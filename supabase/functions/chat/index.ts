/**
 * Supabase Edge Function — chat
 * Migrated from artifacts/api-server/src/routes/chat.ts
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireNotBanned } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";
import {
  getTypingUserIds,
  isUpstashConfigured,
  setTypingIndicator,
} from "../_shared/upstash.ts";

const BAD =
  /\b(nazi|kill yourself|kys|child porn|rape)\b/i;

function isBad(text: string): boolean {
  return BAD.test(text);
}

async function assertThreadMember(threadId: string, userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseService()
    .from("chat_thread_members")
    .select("user_id")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const seg = subPath(new URL(req.url), "chat");
  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  const banned = requireNotBanned(ctx);
  if (banned) return banned;
  const sb = getSupabaseService();
  const userId = ctx.user.id;

  if (req.method === "POST" && seg[0] === "threads") {
    const { memberIds } = (await req.json().catch(() => ({}))) as { memberIds?: string[] };
    const members = Array.from(new Set([userId, ...(memberIds ?? [])])).filter(Boolean);
    if (members.length < 2) return json({ error: "At least two members required" }, 400);

    const { data: thread, error: threadErr } = await sb
      .from("chat_threads")
      .insert({})
      .select("id, created_at")
      .single();
    if (threadErr || !thread) {
      return json({ error: threadErr?.message ?? "Failed to create thread" }, 400);
    }

    const rows = members.map((id) => ({ thread_id: thread.id, user_id: id }));
    const { error: memberErr } = await sb.from("chat_thread_members").insert(rows);
    if (memberErr) return json({ error: memberErr.message }, 400);
    return json(thread, 201);
  }

  if (req.method === "POST" && seg[0] === "messages") {
    const { threadId, body, payload, clientId } = (await req.json().catch(() => ({}))) as {
      threadId?: string;
      body?: string;
      payload?: Record<string, unknown>;
      clientId?: string;
    };
    const text = body?.trim();
    if (!threadId || !text) return json({ error: "threadId and body required" }, 400);
    if (ctx.profile?.muted_until && Date.parse(ctx.profile.muted_until) > Date.now()) {
      return json({ error: "Muted" }, 403);
    }
    if (isBad(text)) return json({ error: "Message blocked by moderation" }, 400);
    if (!(await assertThreadMember(threadId, userId))) {
      return json({ error: "Not a member of this thread" }, 403);
    }

    const { data, error } = await sb
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        sender_id: userId,
        body: text,
        payload: payload && typeof payload === "object" ? payload : {},
        client_id: typeof clientId === "string" && clientId.trim() ? clientId.trim() : null,
      })
      .select("id, thread_id, sender_id, body, created_at")
      .single();
    if (error) return json({ error: error.message }, 400);

    await sb.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    return json(data, 201);
  }

  if (req.method === "POST" && seg[0] === "typing") {
    const { threadId, typing = true } = (await req.json().catch(() => ({}))) as {
      threadId?: string;
      typing?: boolean;
    };
    if (!threadId) return json({ error: "threadId required" }, 400);
    if (!(await assertThreadMember(threadId, userId))) {
      return json({ error: "Not a member of this thread" }, 403);
    }
    if (!isUpstashConfigured()) return json({ ok: false, configured: false });
    if (typing) await setTypingIndicator(threadId, userId);
    const userIds = await getTypingUserIds(threadId);
    return json({ ok: true, threadId, userIds, configured: true });
  }

  return json({ error: "not_found" }, 404);
});
