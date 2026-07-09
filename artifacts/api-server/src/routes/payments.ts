import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function stripeClient(): Stripe | null {
  const secret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) return null;
  return new Stripe(secret);
}

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
        productId,
        productTitle,
        roomId,
        hostUserId,
        buyerUserId,
        orderId,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            product_data: {
              name: productTitle,
              metadata: { productId, roomId },
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

    const sessionId = String(req.query.sessionId || "").trim();
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";
    res.json({
      paid,
      amountUsdCents: session.amount_total ?? undefined,
      orderId: session.metadata?.orderId ?? session.client_reference_id ?? null,
      hostUserId: session.metadata?.hostUserId ?? null,
      productId: session.metadata?.productId ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
