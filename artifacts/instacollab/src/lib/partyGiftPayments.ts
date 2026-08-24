import { isCloudAuthUserId } from './auth/cloudProfile';
import { shouldUseFirebaseForCloudData } from './auth/cloudDataBackend';
import { db } from './db/localDb';
import {
  isFirebaseGiftWalletAvailable,
  ensureFirebaseWallet,
  mirrorGiftSettleToFirebase,
  settleFirebaseGiftSend,
} from './firebase/giftWallet';
import {
  isPlatformApiAvailable,
  sendGiftApi,
  type SendGiftResponse,
} from './platformApi';
import { syncServerWalletBalance } from './walletServerSync';
import { creditLocalGiftDiamonds } from './ledger/ledgerLanes';
import {
  getLiveCoinsBalance,
  isLocalWalletLedgerAllowed,
  spendWalletCoins,
  saveWalletCoinsBalance,
} from './walletKstarSync';
import { giftTierFromStars } from './live/giftTiers';
import { mintLocalDemoSettlementId } from './live/giftAuthority';

export type SettlePartyGiftOptions = {
  giftId: string;
  giftName?: string;
  roomId?: string;
  quantity?: number;
  combo?: number;
  clientRequestId?: string;
  tier?: string;
  /** Caller already debited local coins for instant UI; settle must not debit again. */
  alreadyDebitedLocally?: boolean;
};

/** Debit sender and credit receiver for a party-room gift (API → Firebase → local demo only). */
export async function settlePartyGiftSend(
  buyerUserId: string,
  receiverUserId: string | null | undefined,
  amount: number,
  options?: SettlePartyGiftOptions,
): Promise<{ ok: boolean; reason?: string; settle?: SendGiftResponse }> {
  const buyerId = buyerUserId?.trim();
  const cost = Math.max(0, Math.floor(amount));
  const quantity = Math.max(1, Math.floor(options?.quantity ?? 1));
  const unitPrice = Math.max(1, Math.floor(cost / quantity) || cost);
  const totalCost = unitPrice * quantity;
  const alreadyDebited = Boolean(options?.alreadyDebitedLocally);

  if (!buyerId || totalCost <= 0) {
    return { ok: false, reason: 'Invalid gift' };
  }
  if (buyerId !== db.currentUserId?.trim()) {
    return { ok: false, reason: 'Gift send requires the active account' };
  }
  if (!alreadyDebited && getLiveCoinsBalance(buyerId) < totalCost) {
    return { ok: false, reason: 'Not enough coins' };
  }

  const receiverId = receiverUserId?.trim() || null;
  const giftId = options?.giftId?.trim() || `gift_${unitPrice}`;
  const clientRequestId =
    options?.clientRequestId ??
    `gift_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const tier = options?.tier ?? giftTierFromStars(unitPrice);
  const preferFirebase =
    shouldUseFirebaseForCloudData(buyerId) || !isPlatformApiAvailable();
  const cloudBuyer = isCloudAuthUserId(buyerId);
  const localLedgerOk = isLocalWalletLedgerAllowed(buyerId);

  const cloudReady =
    receiverId &&
    receiverId !== buyerId &&
    cloudBuyer &&
    isCloudAuthUserId(receiverId);

  if (cloudReady && receiverId) {
    // 1) Supabase API settle (authoritative when available and not on Firebase backup)
    if (!preferFirebase && isPlatformApiAvailable()) {
      try {
        const settle = await sendGiftApi({
          giftId,
          receiverId,
          roomId: options?.roomId,
          quantity,
          combo: options?.combo ?? 1,
          clientRequestId,
          giftName: options?.giftName,
          unitPrice,
          tier,
        });
        if (settle?.ok) {
          await syncServerWalletBalance(buyerId);
          if (receiverId === db.currentUserId?.trim()) {
            await syncServerWalletBalance(receiverId);
          }
          void mirrorGiftSettleToFirebase({
            senderId: buyerId,
            receiverId,
            giftId,
            giftName: options?.giftName,
            unitPrice,
            quantity,
            combo: options?.combo ?? 1,
            roomId: options?.roomId,
            tier,
            clientRequestId,
            giftTransactionId: settle.giftTransactionId,
            totalCoins: settle.totalCoins ?? totalCost,
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          }
          return { ok: true, settle };
        }
      } catch {
        /* Do not fall back to local mint — server may have already settled. */
        return { ok: false, reason: 'gift_settle_failed' };
      }
    }

    // 2) Firebase dual-lane settle (never seed balance from client local cache)
    if (isFirebaseGiftWalletAvailable()) {
      try {
        await ensureFirebaseWallet(buyerId);
        await ensureFirebaseWallet(receiverId);
        const settle = await settleFirebaseGiftSend({
          senderId: buyerId,
          receiverId,
          giftId,
          giftName: options?.giftName,
          unitPrice,
          quantity,
          combo: options?.combo ?? 1,
          roomId: options?.roomId,
          tier,
          clientRequestId,
        });
        if (settle?.ok) {
          const nextCoins = settle.balances?.senderCoins;
          if (typeof nextCoins === 'number') {
            saveWalletCoinsBalance(buyerId, nextCoins);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          }
          return { ok: true, settle };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('insufficient')) {
          return { ok: false, reason: 'Not enough coins' };
        }
        /* Prefer API retry below — never local mint for cloud. */
      }
    }

    // 3) Retry API if we preferred Firebase first but it failed
    if (preferFirebase && isPlatformApiAvailable()) {
      try {
        const settle = await sendGiftApi({
          giftId,
          receiverId,
          roomId: options?.roomId,
          quantity,
          combo: options?.combo ?? 1,
          clientRequestId,
          giftName: options?.giftName,
          unitPrice,
          tier,
        });
        if (settle?.ok) {
          await syncServerWalletBalance(buyerId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          }
          return { ok: true, settle };
        }
      } catch {
        return { ok: false, reason: 'gift_settle_failed' };
      }
    }

    return { ok: false, reason: 'gift_settle_failed' };
  }

  // Cloud sender without cloud-ready peer path: still refuse local mint.
  if (cloudBuyer || !localLedgerOk) {
    if (isPlatformApiAvailable() && receiverId && receiverId !== buyerId) {
      try {
        const settle = await sendGiftApi({
          giftId,
          receiverId,
          roomId: options?.roomId,
          quantity,
          combo: options?.combo ?? 1,
          clientRequestId,
          giftName: options?.giftName,
          unitPrice,
          tier,
        });
        if (settle?.ok) {
          await syncServerWalletBalance(buyerId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          }
          return { ok: true, settle };
        }
      } catch {
        return { ok: false, reason: 'gift_settle_failed' };
      }
    }
    return { ok: false, reason: 'gift_settle_failed' };
  }

  // Local/demo ledger only — still mint an authoritative settlement id for FX lanes.
  // Receiver gets diamonds (gift lane), never spendable coins / commerce seller earnings.
  if (!alreadyDebited) {
    if (!spendWalletCoins(buyerId, totalCost)) {
      return { ok: false, reason: 'Not enough coins' };
    }
  }
  if (receiverId && receiverId !== buyerId) {
    creditLocalGiftDiamonds(receiverId, totalCost);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
  }
  const giftTransactionId = mintLocalDemoSettlementId(clientRequestId);
  const settle = {
    ok: true,
    giftTransactionId,
    totalCoins: totalCost,
    quantity,
    clientRequestId,
  } as SendGiftResponse;
  // Local/demo wallet settle still feeds PK lifecycle so scores stay server-authoritative.
  if (options?.roomId?.trim() && receiverId && receiverId !== buyerId) {
    try {
      const { notifyLifecycleGiftSettlement } = await import('./platformApi');
      await notifyLifecycleGiftSettlement({
        roomId: options.roomId.trim(),
        clientRequestId,
        receiverId,
        value: totalCost,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('live-pk-score-updated', { detail: { roomId: options.roomId.trim() } }));
      }
    } catch {
      /* PK score may lag until next dashboard poll; wallet settle already succeeded */
    }
  }
  return { ok: true, settle };
}
