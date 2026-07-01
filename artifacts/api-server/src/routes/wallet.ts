import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

router.get("/", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { data: wallet, error: walletErr } = await getSupabaseService()
      .from("wallets")
      .select("balance, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (walletErr) {
      res.status(400).json({ error: walletErr.message });
      return;
    }

    const { data: txs, error: txErr } = await getSupabaseService()
      .from("wallet_transactions")
      .select("id, from_user, to_user, amount, tx_type, metadata, created_at")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(25);
    if (txErr) {
      res.status(400).json({ error: txErr.message });
      return;
    }

    res.json({
      balance: wallet?.balance ?? 0,
      updatedAt: wallet?.updated_at ?? null,
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

router.post("/credit", auth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, amount, txType, metadata } = req.body as {
      userId?: string;
      amount?: number;
      txType?: string;
      metadata?: Record<string, unknown>;
    };
    if (!userId || !amount || amount <= 0) {
      res.status(400).json({ error: "userId and positive amount required" });
      return;
    }
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
  } catch (err) {
    next(err);
  }
});

export default router;
