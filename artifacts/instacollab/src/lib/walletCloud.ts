import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { applyPendingHostCashEarnings } from './commercePayments';
import { getHostCommerceCoinEarnings } from './ledger/ledgerLanes';
import {
  fetchWallet,
  isPlatformApiAvailable,
  spendWalletCoinsApi,
} from './platformApi';
import { saveWalletCoinsBalance } from './walletKstarSync';
import { syncServerWalletBalance } from './walletServerSync';

export type WalletSpendResult = { ok: true } | { ok: false; reason: string };

function notifyWalletUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
  }
}

/** Full cloud wallet hydrate — coins, seller lanes, cash cache, transaction mirror. */
export async function hydrateWalletFromServer(userId: string): Promise<void> {
  const id = userId?.trim();
  if (!id || id !== db.currentUserId?.trim()) return;

  await syncServerWalletBalance(id);

  if (!isPlatformApiAvailable() || !isCloudAuthUserId(id)) {
    return;
  }

  try {
    const wallet = await fetchWallet();
    if (typeof wallet.commerceCoinEarnings === 'number') {
      db.save('commerce_host_coin_earnings', { [id]: Math.max(0, Math.floor(wallet.commerceCoinEarnings)) });
    }
    applyPendingHostCashEarnings(id);

    if (Array.isArray(wallet.transactions)) {
      db.save('wallet_transactions', mapServerTransactions(id, wallet.transactions));
    }
  } catch {
    /* keep last cached display */
  }
}

export function mapServerTransactions(
  userId: string,
  rows: unknown[],
): Array<Record<string, string>> {
  return rows
    .map((raw) => {
      const t = (raw ?? {}) as Record<string, unknown>;
      const amountNum = Number(t.amount ?? 0);
      if (!Number.isFinite(amountNum) || amountNum <= 0) return null;
      const received = t.to_user === userId || t.toUser === userId;
      const signed = received ? amountNum : -amountNum;
      const currency = String(t.currency ?? 'coins');
      const amountLabel =
        currency === 'coins'
          ? `${signed >= 0 ? '+' : ''}${signed} Coins`
          : `${signed >= 0 ? '+' : ''}${signed} ${currency}`;
      return {
        id: String(t.id ?? ''),
        type: String(t.tx_type ?? t.type ?? 'Transaction'),
        amount: amountLabel,
        status: 'Completed',
        date: String(t.created_at ?? '').replace('T', ' ').slice(0, 16),
        cost: currency !== 'coins' ? currency : undefined,
      };
    })
    .filter((row): row is Record<string, string> => Boolean(row?.id));
}

/** Server-authoritative coin spend for cloud accounts (shop, game redemption, etc.). */
export async function spendWalletCoinsCloud(
  userId: string,
  amount: number,
  metadata?: Record<string, unknown>,
): Promise<WalletSpendResult> {
  const id = userId?.trim();
  const cost = Math.max(0, Math.floor(amount));
  if (!id || cost <= 0) return { ok: false, reason: 'invalid_amount' };
  if (id !== db.currentUserId?.trim()) return { ok: false, reason: 'wrong_session' };
  if (!isPlatformApiAvailable() || !isCloudAuthUserId(id)) {
    return { ok: false, reason: 'cloud_required' };
  }

  try {
    const clientRequestId = `spend_${id}_${cost}_${Date.now()}`;
    await spendWalletCoinsApi({
      amount: cost,
      metadata: metadata ?? {},
      clientRequestId,
    });
    await hydrateWalletFromServer(id);
    notifyWalletUpdated();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'spend_failed';
    if (/insufficient/i.test(message)) {
      return { ok: false, reason: 'insufficient_coins' };
    }
    return { ok: false, reason: message };
  }
}

/** Display cash USD pool — local demo ledger or Stripe commerce cache. */
export function getWalletCashBalance(userId: string): number {
  const id = userId?.trim();
  if (!id) return 0;
  return Math.max(0, Number(db.load('cash_balance', 0)));
}

/** Seller coin earnings lane (never spendable gift coins). */
export function getWalletCommerceCoinEarnings(userId: string): number {
  return getHostCommerceCoinEarnings(userId);
}

/** Write-through after server credit (recharge, admin credit, sync). */
export function applyServerCoinBalance(userId: string, balance: number): void {
  saveWalletCoinsBalance(userId, balance);
}
