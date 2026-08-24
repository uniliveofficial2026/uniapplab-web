/**
 * Firebase dual-lane gift wallet — mirrors Supabase settle_gift_send when
 * the API/Supabase path is unavailable or the session is on Firebase backup.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';
import type { SendGiftResponse } from '../platformApi';

export type FirebaseWalletBalances = {
  balance: number;
  diamonds: number;
  rewardPoints: number;
  bonusCoins: number;
  promoCredits: number;
  vipTokens: number;
  updatedAt?: string | null;
};

const WALLETS = 'wallets';
const GIFT_TX = 'gift_transactions';
const ROOM_STATS = 'gift_room_stats';

function firestore() {
  return getFirebaseFirestore();
}

export function isFirebaseGiftWalletAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(firestore());
}

function emptyWallet(): FirebaseWalletBalances {
  return {
    balance: 0,
    diamonds: 0,
    rewardPoints: 0,
    bonusCoins: 0,
    promoCredits: 0,
    vipTokens: 0,
    updatedAt: null,
  };
}

function mapWallet(data: Record<string, unknown> | undefined): FirebaseWalletBalances {
  if (!data) return emptyWallet();
  return {
    balance: Math.max(0, Math.floor(Number(data.balance ?? 0))),
    diamonds: Math.max(0, Math.floor(Number(data.diamonds ?? 0))),
    rewardPoints: Math.max(0, Math.floor(Number(data.reward_points ?? 0))),
    bonusCoins: Math.max(0, Math.floor(Number(data.bonus_coins ?? 0))),
    promoCredits: Math.max(0, Math.floor(Number(data.promo_credits ?? 0))),
    vipTokens: Math.max(0, Math.floor(Number(data.vip_tokens ?? 0))),
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

export async function ensureFirebaseWallet(
  userId: string,
  _seedCoins?: number,
): Promise<FirebaseWalletBalances> {
  const db = firestore();
  if (!db || !userId) return emptyWallet();
  const ref = doc(db, WALLETS, userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Never lift cloud balance from client-supplied local coins — server/Firebase is authoritative.
    return mapWallet(snap.data() as Record<string, unknown>);
  }
  const seed = {
    balance: 0,
    diamonds: 0,
    reward_points: 0,
    bonus_coins: 0,
    promo_credits: 0,
    vip_tokens: 0,
    updated_at: new Date().toISOString(),
  };
  await setDoc(ref, seed, { merge: true });
  return mapWallet(seed);
}

export async function fetchFirebaseWallet(userId: string): Promise<FirebaseWalletBalances> {
  const db = firestore();
  if (!db || !userId) return emptyWallet();
  const snap = await getDoc(doc(db, WALLETS, userId));
  if (!snap.exists()) return ensureFirebaseWallet(userId);
  return mapWallet(snap.data() as Record<string, unknown>);
}

export type SettleFirebaseGiftInput = {
  senderId: string;
  receiverId: string;
  giftId: string;
  giftName?: string;
  unitPrice: number;
  quantity?: number;
  combo?: number;
  roomId?: string;
  tier?: string;
  clientRequestId?: string;
};

export async function settleFirebaseGiftSend(
  input: SettleFirebaseGiftInput,
): Promise<SendGiftResponse> {
  const db = firestore();
  if (!db) throw new Error('Firebase is not configured');

  const senderId = input.senderId.trim();
  const receiverId = input.receiverId.trim();
  const giftId = input.giftId.trim();
  const qty = Math.max(1, Math.min(999, Math.floor(input.quantity ?? 1)));
  const combo = Math.max(1, Math.min(9999, Math.floor(input.combo ?? 1)));
  const unitPrice = Math.max(1, Math.floor(input.unitPrice));
  const total = unitPrice * qty;
  const clientRequestId = input.clientRequestId?.trim() || null;
  const dayKey = new Date().toISOString().slice(0, 10);

  if (!senderId || !receiverId || senderId === receiverId || !giftId) {
    throw new Error('invalid gift parties');
  }

  if (clientRequestId) {
    const existing = await getDocs(
      query(
        collection(db, GIFT_TX),
        where('sender_id', '==', senderId),
        where('client_request_id', '==', clientRequestId),
        limit(1),
      ),
    );
    if (!existing.empty) {
      const row = existing.docs[0];
      return {
        ok: true,
        duplicate: true,
        giftTransactionId: row.id,
        totalCoins: total,
        diamondsAwarded: total,
      };
    }
  }

  const senderRef = doc(db, WALLETS, senderId);
  const receiverRef = doc(db, WALLETS, receiverId);
  const txRef = doc(collection(db, GIFT_TX));

  const result = await runTransaction(db, async (tx) => {
    const senderSnap = await tx.get(senderRef);
    const receiverSnap = await tx.get(receiverRef);

    const sender = mapWallet(senderSnap.data() as Record<string, unknown> | undefined);
    const receiver = mapWallet(receiverSnap.data() as Record<string, unknown> | undefined);

    if (sender.bonusCoins + sender.balance < total) {
      throw new Error('insufficient balance');
    }

    const bonusUse = Math.min(sender.bonusCoins, total);
    const coinUse = total - bonusUse;
    const nextSender = {
      balance: sender.balance - coinUse,
      diamonds: sender.diamonds,
      reward_points: sender.rewardPoints,
      bonus_coins: sender.bonusCoins - bonusUse,
      promo_credits: sender.promoCredits,
      vip_tokens: sender.vipTokens,
      updated_at: new Date().toISOString(),
    };
    const nextReceiver = {
      balance: receiver.balance,
      diamonds: receiver.diamonds + total,
      reward_points: receiver.rewardPoints,
      bonus_coins: receiver.bonusCoins,
      promo_credits: receiver.promoCredits,
      vip_tokens: receiver.vipTokens,
      updated_at: new Date().toISOString(),
    };

    tx.set(senderRef, nextSender, { merge: true });
    tx.set(receiverRef, nextReceiver, { merge: true });

    tx.set(txRef, {
      client_request_id: clientRequestId,
      gift_id: giftId,
      gift_name: input.giftName || giftId,
      sender_id: senderId,
      receiver_id: receiverId,
      room_id: input.roomId || null,
      quantity: qty,
      combo,
      unit_price: unitPrice,
      total_coins: total,
      diamonds_awarded: total,
      currency: 'coins',
      tier: input.tier || 'normal',
      created_at: serverTimestamp(),
      backend: 'firebase',
    });

    if (input.roomId) {
      const senderStatId = `${input.roomId}_${senderId}_sender_${dayKey}`;
      const receiverStatId = `${input.roomId}_${receiverId}_receiver_${dayKey}`;
      const senderStatRef = doc(db, ROOM_STATS, senderStatId);
      const receiverStatRef = doc(db, ROOM_STATS, receiverStatId);
      const senderStatSnap = await tx.get(senderStatRef);
      const receiverStatSnap = await tx.get(receiverStatRef);
      const prevSenderCoins = Number(senderStatSnap.data()?.coins_total ?? 0);
      const prevSenderGifts = Number(senderStatSnap.data()?.gifts_count ?? 0);
      const prevReceiverCoins = Number(receiverStatSnap.data()?.coins_total ?? 0);
      const prevReceiverGifts = Number(receiverStatSnap.data()?.gifts_count ?? 0);

      tx.set(
        senderStatRef,
        {
          room_id: input.roomId,
          user_id: senderId,
          role: 'sender',
          day_key: dayKey,
          coins_total: prevSenderCoins + total,
          gifts_count: prevSenderGifts + qty,
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
      tx.set(
        receiverStatRef,
        {
          room_id: input.roomId,
          user_id: receiverId,
          role: 'receiver',
          day_key: dayKey,
          coins_total: prevReceiverCoins + total,
          gifts_count: prevReceiverGifts + qty,
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    return {
      ok: true as const,
      duplicate: false,
      giftTransactionId: txRef.id,
      totalCoins: total,
      diamondsAwarded: total,
      balances: {
        senderCoins: nextSender.balance,
        senderBonusCoins: nextSender.bonus_coins,
        receiverDiamonds: nextReceiver.diamonds,
      },
      event: {
        giftId,
        senderId,
        receiverId,
        roomId: input.roomId ?? null,
        quantity: qty,
        combo,
        timestamp: Math.floor(Date.now() / 1000),
        totalCoins: total,
        tier: input.tier || 'normal',
        giftTransactionId: txRef.id,
      },
    };
  });

  return result;
}

/** Best-effort mirror after a successful Supabase/API settle. */
export async function mirrorGiftSettleToFirebase(
  input: SettleFirebaseGiftInput & { giftTransactionId?: string; totalCoins?: number },
): Promise<void> {
  const db = firestore();
  if (!db) return;
  try {
    const total = Math.max(1, Math.floor(input.totalCoins ?? input.unitPrice * (input.quantity ?? 1)));
    const qty = Math.max(1, Math.floor(input.quantity ?? 1));
    await setDoc(
      doc(collection(db, GIFT_TX)),
      {
        client_request_id: input.clientRequestId || null,
        gift_id: input.giftId,
        gift_name: input.giftName || input.giftId,
        sender_id: input.senderId,
        receiver_id: input.receiverId,
        room_id: input.roomId || null,
        quantity: qty,
        combo: Math.max(1, Math.floor(input.combo ?? 1)),
        unit_price: input.unitPrice,
        total_coins: total,
        diamonds_awarded: total,
        currency: 'coins',
        tier: input.tier || 'normal',
        created_at: serverTimestamp(),
        backend: 'supabase_mirror',
        supabase_tx_id: input.giftTransactionId || null,
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('[gift-wallet/firebase] mirror failed:', err);
  }
}

export function subscribeFirebaseWallet(
  userId: string,
  onChange: (wallet: FirebaseWalletBalances) => void,
): Unsubscribe {
  const db = firestore();
  if (!db || !userId) return () => undefined;
  return onSnapshot(
    doc(db, WALLETS, userId),
    (snap) => onChange(mapWallet(snap.data() as Record<string, unknown> | undefined)),
    (err) => console.warn('[gift-wallet/firebase] subscribe failed:', err),
  );
}
