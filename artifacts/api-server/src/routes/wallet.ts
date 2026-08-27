import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

router.get("/", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const sb = getSupabaseService();

    try {
      await sb.rpc("ensure_wallet", { p_user_id: userId });
    } catch {
      /* wallet row may already exist via auth trigger */
    }

    // Prefer full ledger columns; fall back if commerce_coin_earnings migration not yet applied.
    let wallet: Record<string, unknown> | null = null;
    {
      const full = await sb
        .from("wallets")
        .select(
          "balance, diamonds, reward_points, bonus_coins, promo_credits, vip_tokens, commerce_coin_earnings, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (full.error && /commerce_coin_earnings/i.test(full.error.message)) {
        const basic = await sb
          .from("wallets")
          .select("balance, diamonds, reward_points, bonus_coins, promo_credits, vip_tokens, updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (basic.error) {
          res.status(400).json({ error: basic.error.message });
          return;
        }
        wallet = (basic.data as Record<string, unknown> | null) ?? null;
      } else if (full.error) {
        res.status(400).json({ error: full.error.message });
        return;
      } else {
        wallet = (full.data as Record<string, unknown> | null) ?? null;
      }
    }

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
    if (txErr) {
      res.status(400).json({ error: txErr.message });
      return;
    }

    const coins = Number(wallet?.balance ?? 0);
    res.json({
      /** Primary spendable coins (legacy field). */
      balance: coins,
      coins,
      diamonds: Number(wallet?.diamonds ?? 0),
      rewardPoints: Number(wallet?.reward_points ?? 0),
      bonusCoins: Number(wallet?.bonus_coins ?? 0),
      promoCredits: Number(wallet?.promo_credits ?? 0),
      vipTokens: Number(wallet?.vip_tokens ?? 0),
      commerceCoinEarnings: Number((wallet as { commerce_coin_earnings?: number } | null)?.commerce_coin_earnings ?? 0),
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
  } catch (err) {
    next(err);
  }
});

router.post("/transfer", auth, requireNotBanned, async (req, res, next) => {
  try {
    const fromUser = req.authUser!.id;
    const { toUser, amount } = req.body as { toUser?: string; amount?: number };
    if (!toUser || !amount || amount <= 0) {
      res.status(400).json({ error: "toUser and positive amount required" });
      return;
    }
    const { data, error } = await getSupabaseService().rpc("transfer_coins", {
      from_user: fromUser,
      to_user: toUser,
      amount: Math.floor(amount),
    });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** Commerce coin checkout — debit buyer coins, credit seller commerce_coin_earnings (not gift balance). */
router.post("/commerce-settle", auth, requireNotBanned, async (req, res, next) => {
  try {
    const buyerId = req.authUser!.id;
    const { sellerId, amount, clientRequestId, metadata } = req.body as {
      sellerId?: string;
      amount?: number;
      clientRequestId?: string;
      metadata?: Record<string, unknown>;
    };
    if (!sellerId || !amount || amount <= 0) {
      res.status(400).json({ error: "sellerId and positive amount required" });
      return;
    }
    const { data, error } = await getSupabaseService().rpc("settle_commerce_coin_sale", {
      p_buyer: buyerId,
      p_seller: sellerId,
      p_amount: Math.floor(amount),
      p_client_request_id: clientRequestId ?? null,
      p_metadata: metadata ?? {},
    });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** In-app coin spend — shop packs, game redemption, wallet utilities (server ledger). */
router.post("/spend", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { amount, txType, metadata, clientRequestId } = req.body as {
      amount?: number;
      txType?: string;
      metadata?: Record<string, unknown>;
      clientRequestId?: string;
    };
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "positive amount required" });
      return;
    }
    const { data, error } = await getSupabaseService().rpc("spend_wallet_coins", {
      p_user: userId,
      p_amount: Math.floor(amount),
      p_tx_type: txType ?? "purchase",
      p_metadata: metadata ?? {},
      p_client_request_id: clientRequestId ?? null,
    });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/credit", auth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, amount, txType, metadata, currency } = req.body as {
      userId?: string;
      amount?: number;
      txType?: string;
      metadata?: Record<string, unknown>;
      currency?: string;
    };
    if (!userId || !amount || amount <= 0) {
      res.status(400).json({ error: "userId and positive amount required" });
      return;
    }

    const cur = String(currency || "coins");
    if (cur === "coins") {
      const { data, error } = await getSupabaseService().rpc("credit_coins", {
        target_user: userId,
        amount: Math.floor(amount),
        tx_type: txType ?? "credit",
        metadata: metadata ?? {},
      });
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.json(data);
      return;
    }

    const { data, error } = await getSupabaseService().rpc("credit_wallet_currency", {
      target_user: userId,
      amount: Math.floor(amount),
      p_currency: cur,
      tx_type: txType ?? "credit",
      metadata: metadata ?? {},
      p_idempotency_key: null,
    });
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
