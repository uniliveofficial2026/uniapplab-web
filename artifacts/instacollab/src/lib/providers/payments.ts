/**
 * Payment provider abstraction — Stripe via Edge payments today.
 * Apple Pay / Google Pay stubs for later.
 */
import type { PaymentProviderId } from '../../types/platform';
import {
  createRechargeCheckoutSession,
  verifyRechargeCheckoutSession,
  fetchRechargePackages,
} from '../platformApi';
import type { ServiceResult } from '../../types/platform';

export type PaymentProvider = {
  id: PaymentProviderId;
  label: string;
  available: boolean;
  note: string;
};

const PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  stripe: {
    id: 'stripe',
    label: 'Stripe',
    available: true,
    note: 'Edge Function payments — recharge + commerce checkout.',
  },
  apple_pay: {
    id: 'apple_pay',
    label: 'Apple Pay',
    available: false,
    note: 'Stub — route through Stripe Payment Request later.',
  },
  google_pay: {
    id: 'google_pay',
    label: 'Google Pay',
    available: false,
    note: 'Stub — route through Stripe Payment Request later.',
  },
};

export function listPaymentProviders(): PaymentProviderId[] {
  return Object.keys(PROVIDERS) as PaymentProviderId[];
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  return PROVIDERS[id] ?? PROVIDERS.stripe;
}

/** Stripe-backed helpers (secrets stay on Edge). */
export const stripePaymentFacade = {
  listPackages: fetchRechargePackages,
  createCheckout: createRechargeCheckoutSession,
  verifyCheckout: verifyRechargeCheckoutSession,
  async createCheckoutSafe(payload: {
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
  },
};
