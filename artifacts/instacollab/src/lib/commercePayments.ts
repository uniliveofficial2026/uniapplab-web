import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { creditHostCommerceCoinEarnings } from './ledger/ledgerLanes';
import {
  createCommerceCheckoutSession,
  isPlatformApiAvailable,
  settleCommerceCoinSaleApi,
  verifyCommerceCheckoutSession,
} from './platformApi';
import { syncServerWalletBalance } from './walletServerSync';
import { spendWalletCoins } from './walletKstarSync';

export const COMMERCE_PENDING_ORDER_KEY = 'commerce_live_pending_order';

type HostCashEarnings = Record<string, number>;

function creditHostCashEarnings(hostUserId: string, amountUsd: number): void {
  const hostId = hostUserId?.trim();
  const amount = Math.max(0, Number(amountUsd) || 0);
  if (!hostId || amount <= 0) return;

  if (hostId === db.currentUserId?.trim()) {
    const current = Number(db.load('cash_balance', 0));
    db.save('cash_balance', current + amount);
    return;
  }

  const earnings = db.load<HostCashEarnings>('commerce_host_earnings', {});
  earnings[hostId] = (earnings[hostId] ?? 0) + amount;
  db.save('commerce_host_earnings', earnings);
}

export function applyPendingHostCashEarnings(userId: string): void {
  const id = userId?.trim();
  if (!id || id !== db.currentUserId?.trim()) return;
  const earnings = db.load<HostCashEarnings>('commerce_host_earnings', {});
  const pending = earnings[id] ?? 0;
  if (pending <= 0) return;
  const current = Number(db.load('cash_balance', 0));
  db.save('cash_balance', current + pending);
  const next = { ...earnings };
  delete next[id];
  db.save('commerce_host_earnings', next);
}

export async function settleCommerceCoinSale(
  buyerUserId: string,
  hostUserId: string,
  amount: number,
): Promise<{ ok: boolean; reason?: string }> {
  const buyerId = buyerUserId?.trim();
  const hostId = hostUserId?.trim();
  const cost = Math.max(0, Math.floor(amount));
  if (!buyerId || !hostId || cost <= 0) {
    return { ok: false, reason: 'Invalid commerce sale' };
  }
  if (buyerId !== db.currentUserId?.trim()) {
    return { ok: false, reason: 'Coin checkout requires the buyer account' };
  }

  if (isPlatformApiAvailable() && isCloudAuthUserId(buyerId) && isCloudAuthUserId(hostId)) {
    try {
      const clientRequestId = `commerce_${buyerId}_${hostId}_${cost}_${Date.now()}`;
      await settleCommerceCoinSaleApi({
        sellerId: hostId,
        amount: cost,
        clientRequestId,
        metadata: { lane: 'commerce' },
      });
      await syncServerWalletBalance(buyerId);
      creditHostCommerceCoinEarnings(hostId, cost);
      if (hostId === db.currentUserId?.trim()) {
        await syncServerWalletBalance(hostId);
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'commerce_settle_failed' };
    }
  }

  if (!spendWalletCoins(buyerId, cost)) {
    return { ok: false, reason: 'Not enough coins for this item' };
  }
  // Seller coin earnings stay on commerce lane — never gift-wallet spendable coins.
  creditHostCommerceCoinEarnings(hostId, cost);
  return { ok: true };
}

export function settleCommerceCashBalanceSale(
  buyerUserId: string,
  hostUserId: string,
  amountUsd: number,
): { ok: boolean; reason?: string } {
  const buyerId = buyerUserId?.trim();
  const hostId = hostUserId?.trim();
  const cost = Math.max(0, Number(amountUsd) || 0);
  if (!buyerId || !hostId || cost <= 0) {
    return { ok: false, reason: 'Invalid commerce sale' };
  }
  if (buyerId !== db.currentUserId?.trim()) {
    return { ok: false, reason: 'Cash balance checkout requires the buyer account' };
  }

  const cashBalance = Number(db.load('cash_balance', 0));
  if (cashBalance < cost) {
    return { ok: false, reason: 'Insufficient cash balance' };
  }
  db.save('cash_balance', cashBalance - cost);
  creditHostCashEarnings(hostId, cost);
  return { ok: true };
}

export function creditHostStripeSale(hostUserId: string, amountUsd: number): void {
  creditHostCashEarnings(hostUserId, amountUsd);
}

export function isStripeCommerceConfigured(): boolean {
  return Boolean(String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim());
}

export async function startStripeCommerceCheckout(input: {
  amountUsd: number;
  productId: string;
  productTitle: string;
  roomId: string;
  hostUserId: string;
  orderId: string;
  buyerUserId: string;
  pendingOrder: unknown;
}): Promise<{ sessionId: string; url: string }> {
  const origin = window.location.origin;
  const roomPath = `/room/${encodeURIComponent(input.roomId)}`;
  const successUrl = `${origin}${roomPath}?commerce_checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${roomPath}?commerce_checkout=cancel`;

  const session = await createCommerceCheckoutSession({
    amountUsdCents: Math.max(50, Math.round(input.amountUsd * 100)),
    productId: input.productId,
    productTitle: input.productTitle,
    roomId: input.roomId,
    hostUserId: input.hostUserId,
    orderId: input.orderId,
    buyerUserId: input.buyerUserId,
    successUrl,
    cancelUrl,
  });

  sessionStorage.setItem(
    COMMERCE_PENDING_ORDER_KEY,
    JSON.stringify({
      sessionId: session.sessionId,
      pendingOrder: input.pendingOrder,
    }),
  );

  return session;
}

export async function completeStripeCommerceReturn(sessionId: string): Promise<{
  paid: boolean;
  pendingOrder: unknown | null;
  amountUsdCents?: number;
  hostUserId?: string | null;
  orderId?: string | null;
  productId?: string | null;
  productTitle?: string | null;
  buyerUserId?: string | null;
}> {
  const verification = await verifyCommerceCheckoutSession(sessionId);
  const raw = sessionStorage.getItem(COMMERCE_PENDING_ORDER_KEY);
  const stored = raw ? (JSON.parse(raw) as { sessionId?: string; pendingOrder?: unknown }) : null;
  if (!stored || stored.sessionId !== sessionId) {
    return {
      paid: verification.paid,
      pendingOrder: null,
      amountUsdCents: verification.amountUsdCents,
      hostUserId: verification.hostUserId,
      orderId: verification.orderId,
      productId: verification.productId,
      productTitle: verification.productTitle,
      buyerUserId: verification.buyerUserId,
    };
  }
  sessionStorage.removeItem(COMMERCE_PENDING_ORDER_KEY);
  return {
    paid: verification.paid,
    pendingOrder: stored.pendingOrder ?? null,
    amountUsdCents: verification.amountUsdCents,
    hostUserId: verification.hostUserId,
    orderId: verification.orderId,
    productId: verification.productId,
    productTitle: verification.productTitle,
    buyerUserId: verification.buyerUserId,
  };
}

export { createCommerceCheckoutSession, verifyCommerceCheckoutSession };
