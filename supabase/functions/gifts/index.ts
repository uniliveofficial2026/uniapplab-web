/**
 * Supabase Edge Function — gifts API.
 * Migrated from Vercel Express (artifacts/api-server/src/routes/gifts.ts).
 * Routes:
 *   GET  /gifts/catalog          → public gift catalog
 *   PUT  /gifts/catalog/:id      → admin upsert catalog item
 *   POST /gifts/send             → authoritative gift send
 *   GET  /gifts/history          → caller gift history
 *   GET  /gifts/rankings/:roomId → room leaderboard
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireAdmin, requireNotBanned } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

type GiftCatalogRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  tier: string;
  rarity: string;
  animation_url: string | null;
  preview_url: string | null;
  sound_url: string | null;
  icon: string;
  effect_svga_url: string | null;
  effect_video_url: string | null;
  combo_enabled: boolean;
  vip_only: boolean;
  seasonal: boolean;
  lucky: boolean;
  blind_box: boolean;
  pk_enabled: boolean;
  available_from: string | null;
  available_until: string | null;
  status: string;
  metadata: Record<string, unknown>;
  sort_order: number;
};

function mapCatalogItem(row: GiftCatalogRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    category: row.category,
    tier: row.tier,
    rarity: row.rarity,
    animation: row.animation_url ?? row.effect_svga_url ?? row.effect_video_url,
    preview: row.preview_url,
    sound: row.sound_url,
    icon: row.icon,
    effectSvgaUrl: row.effect_svga_url,
    effectVideoUrl: row.effect_video_url,
    comboEnabled: row.combo_enabled,
    vipOnly: row.vip_only,
    seasonal: row.seasonal,
    lucky: row.lucky,
    blindBox: row.blind_box,
    pkEnabled: row.pk_enabled,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    status: row.status,
    metadata: row.metadata ?? {},
    sortOrder: row.sort_order,
    stars: Number(row.price),
  };
}

function isGiftAvailableNow(row: GiftCatalogRow, now = Date.now()): boolean {
  if (row.status !== "published") return false;
  if (row.available_from && new Date(row.available_from).getTime() > now) return false;
  if (row.available_until && new Date(row.available_until).getTime() < now) return false;
  return true;
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const url = new URL(req.url);
  const seg = subPath(url, "gifts");
  const sb = getSupabaseService();

  // GET /gifts/catalog — public
  if (req.method === "GET" && seg[0] === "catalog" && seg.length === 1) {
    let gifts: ReturnType<typeof mapCatalogItem>[] = [];
    try {
      const { data: rows, error } = await withTimeout(
        sb
          .from("gift_catalog_items")
          .select("*")
          .eq("status", "published")
          .order("sort_order", { ascending: true })
          .order("price", { ascending: true }),
        4_000,
        "gift_catalog_items",
      );
      if (!error && rows) {
        gifts = ((rows ?? []) as GiftCatalogRow[])
          .filter((row) => isGiftAvailableNow(row))
          .map(mapCatalogItem);
      }
    } catch {
      /* table missing or Supabase slow — try jsonb blob */
    }

    if (gifts.length === 0) {
      try {
        const { data: blob } = await withTimeout(
          sb.from("platform_gift_catalog").select("gifts").eq("id", "default").maybeSingle(),
          4_000,
          "platform_gift_catalog",
        );
        const raw = Array.isArray(blob?.gifts) ? blob.gifts : [];
        gifts = raw
          .filter((g: { status?: string }) => !g.status || g.status === "published")
          .map((g: Record<string, unknown>) => ({
            id: String(g.id ?? ""),
            name: String(g.name ?? "Gift"),
            description: String(g.description ?? ""),
            price: Number(g.stars ?? g.price ?? 1),
            currency: "coins",
            category: String(g.category ?? "standard"),
            tier: String(g.tier ?? "normal"),
            rarity: String(g.rarity ?? "common"),
            animation: (g.effectSvgaUrl ?? g.effectVideoUrl ?? null) as string | null,
            preview: (g.previewUrl ?? g.icon ?? null) as string | null,
            sound: (g.soundUrl ?? null) as string | null,
            icon: String(g.icon ?? "🎁"),
            effectSvgaUrl: (g.effectSvgaUrl ?? null) as string | null,
            effectVideoUrl: (g.effectVideoUrl ?? null) as string | null,
            comboEnabled: g.comboEnabled !== false,
            vipOnly: Boolean(g.vipOnly),
            seasonal: Boolean(g.seasonal),
            lucky: Boolean(g.lucky),
            blindBox: Boolean(g.blindBox),
            pkEnabled: g.pkEnabled !== false,
            availableFrom: null,
            availableUntil: null,
            status: "published",
            metadata: {},
            sortOrder: 0,
            stars: Number(g.stars ?? g.price ?? 1),
          }))
          .filter((g) => g.id);
      } catch {
        gifts = [];
      }
    }

    return json({ gifts });
  }

  // Everything else requires auth.
  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;

  // PUT /gifts/catalog/:id — admin
  if (req.method === "PUT" && seg[0] === "catalog" && seg[1]) {
    const adminErr = requireAdmin(ctx);
    if (adminErr) return adminErr;
    const id = String(seg[1] || "").trim();
    if (!id) return json({ error: "id required" }, 400);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const price = Math.floor(Number(body.price ?? body.stars) || 0);
    if (price <= 0) return json({ error: "positive price required" }, 400);

    const row = {
      id,
      name: String(body.name || id),
      description: String(body.description || ""),
      price,
      currency: String(body.currency || "coins"),
      category: String(body.category || "standard"),
      tier: String(body.tier || "normal"),
      rarity: String(body.rarity || "common"),
      animation_url: (body.animation as string) || null,
      preview_url: (body.preview as string) || null,
      sound_url: (body.sound as string) || null,
      icon: String(body.icon || "🎁"),
      effect_svga_url: (body.effectSvgaUrl as string) || null,
      effect_video_url: (body.effectVideoUrl as string) || null,
      combo_enabled: body.comboEnabled !== false,
      vip_only: Boolean(body.vipOnly),
      seasonal: Boolean(body.seasonal),
      lucky: Boolean(body.lucky),
      blind_box: Boolean(body.blindBox),
      pk_enabled: body.pkEnabled !== false,
      available_from: (body.availableFrom as string) || null,
      available_until: (body.availableUntil as string) || null,
      status: String(body.status || "published"),
      metadata: (body.metadata as Record<string, unknown>) || {},
      sort_order: Math.floor(Number(body.sortOrder) || 0),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from("gift_catalog_items")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ gift: mapCatalogItem(data as GiftCatalogRow) });
  }

  // POST /gifts/send
  if (req.method === "POST" && seg[0] === "send") {
    const banned = requireNotBanned(ctx);
    if (banned) return banned;
    const senderId = ctx.user.id;
    const {
      giftId,
      receiverId,
      roomId,
      quantity,
      combo,
      clientRequestId,
      tier,
      metadata,
    } = (await req.json().catch(() => ({}))) as {
      giftId?: string;
      receiverId?: string;
      roomId?: string;
      quantity?: number;
      combo?: number;
      clientRequestId?: string;
      giftName?: string;
      unitPrice?: number;
      tier?: string;
      metadata?: Record<string, unknown>;
    };

    const gid = String(giftId || "").trim();
    const rid = String(receiverId || "").trim();
    if (!gid || !rid) return json({ error: "giftId and receiverId required" }, 400);

    let price = 0;
    let name = gid;
    let giftTier = String(tier || "normal");

    const { data: catalogRow } = await sb
      .from("gift_catalog_items")
      .select("*")
      .eq("id", gid)
      .maybeSingle();

    if (catalogRow) {
      const row = catalogRow as GiftCatalogRow;
      if (!isGiftAvailableNow(row)) return json({ error: "gift not available" }, 400);
      price = Number(row.price);
      name = row.name;
      giftTier = row.tier || giftTier;
    } else {
      try {
        const { data: blob } = await sb
          .from("platform_gift_catalog")
          .select("gifts")
          .eq("id", "default")
          .maybeSingle();
        const raw = Array.isArray(blob?.gifts) ? (blob.gifts as Record<string, unknown>[]) : [];
        const match = raw.find((g) => String(g.id ?? "") === gid);
        if (!match) return json({ error: "unknown gift" }, 400);
        price = Math.floor(Number(match.stars ?? match.price) || 0);
        name = String(match.name ?? name);
        giftTier = String(match.tier ?? giftTier);
      } catch {
        return json({ error: "gift catalog unavailable" }, 400);
      }
    }

    if (price <= 0) return json({ error: "gift price required" }, 400);

    const qty = Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1)));
    const comboN = Math.max(1, Math.min(9999, Math.floor(Number(combo) || 1)));

    const { data, error } = await sb.rpc("settle_gift_send", {
      p_sender: senderId,
      p_receiver: rid,
      p_gift_id: gid,
      p_gift_name: name,
      p_unit_price: price,
      p_quantity: qty,
      p_combo: comboN,
      p_room_id: roomId ? String(roomId) : null,
      p_tier: giftTier,
      p_client_request_id: clientRequestId ? String(clientRequestId).slice(0, 120) : null,
      p_metadata: metadata ?? {},
    });

    if (error) {
      const msg = error.message || "gift settle failed";
      const status = msg.includes("insufficient") || msg.includes("limit") ? 402 : 400;
      return json({ error: msg }, status);
    }

    const result = data as Record<string, unknown>;
    return json({
      ...result,
      event: {
        giftId: gid,
        senderId,
        receiverId: rid,
        roomId: roomId ?? null,
        quantity: qty,
        combo: comboN,
        timestamp: result.timestamp ?? Math.floor(Date.now() / 1000),
        totalCoins: result.totalCoins,
        tier: giftTier,
        giftTransactionId: result.giftTransactionId,
      },
    });
  }

  // GET /gifts/history
  if (req.method === "GET" && seg[0] === "history") {
    const banned = requireNotBanned(ctx);
    if (banned) return banned;
    const userId = ctx.user.id;
    const limit = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 40)));
    const { data, error } = await sb
      .from("gift_transactions")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return json({ error: error.message }, 400);
    return json({ transactions: data ?? [] });
  }

  // GET /gifts/rankings/:roomId
  if (req.method === "GET" && seg[0] === "rankings" && seg[1]) {
    const banned = requireNotBanned(ctx);
    if (banned) return banned;
    const roomId = String(seg[1] || "").trim();
    const role = String(url.searchParams.get("role") || "sender") === "receiver" ? "receiver" : "sender";
    const dayKey = String(url.searchParams.get("day") || new Date().toISOString().slice(0, 10));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 20)));

    const { data, error } = await sb
      .from("gift_room_stats")
      .select("user_id, coins_total, gifts_count, updated_at")
      .eq("room_id", roomId)
      .eq("role", role)
      .eq("day_key", dayKey)
      .order("coins_total", { ascending: false })
      .limit(limit);
    if (error) return json({ error: error.message }, 400);
    return json({ roomId, role, dayKey, rankings: data ?? [] });
  }

  return json({ error: "not_found" }, 404);
});
