/**
 * WalletService — Edge wallet + Realtime sync via existing lib helpers.
 */
import {
  fetchWallet,
  transferCoins,
  fetchRechargePackages,
  createRechargeCheckoutSession,
  verifyRechargeCheckoutSession,
} from '../lib/platformApi';
import {
  startWalletRealtime,
  stopWalletRealtime,
} from '../lib/walletRealtime';
import type { ServiceResult } from '../types/platform';

export interface WalletService {
  getBalance(): Promise<ServiceResult<{ balance: number; [key: string]: unknown }>>;
  transfer(toUser: string, amount: number): Promise<ServiceResult<unknown>>;
  listRechargePackages(): Promise<ServiceResult<{ packages: unknown[] }>>;
  createCheckout(payload: {
    packageId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<ServiceResult<unknown>>;
  verifyCheckout(sessionId: string): Promise<ServiceResult<unknown>>;
  startRealtime(userId: string): void;
  stopRealtime(): void;
}

class WalletServiceImpl implements WalletService {
  async getBalance(): Promise<ServiceResult<{ balance: number; [key: string]: unknown }>> {
    try {
      const data = await fetchWallet();
      return { ok: true, data: data as { balance: number; [key: string]: unknown } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async transfer(toUser: string, amount: number): Promise<ServiceResult<unknown>> {
    try {
      const data = await transferCoins(toUser, amount);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async listRechargePackages(): Promise<ServiceResult<{ packages: unknown[] }>> {
    try {
      const data = await fetchRechargePackages();
      return { ok: true, data: data as { packages: unknown[] } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async createCheckout(payload: {
    packageId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<ServiceResult<unknown>> {
    try {
      const data = await createRechargeCheckoutSession(payload);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async verifyCheckout(sessionId: string): Promise<ServiceResult<unknown>> {
    try {
      const data = await verifyRechargeCheckoutSession(sessionId);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  startRealtime(userId: string): void {
    startWalletRealtime(userId);
  }

  stopRealtime(): void {
    stopWalletRealtime();
  }
}

export const walletService: WalletService = new WalletServiceImpl();
