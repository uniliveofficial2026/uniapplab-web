import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

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
    /** Legacy client field — coin cost */
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

/** Public gift catalog (normalized rows + jsonb fallback). */
router.get("/catalog", async (_req, res, next) => {
  try {
    const sb = getSupabaseService();
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

    res.json({ gifts });
  } catch (err) {
    next(err);
  }
});

/** Admin upsert catalog item into normalized table. */
router.put("/catalog/:id", auth, requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      res.status(400).json({ error: "id required" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const price = Math.floor(Number(body.price ?? body.stars) || 0);
    if (price <= 0) {
      res.status(400).json({ error: "positive price required" });
      return;
    }

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

    const { data, error } = await getSupabaseService()
      .from("gift_catalog_items")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ gift: mapCatalogItem(data as GiftCatalogRow) });
  } catch (err) {
    next(err);
  }
});

/**
 * Authoritative gift send.
 * Deducts coins (bonus first), credits receiver diamonds, persists ledger + room stats.
 */
router.post("/send", auth, requireNotBanned, async (req, res, next) => {
  try {
    const senderId = req.authUser!.id;
    const {
      giftId,
      receiverId,
      roomId,
      quantity,
      combo,
      clientRequestId,
      giftName,
      unitPrice,
      tier,
      metadata,
    } = req.body as {
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
    if (!gid || !rid) {
      res.status(400).json({ error: "giftId and receiverId required" });
      return;
    }

    const sb = getSupabaseService();
    let price = 0;
    let name = String(giftName || gid);
    let giftTier = String(tier || "normal");

    const { data: catalogRow } = await sb
      .from("gift_catalog_items")
      .select("*")
      .eq("id", gid)
      .maybeSingle();

    if (catalogRow) {
      const row = catalogRow as GiftCatalogRow;
      if (!isGiftAvailableNow(row)) {
        res.status(400).json({ error: "gift not available" });
        return;
      }
      price = Number(row.price);
      name = row.name;
      giftTier = row.tier || giftTier;
    } else {
      // Fall back to jsonb catalog — never trust client unitPrice alone.
      try {
        const { data: blob } = await sb
          .from("platform_gift_catalog")
          .select("gifts")
          .eq("id", "default")
          .maybeSingle();
        const raw = Array.isArray(blob?.gifts) ? (blob.gifts as Record<string, unknown>[]) : [];
        const match = raw.find((g) => String(g.id ?? "") === gid);
        if (!match) {
          res.status(400).json({ error: "unknown gift" });
          return;
        }
        price = Math.floor(Number(match.stars ?? match.price) || 0);
        name = String(match.name ?? name);
        giftTier = String(match.tier ?? giftTier);
      } catch {
        res.status(400).json({ error: "gift catalog unavailable" });
        return;
      }
    }

    if (price <= 0) {
      res.status(400).json({ error: "gift price required" });
      return;
    }

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
      const status =
        msg.includes("insufficient") || msg.includes("limit") ? 402 : 400;
      res.status(status).json({ error: msg });
      return;
    }

    const result = data as Record<string, unknown>;
    res.json({
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
  } catch (err) {
    next(err);
  }
});

/** Gift history for current user (sent + received). */
router.get("/history", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 40)));
    const { data, error } = await getSupabaseService()
      .from("gift_transactions")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ transactions: data ?? [] });
  } catch (err) {
    next(err);
  }
});

/** Room leaderboard (daily sender/receiver). */
router.get("/rankings/:roomId", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const role = String(req.query.role || "sender") === "receiver" ? "receiver" : "sender";
    const dayKey = String(req.query.day || new Date().toISOString().slice(0, 10));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || 20)));

    const { data, error } = await getSupabaseService()
      .from("gift_room_stats")
      .select("user_id, coins_total, gifts_count, updated_at")
      .eq("room_id", roomId)
      .eq("role", role)
      .eq("day_key", dayKey)
      .order("coins_total", { ascending: false })
      .limit(limit);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ roomId, role, dayKey, rankings: data ?? [] });
  } catch (err) {
    next(err);
  }
});

export default router;
