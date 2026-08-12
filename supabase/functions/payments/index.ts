/**
 * Supabase Edge Function — payments (Stripe recharge + live commerce)
 * Migrated from artifacts/api-server/src/routes/payments.ts
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireNotBanned } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

function stripeClient(): Stripe | null {
  const secret = String(Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const url = new URL(req.url);
  const seg = subPath(url, "payments");
  const path = seg.join("/");
  const sb = getSupabaseService();

  // GET /payments/recharge/packages — public
  if (req.method === "GET" && path === "recharge/packages") {
    const { data, error } = await sb
      .from("recharge_packages")
      .select("id, title, coins, bonus_coins, price_usd_cents, badge, providers, sort_order, active")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) return json({ error: error.message }, 400);
    return json({
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
  }

  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  const banned = requireNotBanned(ctx);
  if (banned) return banned;
  const userId = ctx.user.id;

  if (req.method === "POST" && path === "recharge/checkout-session") {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY." }, 503);
    const { packageId, successUrl, cancelUrl } = (await req.json().catch(() => ({}))) as {
      packageId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    const pkgId = String(packageId || "").trim();
    if (!pkgId || !successUrl || !cancelUrl) {
      return json({ error: "packageId, successUrl, and cancelUrl required" }, 400);
    }

    const { data: pkg, error: pkgErr } = await sb
      .from("recharge_packages")
      .select("*")
      .eq("id", pkgId)
      .eq("active", true)
      .maybeSingle();
    if (pkgErr || !pkg) return json({ error: pkgErr?.message || "package not found" }, 404);

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
      return json({ error: orderErr?.message || "could not create order" }, 400);
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
      return json({ error: "Stripe checkout session could not be created" }, 500);
    }

    await sb
      .from("recharge_orders")
      .update({ provider_ref: session.id, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    return json({ sessionId: session.id, url: session.url, orderId: order.id });
  }

  if (req.method === "POST" && path === "recharge/verify-session") {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "Stripe is not configured" }, 503);
    const sessionId = String(
      ((await req.json().catch(() => ({}))) as { sessionId?: string }).sessionId ||
        url.searchParams.get("sessionId") ||
        "",
    ).trim();
    if (!sessionId) return json({ error: "sessionId is required" }, 400);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.commerce !== "recharge") {
      return json({ error: "not a recharge session" }, 400);
    }
    if (session.metadata?.buyerUserId && session.metadata.buyerUserId !== userId) {
      return json({ error: "session does not belong to this user" }, 403);
    }

    const orderId = session.metadata?.orderId || session.client_reference_id || null;
    if (!orderId) return json({ error: "order missing on session" }, 400);

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
      if (creditErr) return json({ error: creditErr.message }, 400);
      return json({ paid: true, credited: true, orderId, credit });
    }
    return json({ paid: false, credited: false, orderId });
  }

  if (req.method === "POST" && path === "commerce/checkout-session") {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY." }, 503);
    const body = (await req.json().catch(() => ({}))) as {
      amountUsdCents?: number;
      productId?: string;
      productTitle?: string;
      roomId?: string;
      hostUserId?: string;
      orderId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    const cents = Math.floor(Number(body.amountUsdCents) || 0);
    if (!body.productId || !body.productTitle || !body.roomId || !body.hostUserId || !body.orderId || cents < 50) {
      return json({ error: "Invalid commerce checkout payload" }, 400);
    }
    if (cents > 500_000) return json({ error: "amount exceeds maximum" }, 400);
    if (!body.successUrl || !body.cancelUrl) {
      return json({ error: "successUrl and cancelUrl are required" }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      client_reference_id: body.orderId,
      metadata: {
        commerce: "live",
        productId: String(body.productId).slice(0, 120),
        productTitle: String(body.productTitle).slice(0, 200),
        roomId: String(body.roomId).slice(0, 120),
        hostUserId: String(body.hostUserId).slice(0, 120),
        buyerUserId: userId,
        orderId: String(body.orderId).slice(0, 120),
        amountUsdCents: String(cents),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            product_data: {
              name: String(body.productTitle).slice(0, 200),
              metadata: {
                productId: String(body.productId).slice(0, 120),
                roomId: String(body.roomId).slice(0, 120),
              },
            },
          },
        },
      ],
    });

    if (!session.url || !session.id) {
      return json({ error: "Stripe checkout session could not be created" }, 500);
    }
    return json({ sessionId: session.id, url: session.url });
  }

  if (req.method === "GET" && path === "commerce/verify-session") {
    const stripe = stripeClient();
    if (!stripe) return json({ error: "Stripe is not configured" }, 503);
    const sessionId = String(url.searchParams.get("sessionId") || "").trim();
    if (!sessionId) return json({ error: "sessionId is required" }, 400);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.commerce !== "live") return json({ error: "not a commerce session" }, 400);
    if (session.metadata?.buyerUserId && session.metadata.buyerUserId !== userId) {
      return json({ error: "session does not belong to this user" }, 403);
    }

    const amountUsdCents =
      session.amount_total ??
      (session.metadata?.amountUsdCents ? Number(session.metadata.amountUsdCents) : undefined);
    return json({
      paid: session.payment_status === "paid",
      amountUsdCents: Number.isFinite(amountUsdCents) ? amountUsdCents : undefined,
      orderId: session.metadata?.orderId ?? session.client_reference_id ?? null,
      hostUserId: session.metadata?.hostUserId ?? null,
      productId: session.metadata?.productId ?? null,
      productTitle: session.metadata?.productTitle ?? null,
      roomId: session.metadata?.roomId ?? null,
      buyerUserId: session.metadata?.buyerUserId ?? null,
    });
  }

  return json({ error: "not_found" }, 404);
});
