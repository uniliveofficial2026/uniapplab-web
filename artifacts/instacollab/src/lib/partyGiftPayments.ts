import { isCloudAuthUserId } from './auth/cloudProfile';
import { db } from './db/localDb';
import { isPlatformApiAvailable, transferCoins } from './platformApi';
import { syncServerWalletBalance } from './walletServerSync';
import { creditUserCoins, getLiveCoinsBalance, spendWalletCoins } from './walletKstarSync';

/** Debit sender and credit receiver for a party-room gift (cloud transfer when available). */
export async function settlePartyGiftSend(
  buyerUserId: string,
  receiverUserId: string | null | undefined,
  amount: number,
): Promise<{ ok: boolean; reason?: string }> {
  const buyerId = buyerUserId?.trim();
  const cost = Math.max(0, Math.floor(amount));
  if (!buyerId || cost <= 0) {
    return { ok: false, reason: 'Invalid gift' };
  }
  if (buyerId !== db.currentUserId?.trim()) {
    return { ok: false, reason: 'Gift send requires the active account' };
  }
  if (getLiveCoinsBalance(buyerId) < cost) {
    return { ok: false, reason: 'Not enough coins' };
  }

  const receiverId = receiverUserId?.trim() || null;

  if (
    receiverId &&
    receiverId !== buyerId &&
    isPlatformApiAvailable() &&
    isCloudAuthUserId(buyerId) &&
    isCloudAuthUserId(receiverId)
  ) {
    try {
      await transferCoins(receiverId, cost);
      await syncServerWalletBalance(buyerId);
      if (receiverId === db.currentUserId?.trim()) {
        await syncServerWalletBalance(receiverId);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
      }
      return { ok: true };
    } catch {
      /* fall through to local ledger */
    }
  }

  if (!spendWalletCoins(buyerId, cost)) {
    return { ok: false, reason: 'Not enough coins' };
  }
  if (receiverId && receiverId !== buyerId) {
    creditUserCoins(receiverId, cost);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
  }
  return { ok: true };
}
