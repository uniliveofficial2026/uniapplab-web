/**
 * Instant wallet ledger sync — Firebase onSnapshot + Supabase Realtime on wallets.
 * Local coins_balance updates on every remote change; UI never waits for a poll.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { shouldUseFirebaseForCloudData } from './auth/cloudDataBackend';
import { db } from './db/localDb';
import { isFirebaseConfigured } from './firebase/config';
import { getSupabaseClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';
import {
  removeSafeRealtimeChannel,
  subscribeSafeRealtimeChannel,
} from './supabase/safeRealtimeChannel';
import { saveWalletCoinsBalance } from './walletKstarSync';
import { syncServerWalletBalance } from './walletServerSync';

let activeUserId: string | null = null;
let firebaseUnsub: (() => void) | null = null;
let supabaseChannel: RealtimeChannel | null = null;

async function firebaseGiftWallet() {
  return import('./firebase/giftWallet');
}

function applyRemoteBalance(userId: string, balance: number): void {
  if (!isCloudAuthUserId(userId) || db.currentUserId !== userId) return;
  if (!Number.isFinite(balance)) return;
  const server = Math.floor(balance);
  const local = Math.floor(Number(db.load('coins_balance', 0)));
  if (server === local) return;
  saveWalletCoinsBalance(userId, server);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
  }
}

function startFirebaseWalletLane(userId: string): void {
  if (!isFirebaseConfigured()) return;
  firebaseUnsub?.();
  let cancelled = false;
  let unsub: (() => void) | undefined;
  void firebaseGiftWallet().then((fb) => {
    if (cancelled || !fb.isFirebaseGiftWalletAvailable()) return;
    unsub = fb.subscribeFirebaseWallet(userId, (wallet) => {
      applyRemoteBalance(userId, wallet.balance);
    });
  });
  firebaseUnsub = () => {
    cancelled = true;
    unsub?.();
  };
}

function startSupabaseWalletLane(userId: string): void {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  if (supabaseChannel) {
    removeSafeRealtimeChannel(supabase, supabaseChannel);
    supabaseChannel = null;
  }

  supabaseChannel = subscribeSafeRealtimeChannel(supabase, `wallets:live:${userId}`, (ch) => {
    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as { balance?: unknown } | null;
        const balance = Number(row?.balance);
        if (Number.isFinite(balance)) {
          applyRemoteBalance(userId, balance);
          return;
        }
        void syncServerWalletBalance(userId);
      },
    );
  });
}

/** Start live wallet listeners for the signed-in cloud user. Idempotent per userId. */
export function startWalletRealtime(userId: string): void {
  if (!isCloudAuthUserId(userId)) return;
  if (activeUserId === userId && (firebaseUnsub || supabaseChannel)) return;

  stopWalletRealtime();
  activeUserId = userId;

  const preferFirebase = shouldUseFirebaseForCloudData(userId);
  if (preferFirebase) {
    startFirebaseWalletLane(userId);
    startSupabaseWalletLane(userId);
  } else {
    startSupabaseWalletLane(userId);
  }

  // Immediate authoritative pull so first paint matches cloud.
  void syncServerWalletBalance(userId);
}

export function stopWalletRealtime(): void {
  activeUserId = null;
  firebaseUnsub?.();
  firebaseUnsub = null;
  if (supabaseChannel) {
    const channel = supabaseChannel;
    supabaseChannel = null;
    const supabase = getSupabaseClient();
    if (supabase) void supabase.removeChannel(channel);
  }
}
