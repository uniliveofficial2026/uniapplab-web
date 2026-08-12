import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { logger } from "../lib/logger";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

function stripeClient(): Stripe | null {
  const secret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) return null;
  return new Stripe(secret);
}

/** Active coin recharge packages (Stripe / IAP / Play placeholders). */
router.get("/recharge/packages", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseService()
      .from("recharge_packages")
      .select(
        "id, title, coins, bonus_coins, price_usd_cents, badge, providers, sort_order, active",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({
      packages: (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        coins: Number(row.coins),
        bonusCoins: Number(row.bonus_coins),
        priceUsdCents: Number(row.price_usd_cents),
        badge: row.badge,
        providers: row.providers ?? ["stripe"],
        sortOrder: row.sort_order,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Create Stripe Checkout for a coin recharge package. */
router.post("/recharge/checkout-session", auth, requireNotBanned, async (req, res, next) => {
  try {
    const stripe = stripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY." });
      return;
    }

    const userId = req.authUser!.id;
    const { packageId, successUrl, cancelUrl } = req.body as {
      packageId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    const pkgId = String(packageId || "").trim();
    if (!pkgId || !successUrl || !cancelUrl) {
      res.status(400).json({ error: "packageId, successUrl, and cancelUrl required" });
      return;
    }

    const sb = getSupabaseService();
    const { data: pkg, error: pkgErr } = await sb
      .from("recharge_packages")
      .select("*")
      .eq("id", pkgId)
      .eq("active", true)
      .maybeSingle();
    if (pkgErr || !pkg) {
      res.status(404).json({ error: pkgErr?.message || "package not found" });
      return;
    }

    const { data: order, error: orderErr } = await sb
      .from("recharge_orders")
      .insert({
        user_id: userId,
        package_id: pkg.id,
        provider: "stripe",
        coins: pkg.coins,
        bonus_coins: pkg.bonus_coins,
        price_usd_cents: pkg.price_usd_cents,
        status: "pending",
      })
      .select("id")
      .single();
    if (orderErr || !order) {
      res.status(400).json({ error: orderErr?.message || "could not create order" });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl.includes("{CHECKOUT_SESSION_ID}")
        ? successUrl
        : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      client_reference_id: order.id,
      metadata: {
        commerce: "recharge",
        packageId: pkg.id,
        orderId: order.id,
        buyerUserId: userId,
        coins: String(pkg.coins),
        bonusCoins: String(pkg.bonus_coins),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Number(pkg.price_usd_cents),
            product_data: {
              name: `${pkg.title} — ${pkg.coins} coins`,
              metadata: { packageId: pkg.id, orderId: order.id },
            },
          },
        },
      ],
    });

    if (!session.url || !session.id) {
      res.status(500).json({ error: "Stripe checkout session could not be created" });
      return;
    }

    await sb
      .from("recharge_orders")
      .update({ provider_ref: session.id, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    res.json({ sessionId: session.id, url: session.url, orderId: order.id });
  } catch (err) {
    logger.error({ err }, "recharge checkout session failed");
    next(err);
  }
});

/** Verify Stripe recharge session and credit wallet (idempotent). */
router.post("/recharge/verify-session", auth, requireNotBanned, async (req, res, next) => {
  try {
    const stripe = stripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Stripe is not configured" });
      return;
    }

    const userId = req.authUser!.id;
    const sessionId = String(
      (req.body as { sessionId?: string })?.sessionId || req.query.sessionId || "",
    ).trim();
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.commerce !== "recharge") {
      res.status(400).json({ error: "not a recharge session" });
      return;
    }
    if (session.metadata?.buyerUserId && session.metadata.buyerUserId !== userId) {
      res.status(403).json({ error: "session does not belong to this user" });
      return;
    }

    const sb = getSupabaseService();
    const orderId =
      session.metadata?.orderId || session.client_reference_id || null;
    if (!orderId) {
      res.status(400).json({ error: "order missing on session" });
      return;
    }

    const paid = session.payment_status === "paid";
    if (paid) {
      await sb
        .from("recharge_orders")
        .update({
          status: "paid",
          provider_ref: sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("user_id", userId)
        .in("status", ["pending", "paid"]);

      const { data: credit, error: creditErr } = await sb.rpc("credit_recharge_order", {
        p_order_id: orderId,
      });
      if (creditErr) {
        res.status(400).json({ error: creditErr.message });
        return;
      }
      res.json({ paid: true, credited: true, orderId, credit });
      return;
    }

    res.json({ paid: false, credited: false, orderId });
  } catch (err) {
    next(err);
  }
});

router.post("/commerce/checkout-session", auth, requireNotBanned, async (req, res, next) => {
  try {
    const stripe = stripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY." });
      return;
    }

    const buyerUserId = req.authUser!.id;
    const {
      amountUsdCents,
      productId,
      productTitle,
      roomId,
      hostUserId,
      orderId,
      successUrl,
      cancelUrl,
    } = req.body as {
      amountUsdCents?: number;
      productId?: string;
      productTitle?: string;
      roomId?: string;
      hostUserId?: string;
      orderId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    const cents = Math.floor(Number(amountUsdCents) || 0);
    if (!productId || !productTitle || !roomId || !hostUserId || !orderId || cents < 50) {
      res.status(400).json({ error: "Invalid commerce checkout payload" });
      return;
    }
    // Hard cap — client amount is still used until products are server-priced.
    if (cents > 500_000) {
      res.status(400).json({ error: "amount exceeds maximum" });
      return;
    }
    if (!successUrl || !cancelUrl) {
      res.status(400).json({ error: "successUrl and cancelUrl are required" });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orderId,
      metadata: {
        commerce: "live",
        productId: String(productId).slice(0, 120),
        productTitle: String(productTitle).slice(0, 200),
        roomId: String(roomId).slice(0, 120),
        hostUserId: String(hostUserId).slice(0, 120),
        buyerUserId,
        orderId: String(orderId).slice(0, 120),
        amountUsdCents: String(cents),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            product_data: {
              name: String(productTitle).slice(0, 200),
              metadata: { productId: String(productId).slice(0, 120), roomId: String(roomId).slice(0, 120) },
            },
          },
        },
      ],
    });

    if (!session.url || !session.id) {
      res.status(500).json({ error: "Stripe checkout session could not be created" });
      return;
    }

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    logger.error({ err }, "commerce checkout session failed");
    next(err);
  }
});

router.get("/commerce/verify-session", auth, requireNotBanned, async (req, res, next) => {
  try {
    const stripe = stripeClient();
    if (!stripe) {
      res.status(503).json({ error: "Stripe is not configured" });
      return;
    }

    const userId = req.authUser!.id;
    const sessionId = String(req.query.sessionId || "").trim();
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.commerce !== "live") {
      res.status(400).json({ error: "not a commerce session" });
      return;
    }
    if (session.metadata?.buyerUserId && session.metadata.buyerUserId !== userId) {
      res.status(403).json({ error: "session does not belong to this user" });
      return;
    }

    const amountUsdCents =
      session.amount_total ??
      (session.metadata?.amountUsdCents ? Number(session.metadata.amountUsdCents) : undefined);
    const paid = session.payment_status === "paid";
    res.json({
      paid,
      amountUsdCents: Number.isFinite(amountUsdCents) ? amountUsdCents : undefined,
      orderId: session.metadata?.orderId ?? session.client_reference_id ?? null,
      hostUserId: session.metadata?.hostUserId ?? null,
      productId: session.metadata?.productId ?? null,
      productTitle: session.metadata?.productTitle ?? null,
      roomId: session.metadata?.roomId ?? null,
      buyerUserId: session.metadata?.buyerUserId ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
