/**
 * Supabase Edge Function — wallet API.
 * Migrated from Vercel Express (artifacts/api-server/src/routes/wallet.ts).
 * Routes:
 *   GET  /wallet            → balance + limits + recent transactions
 *   POST /wallet/transfer   → transfer coins to another user
 *   POST /wallet/credit     → admin credit (coins or other currency)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireAdmin, requireNotBanned } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const url = new URL(req.url);
  const seg = subPath(url, "wallet");
  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;

  const sb = getSupabaseService();

  // GET /wallet
  if (req.method === "GET" && seg.length === 0) {
    const banned = requireNotBanned(ctx);
    if (banned) return banned;
    const userId = ctx.user.id;

    try {
      await sb.rpc("ensure_wallet", { p_user_id: userId });
    } catch {
      /* wallet row may already exist via auth trigger */
    }

    const { data: wallet, error: walletErr } = await sb
      .from("wallets")
      .select(
        "balance, diamonds, reward_points, bonus_coins, promo_credits, vip_tokens, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (walletErr) return json({ error: walletErr.message }, 400);

    const { data: limits } = await sb
      .from("wallet_spend_limits")
      .select(
        "daily_coin_limit, monthly_coin_limit, daily_spent, monthly_spent, day_key, month_key",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const { data: txs, error: txErr } = await sb
      .from("wallet_transactions")
      .select("id, from_user, to_user, amount, tx_type, currency, metadata, created_at")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(40);
    if (txErr) return json({ error: txErr.message }, 400);

    const coins = Number(wallet?.balance ?? 0);
    return json({
      balance: coins,
      coins,
      diamonds: Number(wallet?.diamonds ?? 0),
      rewardPoints: Number(wallet?.reward_points ?? 0),
      bonusCoins: Number(wallet?.bonus_coins ?? 0),
      promoCredits: Number(wallet?.promo_credits ?? 0),
      vipTokens: Number(wallet?.vip_tokens ?? 0),
      updatedAt: wallet?.updated_at ?? null,
      limits: limits
        ? {
            dailyCoinLimit: Number(limits.daily_coin_limit),
            monthlyCoinLimit: Number(limits.monthly_coin_limit),
            dailySpent: Number(limits.daily_spent),
            monthlySpent: Number(limits.monthly_spent),
            dayKey: limits.day_key,
            monthKey: limits.month_key,
          }
        : null,
      transactions: txs ?? [],
    });
  }

  // POST /wallet/transfer
  if (req.method === "POST" && seg[0] === "transfer") {
    const banned = requireNotBanned(ctx);
    if (banned) return banned;
    const fromUser = ctx.user.id;
    const { toUser, amount } = (await req.json().catch(() => ({}))) as {
      toUser?: string;
      amount?: number;
    };
    if (!toUser || !amount || amount <= 0) {
      return json({ error: "toUser and positive amount required" }, 400);
    }
    const { data, error } = await sb.rpc("transfer_coins", {
      from_user: fromUser,
      to_user: toUser,
      amount: Math.floor(amount),
    });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  }

  // POST /wallet/credit (admin)
  if (req.method === "POST" && seg[0] === "credit") {
    const adminErr = requireAdmin(ctx);
    if (adminErr) return adminErr;
    const { userId, amount, txType, metadata, currency } = (await req
      .json()
      .catch(() => ({}))) as {
      userId?: string;
      amount?: number;
      txType?: string;
      metadata?: Record<string, unknown>;
      currency?: string;
    };
    if (!userId || !amount || amount <= 0) {
      return json({ error: "userId and positive amount required" }, 400);
    }

    const cur = String(currency || "coins");
    if (cur === "coins") {
      const { data, error } = await sb.rpc("credit_coins", {
        target_user: userId,
        amount: Math.floor(amount),
        tx_type: txType ?? "credit",
        metadata: metadata ?? {},
      });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    const { data, error } = await sb.rpc("credit_wallet_currency", {
      target_user: userId,
      amount: Math.floor(amount),
      p_currency: cur,
      tx_type: txType ?? "credit",
      metadata: metadata ?? {},
      p_idempotency_key: null,
    });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  }

  return json({ error: "not_found" }, 404);
});
