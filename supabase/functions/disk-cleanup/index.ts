/**
 * One-shot disk cleanup once Free-tier read-only is lifted (Pro upgrade).
 * POST with Authorization: Bearer <service role or cleanup secret>
 * Truncates party_room_sync_events and runs prune function if present.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent } from "../_shared/cors.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = String(Deno.env.get("DISK_CLEANUP_SECRET") || "").trim();
  const auth = req.headers.get("authorization") || "";
  const serviceKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const ok =
    (secret && token === secret) ||
    (serviceKey && token === serviceKey);
  if (!ok) return json({ error: "unauthorized" }, 401);

  const sb = getSupabaseService();
  try {
    // Prefer RPC if migration applied; otherwise truncate via REST isn't available —
    // use rpc execute via raw SQL isn't exposed. Try prune first.
    const { data: pruned, error: pruneErr } = await sb.rpc("prune_party_room_sync_events", {
      retention_hours: 0,
    });
    if (!pruneErr) {
      return json({ ok: true, method: "prune_party_room_sync_events", deleted: pruned });
    }

    // Fallback: delete all rows in batches via REST (works after read-only lifts).
    let deleted = 0;
    for (let i = 0; i < 50; i++) {
      const { data, error } = await sb
        .from("party_room_sync_events")
        .delete()
        .lt("created_at", new Date().toISOString())
        .select("id")
        .limit(1000);
      if (error) return json({ ok: false, error: error.message, deleted }, 500);
      const n = data?.length ?? 0;
      deleted += n;
      if (n < 1000) break;
    }
    return json({
      ok: true,
      method: "batched_delete",
      deleted,
      note: "Apply migration 20260717180000 for TRUNCATE + prune RPC (faster).",
    });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
